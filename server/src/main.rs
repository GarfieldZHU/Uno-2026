use serde::Deserialize;
use std::collections::HashMap;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use uno_core::{AiProfile, GameState, PlayerKind};

const ROOM_TTL: Duration = Duration::from_secs(15 * 60);
const MIN_PLAYERS: usize = 3;
const MAX_PLAYERS: usize = 8;

type SharedRooms = Arc<Mutex<HashMap<String, Room>>>;

static ID_COUNTER: AtomicU64 = AtomicU64::new(1);

struct PlayerSession {
    token: String,
    name: String,
    seat: usize,
    host: bool,
}

struct Room {
    code: String,
    host_token: String,
    players: Vec<PlayerSession>,
    seat_count: usize,
    ai_count: usize,
    profile: AiProfile,
    timeout: Duration,
    expires_at: SystemTime,
    game: Option<GameState>,
    started: bool,
    turn_deadline: Option<SystemTime>,
    next_ai_at: Option<SystemTime>,
}

#[derive(Deserialize)]
struct CreateRequest {
    name: Option<String>,
    player_name: Option<String>,
    max_players: Option<usize>,
    player_count: Option<usize>,
    ai_count: Option<usize>,
    countdown_seconds: Option<u64>,
    turn_timeout_seconds: Option<u64>,
    ai_profile: Option<String>,
}

#[derive(Deserialize)]
struct JoinRequest {
    name: Option<String>,
    player_name: Option<String>,
}

#[derive(Deserialize)]
struct ActionRequest {
    action: String,
    card_id: Option<u16>,
    chosen_color: Option<String>,
}

fn main() -> std::io::Result<()> {
    let address = std::env::var("UNO_SERVER_ADDR").unwrap_or_else(|_| "127.0.0.1:8787".to_string());
    let rooms: SharedRooms = Arc::new(Mutex::new(HashMap::new()));
    let listener = TcpListener::bind(&address)?;
    println!("UNO 2026 room server listening on {address}");

    for stream in listener.incoming() {
        match stream {
            Ok(stream) => {
                let rooms = Arc::clone(&rooms);
                std::thread::spawn(move || {
                    if let Err(error) = handle_connection(stream, &rooms) {
                        eprintln!("connection error: {error}");
                    }
                });
            }
            Err(error) => eprintln!("accept error: {error}"),
        }
    }
    Ok(())
}

fn now() -> SystemTime {
    SystemTime::now()
}

fn nonce() -> u64 {
    let nanos = now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos() as u64;
    nanos ^ ID_COUNTER.fetch_add(1, Ordering::Relaxed).rotate_left(17)
}

fn token(prefix: &str) -> String {
    format!("{prefix}-{:016x}", nonce())
}

fn room_code(rooms: &HashMap<String, Room>) -> String {
    const ALPHABET: &[u8] = b"ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let mut value = nonce();
    loop {
        let mut code = String::with_capacity(4);
        for _ in 0..4 {
            code.push(ALPHABET[(value as usize) % ALPHABET.len()] as char);
            value = value.rotate_right(7).wrapping_mul(0x9e3779b97f4a7c15);
        }
        if !rooms.contains_key(&code) {
            return code;
        }
        value = nonce();
    }
}

fn clamp_config(request: &CreateRequest) -> Result<(usize, usize, AiProfile, Duration), String> {
    let seat_count = request
        .max_players
        .or(request.player_count)
        .unwrap_or(4)
        .clamp(MIN_PLAYERS, MAX_PLAYERS);
    let ai_count = request.ai_count.unwrap_or(0);
    if ai_count >= seat_count {
        return Err("ai-count-must-leave-a-human-seat".to_string());
    }
    let profile = AiProfile::from_wire(
        request
            .ai_profile
            .as_deref()
            .unwrap_or("garfield1993-ai-simple"),
    )
    .ok_or_else(|| "invalid-ai-profile".to_string())?;
    let seconds = request
        .countdown_seconds
        .or(request.turn_timeout_seconds)
        .unwrap_or(15)
        .clamp(5, 30);
    Ok((seat_count, ai_count, profile, Duration::from_secs(seconds)))
}

