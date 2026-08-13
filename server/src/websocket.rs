use crate::room::{self, SharedRooms};
use std::io::{self, Read, Write};
use std::net::TcpStream;
use std::sync::mpsc::{Receiver, RecvTimeoutError};
use std::time::Duration;

const WEBSOCKET_GUID: &[u8] = b"258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

pub fn handle_upgrade(
    mut stream: TcpStream,
    code: &str,
    token: &str,
    key: &str,
    rooms: &SharedRooms,
) -> io::Result<()> {
    if key.is_empty() || token.is_empty() {
        return send_http_error(&mut stream, "401 Unauthorized", "websocket-token-required");
    }
    let (subscriber_id, receiver, initial) = match room::subscribe(code, token, rooms) {
        Ok(value) => value,
        Err((status, body)) => return send_http_error(&mut stream, status, &body.to_string()),
    };
    let mut accept_input = key.as_bytes().to_vec();
    accept_input.extend_from_slice(WEBSOCKET_GUID);
    let accept = base64_encode(&sha1_digest(&accept_input));
    let handshake = format!(
        "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: {accept}\r\n\r\n"
    );
    if let Err(error) = stream.write_all(handshake.as_bytes()) {
        room::unsubscribe(code, subscriber_id, rooms);
        return Err(error);
    }
    // Browser clients may send a masked keep-alive frame while the room thread
    // is publishing snapshots. Keep reads short so receiver updates are never
    // blocked behind a quiet socket.
    stream.set_read_timeout(Some(Duration::from_millis(250)))?;
    if let Err(error) = write_text_frame(&mut stream, &initial) {
        room::unsubscribe(code, subscriber_id, rooms);
        return Err(error);
    }

    let result = websocket_loop(&mut stream, &receiver);
    room::unsubscribe(code, subscriber_id, rooms);
    result
}

fn websocket_loop(stream: &mut TcpStream, receiver: &Receiver<String>) -> io::Result<()> {
    loop {
        match read_client_frame(stream)? {
            Some(Frame::Close) => return Ok(()),
            Some(Frame::Ping(payload)) => write_control_frame(stream, 0xA, &payload)?,
            Some(Frame::Text) | Some(Frame::Pong) => {}
            None => {}
        }
        match receiver.recv_timeout(Duration::from_millis(250)) {
            Ok(message) => write_text_frame(stream, &message)?,
            Err(RecvTimeoutError::Timeout) => {}
            Err(RecvTimeoutError::Disconnected) => return Ok(()),
        }
    }
}

enum Frame {
    Text,
    Ping(Vec<u8>),
    Pong,
    Close,
}

fn read_client_frame(stream: &mut TcpStream) -> io::Result<Option<Frame>> {
    let mut header = [0_u8; 2];
    match stream.read_exact(&mut header) {
        Ok(()) => {}
        Err(error)
            if matches!(
                error.kind(),
                io::ErrorKind::WouldBlock | io::ErrorKind::TimedOut
            ) =>
        {
            return Ok(None)
        }
        Err(error) if error.kind() == io::ErrorKind::UnexpectedEof => {
            return Ok(Some(Frame::Close));
        }
        Err(error) if error.kind() == io::ErrorKind::ConnectionReset => {
            return Ok(Some(Frame::Close));
        }
        Err(error) => return Err(error),
    }
    let opcode = header[0] & 0x0F;
    let masked = header[1] & 0x80 != 0;
    let mut length = u64::from(header[1] & 0x7F);
    if length == 126 {
        let mut extended = [0_u8; 2];
        stream.read_exact(&mut extended)?;
        length = u64::from(u16::from_be_bytes(extended));
    } else if length == 127 {
        let mut extended = [0_u8; 8];
        stream.read_exact(&mut extended)?;
        length = u64::from_be_bytes(extended);
    }
    if length > 1024 * 1024 {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "websocket-frame-too-large",
        ));
    }
    if !masked {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "client-websocket-frame-must-be-masked",
        ));
    }
    let mut mask = [0_u8; 4];
    stream.read_exact(&mut mask)?;
    let mut payload = vec![0_u8; length as usize];
    stream.read_exact(&mut payload)?;
    for (index, byte) in payload.iter_mut().enumerate() {
        *byte ^= mask[index % 4];
    }
    Ok(Some(match opcode {
        0x1 => Frame::Text,
        0x8 => Frame::Close,
        0x9 => Frame::Ping(payload),
        0xA => Frame::Pong,
        _ => Frame::Pong,
    }))
}

fn write_text_frame(stream: &mut TcpStream, text: &str) -> io::Result<()> {
    write_frame(stream, 0x1, text.as_bytes())
}

