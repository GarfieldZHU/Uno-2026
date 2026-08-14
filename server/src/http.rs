use crate::room::{
    self, HandlerResult, SharedRooms, DISCONNECTED_ROOM_TTL, ROOM_TTL, STATE_RETENTION,
};
use crate::websocket;
use std::io::{self, Read, Write};
use std::net::TcpStream;

struct Request {
    method: String,
    target: String,
    headers: String,
    body: String,
}

pub fn handle_connection(mut stream: TcpStream, rooms: &SharedRooms) -> io::Result<()> {
    let request = read_request(&mut stream)?;
    if request.method.is_empty() {
        return Ok(());
    }
    let (path, query) = split_target(&request.target);
    if request.method == "GET" && path.ends_with("/ws") && is_websocket_upgrade(&request.headers) {
        let segments = path.trim_matches('/').split('/').collect::<Vec<_>>();
        if let ["api", "v1", "rooms", code, "ws"] = segments.as_slice() {
            let token = query_value(query, "token")
                .or_else(|| header_value(&request.headers, "x-player-token").map(str::to_owned))
                .unwrap_or_default();
            let key = header_value(&request.headers, "sec-websocket-key").unwrap_or_default();
            return websocket::handle_upgrade(stream, code, &token, &key, rooms);
        }
    }
    if request.method == "OPTIONS" {
        return send_json(&mut stream, "204 No Content", serde_json::json!({}));
    }
    if request.method == "GET" && path == "/health" {
        return send_json(
            &mut stream,
            "200 OK",
            serde_json::json!({
                "status": "ok",
                "mode": "rooms",
                "transport": "rest+websocket",
                "room_ttl_seconds": ROOM_TTL.as_secs(),
                "disconnect_grace_seconds": DISCONNECTED_ROOM_TTL.as_secs(),
                "state_retention_seconds": STATE_RETENTION.as_secs(),
                "state_store": "in-memory"
            }),
        );
    }

    let token = header_value(&request.headers, "x-player-token");
    let segments = path.trim_matches('/').split('/').collect::<Vec<_>>();
    let result: HandlerResult = match (request.method.as_str(), segments.as_slice()) {
        ("POST", ["api", "v1", "rooms"]) => room::create_room(&request.body, rooms),
        ("POST", ["api", "v1", "rooms", code, "players"]) => {
            room::join_room(code, &request.body, rooms)
        }
        ("DELETE", ["api", "v1", "rooms", code, "players", player_id]) => {
            room::leave_room(code, player_id, token, rooms)
        }
        ("POST", ["api", "v1", "rooms", code, "start"]) => room::start_room(code, token, rooms),
        ("GET", ["api", "v1", "rooms", code]) => room::view_room(code, token, rooms),
        ("POST", ["api", "v1", "rooms", code, "actions"]) => {
            room::action_room(code, token, &request.body, rooms)
        }
        _ => Err(("404 Not Found", serde_json::json!({ "error": "not-found" }))),
    };
    let (status, body) = result.unwrap_or_else(|response| response);
    send_json(&mut stream, status, body)
}

fn read_request(stream: &mut TcpStream) -> io::Result<Request> {
    let mut buffer = Vec::with_capacity(16 * 1024);
    let mut chunk = [0_u8; 4096];
    let header_end;
    loop {
        let count = stream.read(&mut chunk)?;
        if count == 0 {
            return Ok(Request {
                method: String::new(),
                target: String::new(),
                headers: String::new(),
                body: String::new(),
            });
        }
        buffer.extend_from_slice(&chunk[..count]);
        if let Some(index) = buffer.windows(4).position(|part| part == b"\r\n\r\n") {
            header_end = index + 4;
            break;
        }
        if buffer.len() > 128 * 1024 {
            return Ok(Request {
                method: String::new(),
                target: String::new(),
                headers: String::new(),
                body: String::new(),
            });
        }
    }
    let header_text = String::from_utf8_lossy(&buffer[..header_end - 4]).to_string();
    let content_length = header_value(&header_text, "content-length")
        .and_then(|value| value.parse::<usize>().ok())
        .unwrap_or(0);
    while buffer.len() < header_end + content_length {
        let count = stream.read(&mut chunk)?;
        if count == 0 {
            break;
        }
        buffer.extend_from_slice(&chunk[..count]);
    }
    let first_line = header_text.lines().next().unwrap_or_default();
    let mut parts = first_line.split_whitespace();
    let method = parts.next().unwrap_or_default().to_owned();
    let target = parts.next().unwrap_or("/").to_owned();
    let body =
        String::from_utf8_lossy(&buffer[header_end..buffer.len().min(header_end + content_length)])
            .to_string();
    Ok(Request {
        method,
        target,
        headers: header_text,
        body,
    })
}

fn split_target(target: &str) -> (&str, &str) {
    target.split_once('?').unwrap_or((target, ""))
}

pub(crate) fn header_value<'a>(headers: &'a str, name: &str) -> Option<&'a str> {
    headers.lines().find_map(|line| {
        let (key, value) = line.split_once(':')?;
        key.trim()
            .eq_ignore_ascii_case(name)
            .then_some(value.trim())
    })
}

fn query_value(query: &str, name: &str) -> Option<String> {
    query.split('&').find_map(|part| {
        let (key, value) = part.split_once('=')?;
        (key == name).then(|| percent_decode(value))
    })
}

fn percent_decode(value: &str) -> String {
    let bytes = value.as_bytes();
    let mut output = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'%' && index + 2 < bytes.len() {
            let high = (bytes[index + 1] as char).to_digit(16);
            let low = (bytes[index + 2] as char).to_digit(16);
            if let (Some(high), Some(low)) = (high, low) {
                output.push((high * 16 + low) as u8);
                index += 3;
                continue;
            }
        }
        output.push(if bytes[index] == b'+' {
            b' '
        } else {
            bytes[index]
        });
        index += 1;
    }
    String::from_utf8_lossy(&output).into_owned()
}

fn is_websocket_upgrade(headers: &str) -> bool {
    header_value(headers, "upgrade")
        .map(|value| value.eq_ignore_ascii_case("websocket"))
        .unwrap_or(false)
}

fn send_json(stream: &mut TcpStream, status: &str, body: serde_json::Value) -> io::Result<()> {
    let body = body.to_string();
    let response = format!(
        "HTTP/1.1 {status}\r\nContent-Type: application/json; charset=utf-8\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: GET,POST,DELETE,OPTIONS\r\nAccess-Control-Allow-Headers: Content-Type,X-Player-Token\r\nCache-Control: no-store\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
        body.len()
    );
    stream.write_all(response.as_bytes())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_websocket_token_from_query() {
        let (_, query) = split_target("/api/v1/rooms/ABCD/ws?token=p-hello%20world");
        assert_eq!(
            query_value(query, "token").as_deref(),
            Some("p-hello world")
        );
    }

    #[test]
    fn matches_upgrade_header_case_insensitively() {
        assert!(is_websocket_upgrade(
            "Upgrade: WebSocket\r\nConnection: Upgrade"
        ));
    }
}