fn read_request(stream: &mut TcpStream) -> std::io::Result<(String, String, String)> {
    let mut buffer = Vec::with_capacity(16 * 1024);
    let mut chunk = [0_u8; 4096];
    let header_end;
    loop {
        let count = stream.read(&mut chunk)?;
        if count == 0 {
            return Ok((String::new(), String::new(), String::new()));
        }
        buffer.extend_from_slice(&chunk[..count]);
        if let Some(index) = buffer.windows(4).position(|part| part == b"\r\n\r\n") {
            header_end = index + 4;
            break;
        }
        if buffer.len() > 128 * 1024 {
            return Ok((String::new(), String::new(), String::new()));
        }
    }
    let headers = String::from_utf8_lossy(&buffer[..header_end - 4]).to_string();
    let content_length = headers
        .lines()
        .find_map(|line| {
            let (name, value) = line.split_once(':')?;
            (name.eq_ignore_ascii_case("content-length"))
                .then(|| value.trim().parse::<usize>().ok())
                .flatten()
        })
        .unwrap_or(0);
    while buffer.len() < header_end + content_length {
        let count = stream.read(&mut chunk)?;
        if count == 0 {
            break;
        }
        buffer.extend_from_slice(&chunk[..count]);
    }
    let request = String::from_utf8_lossy(&buffer).to_string();
    let first_line = request.lines().next().unwrap_or_default();
    let mut parts = first_line.split_whitespace();
    let method = parts.next().unwrap_or_default().to_string();
    let path = parts.next().unwrap_or("/").to_string();
    let body = request
        .split_once("\r\n\r\n")
        .map(|(_, body)| body.to_string())
        .unwrap_or_default();
    Ok((method, path, format!("{headers}\r\n\r\n{body}")))
}

fn json_response(status: &str, body: &serde_json::Value) -> String {
    let body = body.to_string();
    format!(
        "HTTP/1.1 {status}\r\nContent-Type: application/json; charset=utf-8\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: GET,POST,DELETE,OPTIONS\r\nAccess-Control-Allow-Headers: Content-Type,X-Player-Token\r\nCache-Control: no-store\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
        body.len()
    )
}

fn send_json(stream: &mut TcpStream, status: &str, body: serde_json::Value) -> std::io::Result<()> {
    stream.write_all(json_response(status, &body).as_bytes())
}

fn error(status: &'static str, message: impl Into<String>) -> (&'static str, serde_json::Value) {
    (status, serde_json::json!({ "error": message.into() }))
}

fn handle_connection(mut stream: TcpStream, rooms: &SharedRooms) -> std::io::Result<()> {
    let (method, path, request) = read_request(&mut stream)?;
    if method.is_empty() {
        return Ok(());
    }
    if method == "OPTIONS" {
        return send_json(&mut stream, "204 No Content", serde_json::json!({}));
    }
    if method == "GET" && path == "/health" {
        return send_json(
            &mut stream,
            "200 OK",
            serde_json::json!({ "status": "ok", "mode": "rooms", "room_ttl_seconds": ROOM_TTL.as_secs() }),
        );
    }
    let segments = path.trim_matches('/').split('/').collect::<Vec<_>>();
    let result = match (method.as_str(), segments.as_slice()) {
        ("POST", ["api", "v1", "rooms"]) => create_room(&request, rooms),
        ("POST", ["api", "v1", "rooms", code, "players"]) => join_room(code, &request, rooms),
        ("DELETE", ["api", "v1", "rooms", code, "players", player_id]) => {
            leave_room(code, player_id, &request, rooms)
        }
        ("POST", ["api", "v1", "rooms", code, "start"]) => start_room(code, &request, rooms),
        ("GET", ["api", "v1", "rooms", code]) => view_room(code, &request, rooms),
        ("POST", ["api", "v1", "rooms", code, "actions"]) => action_room(code, &request, rooms),
        _ => Err(error("404 Not Found", "not-found")),
    };
    let (status, body) = result.unwrap_or_else(|response| response);
    send_json(&mut stream, status, body)
}

fn request_body(request: &str) -> &str {
    request
        .split_once("\r\n\r\n")
        .map(|(_, body)| body)
        .unwrap_or_default()
}

fn request_token(request: &str) -> Option<&str> {
    request.lines().find_map(|line| {
        let (name, value) = line.split_once(':')?;
        name.eq_ignore_ascii_case("x-player-token")
            .then_some(value.trim())
    })
}

fn purge_expired(rooms: &mut HashMap<String, Room>) {
    let current = now();
    rooms.retain(|_, room| room.expires_at > current);
}