fn write_control_frame(stream: &mut TcpStream, opcode: u8, payload: &[u8]) -> io::Result<()> {
    write_frame(stream, opcode, payload)
}

fn write_frame(stream: &mut TcpStream, opcode: u8, payload: &[u8]) -> io::Result<()> {
    let mut frame = Vec::with_capacity(payload.len() + 10);
    frame.push(0x80 | opcode);
    match payload.len() {
        length @ 0..=125 => frame.push(length as u8),
        length @ 126..=65_535 => {
            frame.push(126);
            frame.extend_from_slice(&(length as u16).to_be_bytes());
        }
        length => {
            frame.push(127);
            frame.extend_from_slice(&(length as u64).to_be_bytes());
        }
    }
    frame.extend_from_slice(payload);
    stream.write_all(&frame)
}

fn send_http_error(stream: &mut TcpStream, status: &str, message: &str) -> io::Result<()> {
    let body = serde_json::json!({ "error": message }).to_string();
    let response = format!(
        "HTTP/1.1 {status}\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
        body.len()
    );
    stream.write_all(response.as_bytes())
}

fn sha1_digest(input: &[u8]) -> [u8; 20] {
    let mut message = input.to_vec();
    let bit_length = (message.len() as u64) * 8;
    message.push(0x80);
    while message.len() % 64 != 56 {
        message.push(0);
    }
    message.extend_from_slice(&bit_length.to_be_bytes());

    let mut h0 = 0x67452301_u32;
    let mut h1 = 0xEFCDAB89_u32;
    let mut h2 = 0x98BADCFE_u32;
    let mut h3 = 0x10325476_u32;
    let mut h4 = 0xC3D2E1F0_u32;

    for chunk in message.chunks_exact(64) {
        let mut words = [0_u32; 80];
        for (index, bytes) in chunk.chunks_exact(4).enumerate() {
            words[index] = u32::from_be_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]);
        }
        for index in 16..80 {
            words[index] =
                (words[index - 3] ^ words[index - 8] ^ words[index - 14] ^ words[index - 16])
                    .rotate_left(1);
        }
        let (mut a, mut b, mut c, mut d, mut e) = (h0, h1, h2, h3, h4);
        for (index, word) in words.iter().enumerate() {
            let (function, constant) = match index {
                0..=19 => ((b & c) | ((!b) & d), 0x5A827999),
                20..=39 => (b ^ c ^ d, 0x6ED9EBA1),
                40..=59 => ((b & c) | (b & d) | (c & d), 0x8F1BBCDC),
                _ => (b ^ c ^ d, 0xCA62C1D6),
            };
            let temp = a
                .rotate_left(5)
                .wrapping_add(function)
                .wrapping_add(e)
                .wrapping_add(constant)
                .wrapping_add(*word);
            e = d;
            d = c;
            c = b.rotate_left(30);
            b = a;
            a = temp;
        }
        h0 = h0.wrapping_add(a);
        h1 = h1.wrapping_add(b);
        h2 = h2.wrapping_add(c);
        h3 = h3.wrapping_add(d);
        h4 = h4.wrapping_add(e);
    }

    let mut digest = [0_u8; 20];
    for (index, value) in [h0, h1, h2, h3, h4].into_iter().enumerate() {
        digest[index * 4..index * 4 + 4].copy_from_slice(&value.to_be_bytes());
    }
    digest
}

fn base64_encode(input: &[u8]) -> String {
    const ALPHABET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut output = String::with_capacity(input.len().div_ceil(3) * 4);
    for chunk in input.chunks(3) {
        let first = chunk[0] as u32;
        let second = chunk.get(1).copied().unwrap_or(0) as u32;
        let third = chunk.get(2).copied().unwrap_or(0) as u32;
        let triple = (first << 16) | (second << 8) | third;
        output.push(ALPHABET[((triple >> 18) & 63) as usize] as char);
        output.push(ALPHABET[((triple >> 12) & 63) as usize] as char);
        output.push(if chunk.len() > 1 {
            ALPHABET[((triple >> 6) & 63) as usize] as char
        } else {
            '='
        });
        output.push(if chunk.len() > 2 {
            ALPHABET[(triple & 63) as usize] as char
        } else {
            '='
        });
    }
    output
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sha1_and_accept_key_match_rfc_example() {
        assert_eq!(
            base64_encode(&sha1_digest(
                b"dGhlIHNhbXBsZSBub25jZQ==258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
            )),
            "s3pPLMBiTxaQ9kYGzzhZRbK+xOo="
        );
    }

    #[test]
    fn base64_encodes_short_values() {
        assert_eq!(base64_encode(b"Man"), "TWFu");
        assert_eq!(base64_encode(b"Ma"), "TWE=");
        assert_eq!(base64_encode(b"M"), "TQ==");
    }
}
