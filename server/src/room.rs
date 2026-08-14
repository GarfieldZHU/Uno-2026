use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc::{self, Receiver, Sender};
use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use uno_core::{AiProfile, GameState, PlayerKind};

pub const ROOM_TTL: Duration = Duration::from_secs(15 * 60);
pub const DISCONNECTED_ROOM_TTL: Duration = Duration::from_secs(3 * 60);
pub const STATE_RETENTION: Duration = Duration::from_secs(6 * 60 * 60);
pub const MIN_PLAYERS: usize = 3;
pub const MAX_PLAYERS: usize = 8;

pub type SharedRooms = Arc<Mutex<HashMap<String, Room>>>;
pub type Response = (&'static str, Value);
pub type HandlerResult = Result<Response, Response>;

static ID_COUNTER: AtomicU64 = AtomicU64::new(1);
static LAST_MAINTENANCE_DAY: AtomicU64 = AtomicU64::new(0);

pub struct Subscriber {
    pub id: u64,
    pub token: String,
    pub tx: Sender<String>,
}

pub struct PlayerSession {
    pub token: String,
    pub name: String,
    pub seat: usize,
    pub host: bool,
    pub connected: bool,
}

pub struct Room {
    pub code: String,
    pub host_token: String,
    pub players: Vec<PlayerSession>,
    pub seat_count: usize,
    pub ai_count: usize,
    pub profile: AiProfile,
    pub timeout: Duration,
    pub expires_at: SystemTime,
    pub disconnect_deadline: Option<SystemTime>,
    pub last_activity: SystemTime,
    pub finished_at: Option<SystemTime>,
    pub game: Option<GameState>,
    pub started: bool,
    pub turn_deadline: Option<SystemTime>,
    pub next_ai_at: Option<SystemTime>,
    pub subscribers: Vec<Subscriber>,
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

pub fn new_store() -> SharedRooms {
    Arc::new(Mutex::new(HashMap::new()))
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

fn error(status: &'static str, message: impl Into<String>) -> Response {
    (status, json!({ "error": message.into() }))
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

fn room_status(room: &Room) -> &'static str {
    if !room.started {
        "waiting"
    } else if room.finished_at.is_some() {
        "finished"
    } else {
        "playing"
    }
}

fn room_expiration(room: &Room) -> Option<SystemTime> {
    if room.started {
        room.disconnect_deadline
    } else {
        Some(room.expires_at)
    }
}

fn room_expiry_seconds(room: &Room) -> Option<u64> {
    room_expiration(room)
        .map(|deadline| deadline.duration_since(now()).unwrap_or_default().as_secs())
}

fn purge_expired(rooms: &mut HashMap<String, Room>) {
    let current = now();
    rooms.retain(|_, room| {
        let room_alive = room_expiration(room)
            .map(|deadline| deadline > current)
            .unwrap_or(true);
        let state_alive = room
            .finished_at
            .map(|finished| finished + STATE_RETENTION > current)
            .unwrap_or(true);
        room_alive && state_alive
    });
}

/// Run the retention pass once per UTC day. The current service has no disk
/// database; this protects the in-memory room/status registry if a future
/// record stops receiving updates without reaching one of the normal TTLs.
fn daily_state_cleanup(rooms: &mut HashMap<String, Room>) {
    let day = now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
        / 86_400;
    if LAST_MAINTENANCE_DAY.swap(day, Ordering::Relaxed) != day {
        let cutoff = now().checked_sub(STATE_RETENTION).unwrap_or(UNIX_EPOCH);
        rooms.retain(|_, room| room.last_activity >= cutoff);
    }
}

fn with_room<'a>(
    code: &str,
    rooms: &'a mut HashMap<String, Room>,
) -> Result<&'a mut Room, Response> {
    purge_expired(rooms);
    rooms
        .get_mut(code)
        .ok_or_else(|| error("404 Not Found", "room-not-found"))
}

fn name_or_default(name: Option<String>, fallback: &str) -> String {
    let value = name.unwrap_or_else(|| fallback.to_string());
    value.trim().chars().take(24).collect::<String>()
}

pub fn create_room(body: &str, rooms: &SharedRooms) -> HandlerResult {
    let input: CreateRequest =
        serde_json::from_str(body).map_err(|_| error("400 Bad Request", "invalid-json"))?;
    let (seat_count, ai_count, profile, timeout) =
        clamp_config(&input).map_err(|message| error("400 Bad Request", message))?;
    let name = name_or_default(input.name.or(input.player_name), "Host");
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
                connected: false,
            }],
            seat_count,
            ai_count,
            profile,
            timeout,
            expires_at: now() + ROOM_TTL,
            disconnect_deadline: None,
            last_activity: now(),
            finished_at: None,
            game: None,
            started: false,
            turn_deadline: None,
            next_ai_at: None,
            subscribers: Vec::new(),
        },
    );
    Ok((
        "201 Created",
        json!({
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

pub fn join_room(code: &str, body: &str, rooms: &SharedRooms) -> HandlerResult {
    let input: JoinRequest =
        serde_json::from_str(body).map_err(|_| error("400 Bad Request", "invalid-json"))?;
    let name = name_or_default(input.name.or(input.player_name), "Player");
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
    let seat = (0..room.seat_count)
        .find(|candidate| !room.players.iter().any(|player| player.seat == *candidate))
        .ok_or_else(|| error("409 Conflict", "human-seats-full"))?;
    room.players.push(PlayerSession {
        token: player_token.clone(),
        name,
        seat,
        host: false,
        connected: false,
    });
    room.last_activity = now();
    let result = Ok((
        "201 Created",
        json!({
            "room_code": code,
            "player_id": seat,
            "player_token": player_token,
            "host": false,
            "status": "waiting",
            "expires_in_seconds": room_expiry_seconds(room)
        }),
    ));
    drop(all_rooms);
    broadcast_room(rooms, code);
    result
}

fn find_player<'a>(room: &'a Room, token_value: &str) -> Result<&'a PlayerSession, Response> {
    room.players
        .iter()
        .find(|player| player.token == token_value)
        .ok_or_else(|| error("403 Forbidden", "player-not-in-room"))
}

fn start_game(room: &mut Room) {
    let total_players = (room.players.len() + room.ai_count).min(room.seat_count);
    let mut game = GameState::new_with_player_count(nonce(), total_players, room.profile);
    for player in game.players_mut().iter_mut() {
        player.kind = PlayerKind::Ai(room.profile);
    }
    for session in &room.players {
        if let Some(player) = game.players_mut().get_mut(session.seat) {
            player.name = session.name.clone();
            player.kind = if session.connected {
                PlayerKind::Human
            } else {
                PlayerKind::Ai(room.profile)
            };
        }
    }
    for (index, player) in game.players_mut().iter_mut().enumerate() {
        if !room.players.iter().any(|session| session.seat == index) {
            player.name = format!("AI {}", index + 1);
        }
    }
    room.game = Some(game);
    room.started = true;
    room.finished_at = None;
    room.disconnect_deadline = if room.subscribers.is_empty() {
        Some(now() + DISCONNECTED_ROOM_TTL)
    } else {
        None
    };
    room.last_activity = now();
    room.turn_deadline = Some(now() + room.timeout);
    room.next_ai_at = Some(now() + Duration::from_millis(900));
}

fn mark_finished_if_needed(room: &mut Room) {
    let won = room
        .game
        .as_ref()
        .and_then(|game| serde_json::from_str::<Value>(&game.snapshot_json()).ok())
        .map(|snapshot| snapshot["status"] == "Won")
        .unwrap_or(false);
    if won && room.finished_at.is_none() {
        room.finished_at = Some(now());
        room.turn_deadline = None;
        room.next_ai_at = None;
        if room.subscribers.is_empty() {
            room.disconnect_deadline = Some(now() + DISCONNECTED_ROOM_TTL);
        }
    }
}

fn mark_player_connected(room: &mut Room, token_value: &str) {
    let Some(seat) = room
        .players
        .iter_mut()
        .find(|player| player.token == token_value)
        .map(|player| {
            player.connected = true;
            player.seat
        })
    else {
        return;
    };
    room.last_activity = now();
    if room.started {
        room.disconnect_deadline = None;
        if let Some(game) = room.game.as_mut() {
            if let Some(player) = game.players_mut().get_mut(seat) {
                player.kind = PlayerKind::Human;
            }
        }
        let current = room
            .game
            .as_ref()
            .and_then(|game| serde_json::from_str::<Value>(&game.snapshot_json()).ok())
            .and_then(|snapshot| snapshot["current_player"].as_u64())
            .map(|player| player as usize);
        if current == Some(seat) {
            room.turn_deadline = Some(now() + room.timeout);
            room.next_ai_at = Some(now() + Duration::from_millis(900));
        }
    }
}

fn mark_player_disconnected(room: &mut Room, token_value: &str) {
    if room
        .subscribers
        .iter()
        .any(|subscriber| subscriber.token == token_value)
    {
        return;
    }
    let Some(seat) = room
        .players
        .iter_mut()
        .find(|player| player.token == token_value)
        .map(|player| {
            player.connected = false;
            player.seat
        })
    else {
        return;
    };
    room.last_activity = now();
    if room.started {
        if let Some(game) = room.game.as_mut() {
            game.replace_player_with_ai(seat, room.profile);
        }
        if room.subscribers.is_empty() {
            room.disconnect_deadline = Some(now() + DISCONNECTED_ROOM_TTL);
        }
    }
}

pub fn start_room(code: &str, token_value: Option<&str>, rooms: &SharedRooms) -> HandlerResult {
    let mut all_rooms = rooms.lock().expect("room mutex poisoned");
    let room = with_room(code, &mut all_rooms)?;
    if token_value != Some(room.host_token.as_str()) {
        return Err(error("403 Forbidden", "host-required"));
    }
    if room.started {
        return Err(error("409 Conflict", "room-already-started"));
    }
    let total_players = (room.players.len() + room.ai_count).min(room.seat_count);
    if total_players < MIN_PLAYERS {
        return Err(error("409 Conflict", "need-at-least-three-players"));
    }
    start_game(room);
    drop(all_rooms);
    broadcast_room(rooms, code);
    Ok((
        "200 OK",
        json!({ "room_code": code, "status": "playing", "started": true }),
    ))
}

pub fn advance_automatic_turns(room: &mut Room) -> bool {
    if room.game.is_none() {
        return false;
    }
    let mut changed = false;
    for _ in 0..32 {
        let snapshot = room
            .game
            .as_ref()
            .and_then(|game| serde_json::from_str::<Value>(&game.snapshot_json()).ok());
        let Some(snapshot) = snapshot else {
            break;
        };
        if snapshot["status"] == "Won" {
            break;
        }
        let current = snapshot["current_player"].as_u64().unwrap_or(0) as usize;
        let is_human = room
            .game
            .as_ref()
            .and_then(|game| game.players().get(current))
            .map(|player| matches!(player.kind, PlayerKind::Human))
            .unwrap_or(true);
        if is_human {
            let deadline = room
                .turn_deadline
                .get_or_insert_with(|| now() + room.timeout);
            if *deadline > now() {
                break;
            }
            if let Some(game) = room.game.as_mut() {
                let _ = game.timeout_step(current);
            }
            room.turn_deadline = Some(now() + room.timeout);
            room.next_ai_at = Some(now() + Duration::from_millis(900));
            room.last_activity = now();
            changed = true;
            break;
        }
        let due = room.next_ai_at.unwrap_or_else(now);
        if due > now() {
            break;
        }
        if let Some(game) = room.game.as_mut() {
            let _ = game.ai_step(room.profile);
        }
        room.next_ai_at = Some(now() + Duration::from_millis(900));
        room.turn_deadline = Some(now() + room.timeout);
        room.last_activity = now();
        changed = true;
    }
    mark_finished_if_needed(room);
    changed
}

pub fn room_view(room: &mut Room, viewer_token: Option<&str>) -> Value {
    advance_automatic_turns(room);
    let viewer_id = viewer_token.and_then(|value| {
        room.players
            .iter()
            .find(|player| player.token == value)
            .map(|player| player.seat)
    });
    let snapshot = room.game.as_ref().map(|game| {
        serde_json::from_str::<Value>(&game.snapshot_json_for(viewer_id.unwrap_or(0)))
            .unwrap_or_else(|_| json!({}))
    });
    json!({
        "code": room.code,
        "room_code": room.code,
        "host_id": room.players.iter().find(|player| player.host).map(|player| player.seat),
        "players": room.players.iter().map(|player| json!({ "id": player.seat, "name": player.name, "isHost": player.host, "host": player.host, "ready": true, "connected": player.connected })).collect::<Vec<_>>(),
        "maxPlayers": room.seat_count,
        "seat_count": room.seat_count,
        "aiCount": room.ai_count,
        "ai_count": room.ai_count,
        "countdownSeconds": room.timeout.as_secs(),
        "turn_timeout_seconds": room.timeout.as_secs(),
        "status": room_status(room),
        "started": room.started,
        "snapshot": snapshot,
        "current_player": room.game.as_ref().and_then(|game| serde_json::from_str::<Value>(&game.snapshot_json()).ok()).and_then(|value| value["current_player"].as_u64()),
        "next_player": room.game.as_ref().and_then(|game| serde_json::from_str::<Value>(&game.snapshot_json()).ok()).and_then(|value| value["next_player"].as_u64()),
        "expires_in_seconds": room_expiry_seconds(room),
        "turn_deadline_epoch_ms": room.turn_deadline.and_then(|deadline| deadline.duration_since(UNIX_EPOCH).ok()).map(|duration| duration.as_millis())
    })
}

pub fn view_room(code: &str, token_value: Option<&str>, rooms: &SharedRooms) -> HandlerResult {
    let mut all_rooms = rooms.lock().expect("room mutex poisoned");
    let room = with_room(code, &mut all_rooms)?;
    if room.started && token_value.is_none() {
        return Err(error("401 Unauthorized", "player-token-required"));
    }
    if let Some(value) = token_value {
        find_player(room, value)?;
    }
    let response = Ok(("200 OK", room_view(room, token_value)));
    drop(all_rooms);
    response
}

pub fn action_room(
    code: &str,
    token_value: Option<&str>,
    body: &str,
    rooms: &SharedRooms,
) -> HandlerResult {
    let input: ActionRequest =
        serde_json::from_str(body).map_err(|_| error("400 Bad Request", "invalid-json"))?;
    let mut all_rooms = rooms.lock().expect("room mutex poisoned");
    let room = with_room(code, &mut all_rooms)?;
    let token_value =
        token_value.ok_or_else(|| error("401 Unauthorized", "player-token-required"))?;
    let viewer_id = find_player(room, token_value)?.seat;
    if !room.started {
        return Err(error("409 Conflict", "room-not-started"));
    }
    advance_automatic_turns(room);
    let (raw, snapshot) = {
        let game = room.game.as_mut().expect("started room has a game");
        let current = serde_json::from_str::<Value>(&game.snapshot_json())
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
        let snapshot = serde_json::from_str::<Value>(&game.snapshot_json_for(viewer_id))
            .unwrap_or_else(|_| json!({}));
        (raw, snapshot)
    };
    room.turn_deadline = Some(now() + room.timeout);
    room.next_ai_at = Some(now() + Duration::from_millis(900));
    room.last_activity = now();
    mark_finished_if_needed(room);
    let command = serde_json::from_str::<Value>(&raw).unwrap_or_else(|_| json!({}));
    let result = Ok((
        "200 OK",
        json!({ "ok": command.get("ok").and_then(Value::as_bool).unwrap_or(true), "error": command.get("error"), "snapshot": snapshot, "room": room_view_without_advance(room, Some(token_value)) }),
    ));
    drop(all_rooms);
    broadcast_room(rooms, code);
    result
}

pub fn leave_room(
    code: &str,
    player_id: &str,
    token_value: Option<&str>,
    rooms: &SharedRooms,
) -> HandlerResult {
    let mut all_rooms = rooms.lock().expect("room mutex poisoned");
    let token_value =
        token_value.ok_or_else(|| error("401 Unauthorized", "player-token-required"))?;
    let close_room = {
        let room = with_room(code, &mut all_rooms)?;
        let index = room
            .players
            .iter()
            .position(|player| player.token == token_value && player.seat.to_string() == player_id)
            .ok_or_else(|| error("403 Forbidden", "player-not-in-room"))?;
        if room.players[index].host && !room.started {
            true
        } else {
            let seat = room.players[index].seat;
            let was_host = room.players[index].host;
            room.players.remove(index);
            if !room.started {
                // Before the game starts, compact the waiting human ring so a
                // later start cannot create a hole or duplicate player id.
                for player in room.players.iter_mut().filter(|player| player.seat > seat) {
                    player.seat -= 1;
                }
            } else if let Some(game) = room.game.as_mut() {
                if game.replace_player_with_ai(seat, room.profile) {
                    if let Some(player) = game.players_mut().get_mut(seat) {
                        player.name = format!("AI {}", seat + 1);
                    }
                    room.ai_count = (room.ai_count + 1).min(room.seat_count.saturating_sub(1));
                }
                if was_host {
                    if let Some(next_host) =
                        room.players.iter_mut().min_by_key(|player| player.seat)
                    {
                        next_host.host = true;
                        room.host_token = next_host.token.clone();
                    } else {
                        room.host_token.clear();
                    }
                }
            }
            room.last_activity = now();
            if room.started && room.subscribers.is_empty() {
                room.disconnect_deadline = Some(now() + DISCONNECTED_ROOM_TTL);
            }
            false
        }
    };
    if close_room {
        all_rooms.remove(code);
        return Ok(("200 OK", json!({ "closed": true, "room_code": code })));
    }
    drop(all_rooms);
    broadcast_room(rooms, code);
    Ok(("200 OK", json!({ "closed": false, "room_code": code })))
}

fn room_view_without_advance(room: &Room, viewer_token: Option<&str>) -> Value {
    let viewer_id = viewer_token.and_then(|value| {
        room.players
            .iter()
            .find(|player| player.token == value)
            .map(|player| player.seat)
    });
    let snapshot = room.game.as_ref().map(|game| {
        serde_json::from_str::<Value>(&game.snapshot_json_for(viewer_id.unwrap_or(0)))
            .unwrap_or_else(|_| json!({}))
    });
    let viewer =
        viewer_token.and_then(|value| room.players.iter().find(|player| player.token == value));
    json!({
        "code": room.code,
        "room_code": room.code,
        "host_id": room.players.iter().find(|player| player.host).map(|player| player.seat),
        "player_id": viewer.map(|player| player.seat),
        "host": viewer.map(|player| player.host),
        "players": room.players.iter().map(|player| json!({ "id": player.seat, "name": player.name, "isHost": player.host, "host": player.host, "ready": true, "connected": player.connected })).collect::<Vec<_>>(),
        "maxPlayers": room.seat_count,
        "seat_count": room.seat_count,
        "aiCount": room.ai_count,
        "ai_count": room.ai_count,
        "countdownSeconds": room.timeout.as_secs(),
        "turn_timeout_seconds": room.timeout.as_secs(),
        "status": room_status(room),
        "started": room.started,
        "snapshot": snapshot,
        "current_player": room.game.as_ref().and_then(|game| serde_json::from_str::<Value>(&game.snapshot_json()).ok()).and_then(|value| value["current_player"].as_u64()),
        "next_player": room.game.as_ref().and_then(|game| serde_json::from_str::<Value>(&game.snapshot_json()).ok()).and_then(|value| value["next_player"].as_u64()),
        "expires_in_seconds": room_expiry_seconds(room),
        "turn_deadline_epoch_ms": room.turn_deadline.and_then(|deadline| deadline.duration_since(UNIX_EPOCH).ok()).map(|duration| duration.as_millis())
    })
}

fn broadcast_locked(room: &mut Room) {
    let subscribers = room
        .subscribers
        .iter()
        .map(|subscriber| {
            (
                subscriber.id,
                subscriber.token.clone(),
                subscriber.tx.clone(),
            )
        })
        .collect::<Vec<_>>();
    let mut dead = Vec::new();
    let mut dead_tokens = Vec::new();
    for (id, token_value, tx) in subscribers {
        let payload = json!({ "type": "room.snapshot", "room": room_view_without_advance(room, Some(&token_value)) }).to_string();
        if tx.send(payload).is_err() {
            dead.push(id);
            dead_tokens.push(token_value);
        }
    }
    room.subscribers
        .retain(|subscriber| !dead.contains(&subscriber.id));
    for token_value in dead_tokens {
        mark_player_disconnected(room, &token_value);
    }
    if room.started && room.subscribers.is_empty() && room.disconnect_deadline.is_none() {
        room.disconnect_deadline = Some(now() + DISCONNECTED_ROOM_TTL);
    }
}

pub fn broadcast_room(rooms: &SharedRooms, code: &str) {
    let mut all_rooms = rooms.lock().expect("room mutex poisoned");
    if let Some(room) = all_rooms.get_mut(code) {
        broadcast_locked(room);
    }
}

pub fn subscribe(
    code: &str,
    token_value: &str,
    rooms: &SharedRooms,
) -> Result<(u64, Receiver<String>, String), Response> {
    let mut all_rooms = rooms.lock().expect("room mutex poisoned");
    let room = with_room(code, &mut all_rooms)?;
    find_player(room, token_value)?;
    mark_player_connected(room, token_value);
    let (tx, rx) = mpsc::channel();
    let id = nonce();
    let initial = json!({ "type": "room.snapshot", "room": room_view_without_advance(room, Some(token_value)) }).to_string();
    room.subscribers.push(Subscriber {
        id,
        token: token_value.to_string(),
        tx,
    });
    Ok((id, rx, initial))
}

pub fn unsubscribe(code: &str, subscriber_id: u64, rooms: &SharedRooms) {
    let mut all_rooms = rooms.lock().expect("room mutex poisoned");
    if let Some(room) = all_rooms.get_mut(code) {
        let token_value = room
            .subscribers
            .iter()
            .find(|subscriber| subscriber.id == subscriber_id)
            .map(|subscriber| subscriber.token.clone());
        room.subscribers
            .retain(|subscriber| subscriber.id != subscriber_id);
        if let Some(token_value) = token_value {
            mark_player_disconnected(room, &token_value);
        }
        room.last_activity = now();
        if room.started && room.subscribers.is_empty() {
            room.disconnect_deadline = Some(now() + DISCONNECTED_ROOM_TTL);
        }
    }
}

pub fn touch_subscriber(code: &str, subscriber_id: u64, rooms: &SharedRooms) {
    let mut all_rooms = rooms.lock().expect("room mutex poisoned");
    if let Some(room) = all_rooms.get_mut(code) {
        if room
            .subscribers
            .iter()
            .any(|subscriber| subscriber.id == subscriber_id)
        {
            room.last_activity = now();
            if room.started {
                room.disconnect_deadline = None;
            }
        }
    }
}

pub fn scheduler_tick(rooms: &SharedRooms) {
    let mut all_rooms = rooms.lock().expect("room mutex poisoned");
    daily_state_cleanup(&mut all_rooms);
    purge_expired(&mut all_rooms);
    for room in all_rooms.values_mut() {
        if advance_automatic_turns(room) {
            broadcast_locked(room);
        }
        if room
            .finished_at
            .map(|finished| finished + Duration::from_secs(5) <= now())
            .unwrap_or(false)
        {
            room.subscribers.clear();
            for player in &mut room.players {
                player.connected = false;
            }
            room.disconnect_deadline = Some(now() + DISCONNECTED_ROOM_TTL);
        }
    }
    purge_expired(&mut all_rooms);
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
                disconnect_deadline: None,
                last_activity: now(),
                finished_at: None,
                game: None,
                started: false,
                turn_deadline: None,
                next_ai_at: None,
                subscribers: Vec::new(),
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

    #[test]
    fn websocket_subscriber_receives_personalized_room_snapshot() {
        let rooms = new_store();
        let (_, created) = create_room(
            r#"{"name":"Host","max_players":3,"ai_count":2,"countdown_seconds":5}"#,
            &rooms,
        )
        .unwrap();
        let code = created["room_code"].as_str().unwrap().to_string();
        let token_value = created["player_token"].as_str().unwrap().to_string();
        let (subscriber_id, receiver, initial) = subscribe(&code, &token_value, &rooms).unwrap();
        assert!(initial.contains("room.snapshot"));
        broadcast_room(&rooms, &code);
        let message = receiver.recv_timeout(Duration::from_millis(100)).unwrap();
        assert!(message.contains(&code));
        unsubscribe(&code, subscriber_id, &rooms);
    }

    #[test]
    fn waiting_room_compacts_then_assigns_the_next_free_human_seat_after_leave() {
        let rooms = new_store();
        let (_, host) = create_room(r#"{"name":"Host","max_players":4}"#, &rooms).unwrap();
        let code = host["room_code"].as_str().unwrap().to_string();
        let (_, first) = join_room(&code, r#"{"name":"First"}"#, &rooms).unwrap();
        let _ = join_room(&code, r#"{"name":"Second"}"#, &rooms).unwrap();
        let first_token = first["player_token"].as_str().unwrap();
        let first_id = first["player_id"].as_u64().unwrap().to_string();
        leave_room(&code, &first_id, Some(first_token), &rooms).unwrap();

        let (_, replacement) = join_room(&code, r#"{"name":"Replacement"}"#, &rooms).unwrap();
        // Waiting-room seats are compacted after a leave, so the old seat 2
        // moves to 1 and the next join receives the next free seat.
        assert_eq!(replacement["player_id"], 2);
        let (_, view) = view_room(&code, None, &rooms).unwrap();
        let players = view["players"].as_array().unwrap();
        assert_eq!(
            players
                .iter()
                .map(|player| player["id"].clone())
                .collect::<Vec<_>>(),
            vec![0, 1, 2]
        );
        assert_eq!(players[1]["name"], "Second");
    }

    #[test]
    fn leaving_started_game_converts_the_seat_to_ai_and_keeps_snapshot_order() {
        let rooms = new_store();
        let (_, host) = create_room(r#"{"name":"Host","max_players":3}"#, &rooms).unwrap();
        let code = host["room_code"].as_str().unwrap().to_string();
        let (_, guest) = join_room(&code, r#"{"name":"Guest"}"#, &rooms).unwrap();
        let (_, other) = join_room(&code, r#"{"name":"Other"}"#, &rooms).unwrap();
        start_room(&code, host["player_token"].as_str(), &rooms).unwrap();
        leave_room(
            &code,
            &guest["player_id"].as_u64().unwrap().to_string(),
            guest["player_token"].as_str(),
            &rooms,
        )
        .unwrap();

        let (_, view) = view_room(&code, host["player_token"].as_str(), &rooms).unwrap();
        assert_eq!(view["ai_count"], 1);
        assert_eq!(
            view["snapshot"]["players"][1]["kind"],
            "garfield1993-ai-simple"
        );
        assert_eq!(view["snapshot"]["next_player"], 1);
        assert_eq!(view["snapshot"]["players"].as_array().unwrap().len(), 3);
        assert_eq!(other["player_id"], 2);
    }

    #[test]
    fn expired_human_deadline_resolves_a_move_without_waiting_for_a_client() {
        let rooms = new_store();
        let (_, host) = create_room(r#"{"name":"Host","max_players":3}"#, &rooms).unwrap();
        let code = host["room_code"].as_str().unwrap().to_string();
        let _ = join_room(&code, r#"{"name":"Guest"}"#, &rooms).unwrap();
        let _ = join_room(&code, r#"{"name":"Other"}"#, &rooms).unwrap();
        let (_subscriber_id, _receiver, _initial) =
            subscribe(&code, host["player_token"].as_str().unwrap(), &rooms).unwrap();
        start_room(&code, host["player_token"].as_str(), &rooms).unwrap();

        let mut all_rooms = rooms.lock().unwrap();
        let room = all_rooms.get_mut(&code).unwrap();
        room.turn_deadline = Some(now() - Duration::from_secs(1));
        assert!(advance_automatic_turns(room));
        let snapshot =
            serde_json::from_str::<Value>(&room.game.as_ref().unwrap().snapshot_json()).unwrap();
        assert!(snapshot["last_action"]
            .as_str()
            .unwrap()
            .starts_with("player-0-"));
    }

    #[test]
    fn started_host_leave_is_taken_over_by_ai_and_host_role_transfers() {
        let rooms = new_store();
        let (_, host) = create_room(r#"{"name":"Host","max_players":3}"#, &rooms).unwrap();
        let code = host["room_code"].as_str().unwrap().to_string();
        let (_, guest) = join_room(&code, r#"{"name":"Guest"}"#, &rooms).unwrap();
        let _ = join_room(&code, r#"{"name":"Other"}"#, &rooms).unwrap();
        start_room(&code, host["player_token"].as_str(), &rooms).unwrap();
        leave_room(&code, "0", host["player_token"].as_str(), &rooms).unwrap();

        let (_, view) = view_room(&code, guest["player_token"].as_str(), &rooms).unwrap();
        assert_eq!(
            view["snapshot"]["players"][0]["kind"],
            "garfield1993-ai-simple"
        );
        assert_eq!(view["host_id"], guest["player_id"]);
        assert_eq!(view["ai_count"], 1);
    }

    #[test]
    fn websocket_disconnect_takes_over_started_human_and_reconnect_restores_control() {
        let rooms = new_store();
        let (_, host) = create_room(r#"{"name":"Host","max_players":3}"#, &rooms).unwrap();
        let code = host["room_code"].as_str().unwrap().to_string();
        let _ = join_room(&code, r#"{"name":"Guest"}"#, &rooms).unwrap();
        let _ = join_room(&code, r#"{"name":"Other"}"#, &rooms).unwrap();
        start_room(&code, host["player_token"].as_str(), &rooms).unwrap();

        let (subscriber_id, _receiver, _initial) =
            subscribe(&code, host["player_token"].as_str().unwrap(), &rooms).unwrap();
        unsubscribe(&code, subscriber_id, &rooms);

        let (_, disconnected) = view_room(&code, host["player_token"].as_str(), &rooms).unwrap();
        assert_eq!(
            disconnected["snapshot"]["players"][0]["kind"],
            "garfield1993-ai-simple"
        );

        let (_subscriber_id, _receiver, _initial) =
            subscribe(&code, host["player_token"].as_str().unwrap(), &rooms).unwrap();
        let (_, reconnected) = view_room(&code, host["player_token"].as_str(), &rooms).unwrap();
        assert_eq!(reconnected["snapshot"]["players"][0]["kind"], "human");
    }

    #[test]
    fn started_room_uses_websocket_liveness_then_three_minute_disconnect_grace() {
        let rooms = new_store();
        let (_, host) = create_room(r#"{"name":"Host","max_players":3}"#, &rooms).unwrap();
        let code = host["room_code"].as_str().unwrap().to_string();
        let _ = join_room(&code, r#"{"name":"Guest"}"#, &rooms).unwrap();
        let _ = join_room(&code, r#"{"name":"Other"}"#, &rooms).unwrap();
        start_room(&code, host["player_token"].as_str(), &rooms).unwrap();

        let (subscriber_id, _receiver, _initial) =
            subscribe(&code, host["player_token"].as_str().unwrap(), &rooms).unwrap();
        let (_, connected) = view_room(&code, host["player_token"].as_str(), &rooms).unwrap();
        assert!(connected["expires_in_seconds"].is_null());

        unsubscribe(&code, subscriber_id, &rooms);
        let (_, disconnected) = view_room(&code, host["player_token"].as_str(), &rooms).unwrap();
        let grace = disconnected["expires_in_seconds"].as_u64().unwrap();
        assert!(grace <= 180 && grace > 0);
    }

    #[test]
    fn daily_state_cleanup_removes_records_older_than_six_hours() {
        let rooms = new_store();
        let (_, created) = create_room(r#"{"name":"Stale","max_players":3}"#, &rooms).unwrap();
        let code = created["room_code"].as_str().unwrap().to_string();
        LAST_MAINTENANCE_DAY.store(0, Ordering::Relaxed);
        rooms.lock().unwrap().get_mut(&code).unwrap().last_activity =
            now() - STATE_RETENTION - Duration::from_secs(1);

        let mut all_rooms = rooms.lock().unwrap();
        daily_state_cleanup(&mut all_rooms);
        assert!(!all_rooms.contains_key(&code));
    }
}