fn create_room(
    request: &str,
    rooms: &SharedRooms,
) -> Result<(&'static str, serde_json::Value), (&'static str, serde_json::Value)> {
    let input: CreateRequest = serde_json::from_str(request_body(request))
        .map_err(|_| error("400 Bad Request", "invalid-json"))?;
    let (seat_count, ai_count, profile, timeout) =
        clamp_config(&input).map_err(|message| error("400 Bad Request", message))?;
    let name = input
        .name
        .or(input.player_name)
        .unwrap_or_else(|| "Host".to_string())
        .trim()
        .chars()
        .take(24)
        .collect::<String>();
    let mut all_rooms = rooms.lock().expect("room mutex poisoned");
    purge_expired(&mut all_rooms);
    let code = room_code(&all_rooms);
    let host_token = token("p");
    all_rooms.insert(
        code.clone(),
        Room {
            code: code.clone(),
            host_token: host_token.clone(),
            players: vec![PlayerSession {
                token: host_token.clone(),
                name,
                seat: 0,
                host: true,
            }],
            seat_count,
            ai_count,
            profile,
            timeout,
            expires_at: now() + ROOM_TTL,
            game: None,
            started: false,
            turn_deadline: None,
            next_ai_at: None,
        },
    );
    Ok((
        "201 Created",
        serde_json::json!({
            "room_code": code,
            "player_id": 0,
            "player_token": host_token,
            "host": true,
            "seat_count": seat_count,
            "ai_count": ai_count,
            "turn_timeout_seconds": timeout.as_secs(),
            "expires_in_seconds": ROOM_TTL.as_secs(),
            "status": "waiting"
        }),
    ))
}

fn with_room<'a>(
    code: &str,
    rooms: &'a mut HashMap<String, Room>,
) -> Result<&'a mut Room, (&'static str, serde_json::Value)> {
    purge_expired(rooms);
    rooms
        .get_mut(code)
        .ok_or_else(|| error("404 Not Found", "room-not-found"))
}

fn join_room(
    code: &str,
    request: &str,
    rooms: &SharedRooms,
) -> Result<(&'static str, serde_json::Value), (&'static str, serde_json::Value)> {
    let input: JoinRequest = serde_json::from_str(request_body(request))
        .map_err(|_| error("400 Bad Request", "invalid-json"))?;
    let name = input
        .name
        .or(input.player_name)
        .unwrap_or_else(|| "Player".to_string())
        .trim()
        .chars()
        .take(24)
        .collect::<String>();
    let mut all_rooms = rooms.lock().expect("room mutex poisoned");
    let room = with_room(code, &mut all_rooms)?;
    if room.started {
        return Err(error("409 Conflict", "room-already-started"));
    }
    let human_capacity = room.seat_count.saturating_sub(room.ai_count);
    if room.players.len() >= human_capacity {
        return Err(error("409 Conflict", "human-seats-full"));
    }
    let player_token = token("p");
    let seat = room.players.len();
    room.players.push(PlayerSession {
        token: player_token.clone(),
        name,
        seat,
        host: false,
    });
    Ok((
        "201 Created",
        serde_json::json!({
            "room_code": code,
            "player_id": seat,
            "player_token": player_token,
            "host": false,
            "status": "waiting",
            "expires_in_seconds": room.expires_at.duration_since(now()).unwrap_or_default().as_secs()
        }),
    ))
}

fn find_player<'a>(
    room: &'a Room,
    request: &str,
) -> Result<&'a PlayerSession, (&'static str, serde_json::Value)> {
    let token =
        request_token(request).ok_or_else(|| error("401 Unauthorized", "player-token-required"))?;
    room.players
        .iter()
        .find(|player| player.token == token)
        .ok_or_else(|| error("403 Forbidden", "player-not-in-room"))
}

fn start_room(
    code: &str,
    request: &str,
    rooms: &SharedRooms,
) -> Result<(&'static str, serde_json::Value), (&'static str, serde_json::Value)> {
    let mut all_rooms = rooms.lock().expect("room mutex poisoned");
    let room = with_room(code, &mut all_rooms)?;
    let host_token =
        request_token(request).ok_or_else(|| error("401 Unauthorized", "player-token-required"))?;
    if host_token != room.host_token {
        return Err(error("403 Forbidden", "host-required"));
    }
    if room.started {
        return Err(error("409 Conflict", "room-already-started"));
    }
    let total_players = (room.players.len() + room.ai_count).min(room.seat_count);
    if total_players < MIN_PLAYERS {
        return Err(error("409 Conflict", "need-at-least-three-players"));
    }
    let mut game = GameState::new_with_player_count(nonce(), total_players, room.profile);
    for player in game.players_mut().iter_mut() {
        player.kind = PlayerKind::Ai(room.profile);
    }
    for session in &room.players {
        if let Some(player) = game.players_mut().get_mut(session.seat) {
            player.name = session.name.clone();
            player.kind = PlayerKind::Human;
        }
    }
    for (index, player) in game.players_mut().iter_mut().enumerate() {
        if !room.players.iter().any(|session| session.seat == index) {
            player.name = format!("AI {}", index + 1);
        }
    }
    room.game = Some(game);
    room.started = true;
    room.turn_deadline = Some(now() + room.timeout);
    room.next_ai_at = Some(now() + Duration::from_millis(900));
    Ok((
        "200 OK",
        serde_json::json!({ "room_code": code, "status": "playing", "started": true }),
    ))
}

