use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};

fn main() -> std::io::Result<()> {
    let address = std::env::var("UNO_SERVER_ADDR").unwrap_or_else(|_| "127.0.0.1:8787".to_string());
    let listener = TcpListener::bind(&address)?;
    println!("UNO 2026 server scaffold listening on {address}");
    for stream in listener.incoming() {
        match stream {
            Ok(stream) => {
                if let Err(error) = handle(stream) {
                    eprintln!("connection error: {error}");
                }
            }
            Err(error) => eprintln!("accept error: {error}"),
        }
    }
    Ok(())
}

fn handle(mut stream: TcpStream) -> std::io::Result<()> {
    let mut buffer = [0_u8; 4096];
    let bytes_read = stream.read(&mut buffer)?;
    let request = String::from_utf8_lossy(&buffer[..bytes_read]);
    let path = request
        .lines()
        .next()
        .and_then(|line| line.split_whitespace().nth(1))
        .unwrap_or("/");
    let (status, body) = match path {
        "/health" => ("200 OK", "{\"status\":\"ok\",\"mode\":\"protocol-scaffold\"}"),
        "/api/v1/rooms" => (
            "503 Service Unavailable",
            "{\"error\":\"multiplayer-disabled\",\"message\":\"Online rooms are reserved for a future release.\"}",
        ),
        _ => ("404 Not Found", "{\"error\":\"not-found\"}"),
    };
    let response = format!(
        "HTTP/1.1 {status}\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
        body.len()
    );
    stream.write_all(response.as_bytes())
}
