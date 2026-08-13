mod http;
mod room;
mod websocket;

use room::SharedRooms;
use std::net::TcpListener;
use std::sync::Arc;
use std::thread;
use std::time::Duration;

fn main() -> std::io::Result<()> {
    let address = std::env::var("UNO_SERVER_ADDR").unwrap_or_else(|_| "127.0.0.1:8787".to_string());
    let rooms: SharedRooms = room::new_store();
    let scheduler_rooms = Arc::clone(&rooms);
    thread::spawn(move || loop {
        thread::sleep(Duration::from_millis(250));
        room::scheduler_tick(&scheduler_rooms);
    });

    let listener = TcpListener::bind(&address)?;
    println!("UNO 2026 room server listening on {address}");
    for stream in listener.incoming() {
        match stream {
            Ok(stream) => {
                let rooms = Arc::clone(&rooms);
                thread::spawn(move || {
                    if let Err(error) = http::handle_connection(stream, &rooms) {
                        eprintln!("connection error: {error}");
                    }
                });
            }
            Err(error) => eprintln!("accept error: {error}"),
        }
    }
    Ok(())
}