fn advance_automatic_turns(room: &mut Room) {
    let Some(game) = room.game.as_mut() else {
        return;
    };
    for _ in 0..32 {
        if game.snapshot_json().is_empty() {
            return;
        }
        let snapshot = serde_json::from_str::<serde_json::Value>(&game.snapshot_json()).ok();
        let Some(snapshot) = snapshot else { return };
        if snapshot["status"] == "Won" {
            return;
        }
        let current = snapshot["current_player"].as_u64().unwrap_or(0) as usize;
        let is_human = game
            .players()
            .get(current)
            .map(|player| matches!(player.kind, PlayerKind::Human))
            .unwrap_or(true);
        if is_human {
            let deadline = room
                .turn_deadline
                .get_or_insert_with(|| now() + room.timeout);
            if *deadline > now() {
                return;
            }
            let _ = game.draw_for_player(current);
            room.turn_deadline = Some(now() + room.timeout);
            room.next_ai_at = Some(now() + Duration::from_millis(900));
            return;
        }
        let due = room.next_ai_at.unwrap_or_else(now);
        if due > now() {
            return;
        }
        let _ = game.ai_step(room.profile);
        room.next_ai_at = Some(now() + Duration::from_millis(900));
        room.turn_deadline = Some(now() + room.timeout);
    }
}

fn room_view(room: &mut Room, viewer: Option<&str>) -> serde_json::Value {
    advance_automatic_turns(room);
    let viewer_id = viewer.and_then(|token| {
        room.players
            .iter()
            .find(|player| player.token == token)
            .map(|player| player.seat)
    });
    let snapshot = room.game.as_ref().map(|game| {
        let json = game.snapshot_json_for(viewer_id.unwrap_or(0));
        serde_json::from_str::<serde_json::Value>(&json).unwrap_or_else(|_| serde_json::json!({}))
    });
    serde_json::json!({
        "code": room.code,
        "room_code": room.code,
        "host_id": room.players.iter().find(|player| player.host).map(|player| player.seat),
        "players": room.players.iter().map(|player| serde_json::json!({
            "id": player.seat,
            "name": player.name,
            "isHost": player.host,
            "host": player.host,
            "ready": true
        })).collect::<Vec<_>>(),
        "maxPlayers": room.seat_count,
        "seat_count": room.seat_count,
        "aiCount": room.ai_count,
        "ai_count": room.ai_count,
        "countdownSeconds": room.timeout.as_secs(),
        "turn_timeout_seconds": room.timeout.as_secs(),
        "status": if room.started { "playing" } else { "waiting" },
        "started": room.started,
        "snapshot": snapshot,
        "expires_in_seconds": room.expires_at.duration_since(now()).unwrap_or_default().as_secs(),
        "turn_deadline_epoch_ms": room.turn_deadline.and_then(|deadline| deadline.duration_since(UNIX_EPOCH).ok()).map(|duration| duration.as_millis())
    })
}

fn view_room(
    code: &str,
    request: &str,
    rooms: &SharedRooms,
) -> Result<(&'static str, serde_json::Value), (&'static str, serde_json::Value)> {
    let mut all_rooms = rooms.lock().expect("room mutex poisoned");
    let room = with_room(code, &mut all_rooms)?;
    let token = request_token(request);
    if room.started && token.is_none() {
        return Err(error("401 Unauthorized", "player-token-required"));
    }
    if let Some(token) = token {
        find_player(room, request)?;
        if room.started && !room.players.iter().any(|player| player.token == token) {
            return Err(error("403 Forbidden", "player-not-in-room"));
        }
    }
    Ok(("200 OK", room_view(room, token)))
}

fn action_room(
    code: &str,
    request: &str,
    rooms: &SharedRooms,
) -> Result<(&'static str, serde_json::Value), (&'static str, serde_json::Value)> {
    let input: ActionRequest = serde_json::from_str(request_body(request))
        .map_err(|_| error("400 Bad Request", "invalid-json"))?;
    let mut all_rooms = rooms.lock().expect("room mutex poisoned");
    let room = with_room(code, &mut all_rooms)?;
    let token =
        request_token(request).ok_or_else(|| error("401 Unauthorized", "player-token-required"))?;
    let player = room
        .players
        .iter()
        .find(|player| player.token == token)
        .ok_or_else(|| error("403 Forbidden", "player-not-in-room"))?;
    let viewer_id = player.seat;
    if !room.started {
        return Err(error("409 Conflict", "room-not-started"));
    }
    advance_automatic_turns(room);
    let game = room.game.as_mut().expect("started room has a game");
    let current = serde_json::from_str::<serde_json::Value>(&game.snapshot_json())
        .ok()
        .and_then(|snapshot| snapshot["current_player"].as_u64())
        .unwrap_or(usize::MAX as u64) as usize;
    if current != viewer_id {
        return Err(error("409 Conflict", "not-your-turn"));
    }
    let raw = match input.action.as_str() {
        "play" => game
            .play_card(
                viewer_id,
                input
                    .card_id
                    .ok_or_else(|| error("400 Bad Request", "card-id-required"))?,
                input
                    .chosen_color
                    .as_deref()
                    .and_then(uno_core::Color::from_wire),
            )
            .unwrap_or_else(|message| game.error_json_for(viewer_id, message)),
        "draw" => game
            .draw_for_player(viewer_id)
            .unwrap_or_else(|message| game.error_json_for(viewer_id, message)),
        "call_uno" => game
            .call_uno(viewer_id)
            .unwrap_or_else(|message| game.error_json_for(viewer_id, message)),
        _ => return Err(error("400 Bad Request", "unknown-action")),
    };
    room.turn_deadline = Some(now() + room.timeout);
    room.next_ai_at = Some(now() + Duration::from_millis(900));
    let command =
        serde_json::from_str::<serde_json::Value>(&raw).unwrap_or_else(|_| serde_json::json!({}));
    let snapshot = serde_json::from_str::<serde_json::Value>(&game.snapshot_json_for(viewer_id))
        .unwrap_or_else(|_| serde_json::json!({}));
    Ok((
        "200 OK",
        serde_json::json!({
            "ok": command.get("ok").and_then(serde_json::Value::as_bool).unwrap_or(true),
            "error": command.get("error"),
            "snapshot": snapshot,
            "room": room_view(room, Some(token))
        }),
    ))
}

fn leave_room(
    code: &str,
    player_id: &str,
    request: &str,
    rooms: &SharedRooms,
) -> Result<(&'static str, serde_json::Value), (&'static str, serde_json::Value)> {
    let mut all_rooms = rooms.lock().expect("room mutex poisoned");
    let room = with_room(code, &mut all_rooms)?;
    let token =
        request_token(request).ok_or_else(|| error("401 Unauthorized", "player-token-required"))?;
    let index = room
        .players
        .iter()
        .position(|player| player.token == token && player.seat.to_string() == player_id)
        .ok_or_else(|| error("403 Forbidden", "player-not-in-room"))?;
    if room.players[index].host {
        all_rooms.remove(code);
        return Ok((
            "200 OK",
            serde_json::json!({ "closed": true, "room_code": code }),
        ));
    }
    let seat = room.players[index].seat;
    room.players.remove(index);
    if let Some(game) = room.game.as_mut() {
        if let Some(player) = game.players_mut().get_mut(seat) {
            player.kind = PlayerKind::Ai(room.profile);
            player.name = format!("AI {}", seat + 1);
        }
    }
    Ok((
        "200 OK",
        serde_json::json!({ "closed": false, "room_code": code }),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn room_codes_are_four_characters_and_unique() {
        let rooms = HashMap::new();
        let first = room_code(&rooms);
        let mut rooms = HashMap::new();
        rooms.insert(
            first.clone(),
            Room {
                code: first.clone(),
                host_token: String::new(),
                players: Vec::new(),
                seat_count: 4,
                ai_count: 0,
                profile: AiProfile::Garfield1993AiSimple,
                timeout: Duration::from_secs(15),
                expires_at: now() + ROOM_TTL,
                game: None,
                started: false,
                turn_deadline: None,
                next_ai_at: None,
            },
        );
        let second = room_code(&rooms);
        assert_eq!(first.len(), 4);
        assert_eq!(second.len(), 4);
        assert_ne!(first, second);
    }

    #[test]
    fn config_clamps_human_timeout_to_five_thirty_seconds() {
        let input = CreateRequest {
            name: None,
            player_name: None,
            max_players: Some(4),
            player_count: None,
            ai_count: Some(0),
            countdown_seconds: Some(1),
            turn_timeout_seconds: None,
            ai_profile: None,
        };
        let (_, _, _, timeout) = clamp_config(&input).unwrap();
        assert_eq!(timeout.as_secs(), 5);
    }
}
