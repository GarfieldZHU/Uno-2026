use serde::{Deserialize, Serialize};

use crate::{ai, ai::AiDecision, cards::CardKind, AiProfile, Card, Color};

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub enum GameStatus {
    Playing,
    Won,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub enum PlayerKind {
    Human,
    Ai(AiProfile),
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct Player {
    pub id: usize,
    pub name: String,
    pub kind: PlayerKind,
    pub hand: Vec<Card>,
    pub uno_called: bool,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct SnapshotCard {
    pub id: u16,
    pub color: Color,
    pub kind: String,
    pub label: String,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct SnapshotPlayer {
    pub id: usize,
    pub name: String,
    pub kind: String,
    pub hand_count: usize,
    pub hand: Vec<SnapshotCard>,
    pub uno_called: bool,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct Snapshot {
    pub players: Vec<SnapshotPlayer>,
    pub current_player: usize,
    pub next_player: usize,
    pub direction: i8,
    pub active_color: Color,
    pub top_card: SnapshotCard,
    pub discard_cards: Vec<SnapshotCard>,
    pub draw_count: usize,
    pub discard_count: usize,
    pub pending_draw: u8,
    pub status: GameStatus,
    pub winner: Option<usize>,
    pub turn_number: u32,
    pub message: String,
    pub last_action: String,
    pub ai_profile: String,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct CommandResponse {
    pub ok: bool,
    pub error: Option<String>,
    pub snapshot: Snapshot,
}

pub struct GameState {
    players: Vec<Player>,
    draw_pile: Vec<Card>,
    discard_pile: Vec<Card>,
    current_player: usize,
    direction: i8,
    active_color: Color,
    pending_draw: u8,
    status: GameStatus,
    winner: Option<usize>,
    seed: u64,
    turn_number: u32,
    message: String,
    last_action: String,
    uno_pending: Option<usize>,
    ai_profile: AiProfile,
}

impl GameState {
    pub fn new(seed: u64, profile: AiProfile) -> Self {
        Self::new_with_player_count(seed, 4, profile)
    }

    pub fn new_with_player_count(seed: u64, player_count: usize, profile: AiProfile) -> Self {
        let player_count = player_count.clamp(3, 10);
        let mut draw_pile = build_deck();
        shuffle(&mut draw_pile, seed);
        const SEAT_NAMES: [&str; 10] = [
            "You", "Mika", "Nori", "Juno", "Kiki", "Olli", "Pika", "Rumi", "Sora", "Taro",
        ];
        let mut players = SEAT_NAMES[..player_count]
            .iter()
            .enumerate()
            .map(|(id, name)| Player {
                id,
                name: (*name).to_string(),
                kind: if id == 0 {
                    PlayerKind::Human
                } else {
                    PlayerKind::Ai(profile)
                },
                hand: Vec::with_capacity(7),
                uno_called: false,
            })
            .collect::<Vec<_>>();
        for _ in 0..7 {
            for player in &mut players {
                player
                    .hand
                    .push(draw_pile.pop().expect("standard deck has enough cards"));
            }
        }

        let number_index = draw_pile
            .iter()
            .position(|card| matches!(card.kind, CardKind::Number(_)))
            .expect("standard deck has number cards");
        let last = draw_pile.len() - 1;
        draw_pile.swap(number_index, last);
        let first = draw_pile.pop().expect("starting card exists");
        let active_color = first.color;
        Self {
            players,
            draw_pile,
            discard_pile: vec![first],
            current_player: 0,
            direction: 1,
            active_color,
            pending_draw: 0,
            status: GameStatus::Playing,
            winner: None,
            seed,
            turn_number: 1,
            message: "Your turn. Match the color or symbol.".to_string(),
            last_action: "table-ready".to_string(),
            uno_pending: None,
            ai_profile: profile,
        }
    }

    pub fn players(&self) -> &[Player] {
        &self.players
    }

    pub fn players_mut(&mut self) -> &mut [Player] {
        &mut self.players
    }

    /// Keep a disconnected seat in the turn ring while changing its control
    /// to AI. Clearing UNO state prevents a stale penalty from leaking into
    /// the replacement player's next action.
    pub fn replace_player_with_ai(&mut self, player_id: usize, profile: AiProfile) -> bool {
        let Some(player) = self.players.get_mut(player_id) else {
            return false;
        };
        player.kind = PlayerKind::Ai(profile);
        player.uno_called = false;
        if self.uno_pending == Some(player_id) {
            self.uno_pending = None;
        }
        true
    }

    pub fn top_card(&self) -> &Card {
        self.discard_pile
            .last()
            .expect("discard pile always has a top card")
    }

    pub fn total_cards(&self) -> usize {
        self.players.iter().map(|p| p.hand.len()).sum::<usize>()
            + self.draw_pile.len()
            + self.discard_pile.len()
    }

    pub fn next_player_id(&self, player_id: usize) -> usize {
        self.next_index(player_id)
    }

    pub fn is_playable(&self, player_id: usize, card: &Card) -> bool {
        if self.pending_draw > 0 || self.status != GameStatus::Playing {
            return false;
        }
        if card.kind == CardKind::WildDrawFour {
            return !self.players[player_id]
                .hand
                .iter()
                .any(|candidate| candidate.color == self.active_color && !candidate.is_wild());
        }
        card.is_wild() || card.color == self.active_color || card.same_symbol(self.top_card())
    }

    pub fn play_card(
        &mut self,
        player_id: usize,
        card_id: u16,
        chosen_color: Option<Color>,
    ) -> Result<String, String> {
        self.assert_turn(player_id)?;
        self.resolve_uno_penalty();
        if self.pending_draw > 0 {
            return Err("draw-pending: resolve the penalty before playing".to_string());
        }
        let index = self.players[player_id]
            .hand
            .iter()
            .position(|card| card.id == card_id)
            .ok_or_else(|| "card-not-in-hand".to_string())?;
        let card = self.players[player_id].hand[index].clone();
        if !self.is_playable(player_id, &card) {
            return Err("card-not-playable".to_string());
        }
        let selected_color = if card.is_wild() {
            chosen_color
                .filter(|color| Color::PLAYABLE.contains(color))
                .ok_or_else(|| "choose-a-color".to_string())?
        } else {
            card.color
        };

        self.players[player_id].hand.remove(index);
        self.discard_pile.push(card.clone());
        self.active_color = selected_color;
        self.last_action = format!("player-{player_id}-played-{}", card.kind.wire());
        self.message = if card.is_wild() {
            format!(
                "{} chose {}.",
                self.players[player_id].name,
                selected_color.wire()
            )
        } else {
            format!(
                "{} played {}.",
                self.players[player_id].name,
                card.kind.label()
            )
        };
        if self.players[player_id].hand.len() == 1 {
            self.players[player_id].uno_called = false;
            self.uno_pending = Some(player_id);
        } else {
            self.players[player_id].uno_called = false;
        }
        if self.players[player_id].hand.is_empty() {
            self.status = GameStatus::Won;
            self.winner = Some(player_id);
            self.message = format!("{} wins the table!", self.players[player_id].name);
            return Ok(self.snapshot_json());
        }

        match card.kind {
            CardKind::Skip => self.advance_turn_twice(),
            CardKind::Reverse => {
                if self.players.len() == 2 {
                    self.advance_turn_twice();
                } else {
                    self.direction *= -1;
                    self.advance_turn_once();
                }
            }
            CardKind::DrawTwo => {
                self.pending_draw = 2;
                self.advance_turn_once();
            }
            CardKind::WildDrawFour => {
                self.pending_draw = 4;
                self.advance_turn_once();
            }
            CardKind::Number(_) | CardKind::Wild => self.advance_turn_once(),
        }
        Ok(self.snapshot_json())
    }

    pub fn draw_for_player(&mut self, player_id: usize) -> Result<String, String> {
        self.assert_turn(player_id)?;
        self.resolve_uno_penalty();
        if self.status != GameStatus::Playing {
            return Err("game-over".to_string());
        }
        let count = if self.pending_draw > 0 {
            self.pending_draw
        } else {
            1
        };
        self.pending_draw = 0;
        let mut drawn = Vec::new();
        for _ in 0..count {
            if let Some(card) = self.draw_one() {
                drawn.push(card);
            }
        }
        if drawn.is_empty() {
            return Err("draw-pile-empty".to_string());
        }
        let can_play_drawn = count == 1 && self.is_playable(player_id, drawn.last().unwrap());
        self.players[player_id].hand.extend(drawn);
        self.last_action = format!("player-{player_id}-drew-{count}");
        self.message = if count > 1 {
            format!("{} draws {count} cards.", self.players[player_id].name)
        } else if can_play_drawn {
            "You drew a playable card. Play it or pass.".to_string()
        } else {
            format!("{} draws a card.", self.players[player_id].name)
        };
        if !can_play_drawn {
            self.advance_turn_once();
        }
        Ok(self.snapshot_json())
    }

    pub fn call_uno(&mut self, player_id: usize) -> Result<String, String> {
        let player = self
            .players
            .get_mut(player_id)
            .ok_or_else(|| "player-not-found".to_string())?;
        if player.hand.len() != 1 || self.uno_pending != Some(player_id) {
            return Err("uno-not-available".to_string());
        }
        player.uno_called = true;
        self.last_action = format!("player-{player_id}-called-uno");
        self.message = format!("{} called UNO!", player.name);
        Ok(self.snapshot_json())
    }

    pub fn ai_step(&mut self, profile: AiProfile) -> String {
        if self.status != GameStatus::Playing
            || self.players[self.current_player].kind == PlayerKind::Human
        {
            return self.snapshot_json();
        }
        let player_id = self.current_player;
        let result = match ai::choose_move(self, player_id, profile) {
            AiDecision::Play {
                card_id,
                chosen_color,
            } => self.play_card(player_id, card_id, Some(chosen_color)),
            AiDecision::Draw => self.draw_for_player(player_id),
        };
        if self.players[player_id].hand.len() == 1 && !self.players[player_id].uno_called {
            let _ = self.call_uno(player_id);
        }
        result.unwrap_or_else(|error| self.error_json(error))
    }

    /// Resolve a human turn that expired on the room server. The choice is
    /// intentionally pseudo-random but deterministic for replayability: play
    /// a random legal card when one exists, otherwise draw the required card
    /// count. This never changes the normal human/WASM interaction path.
    pub fn timeout_step(&mut self, player_id: usize) -> String {
        if self.status != GameStatus::Playing || player_id != self.current_player {
            return self.snapshot_json();
        }
        self.seed = self
            .seed
            .wrapping_mul(6364136223846793005)
            .wrapping_add(1442695040888963407);
        let legal = self.players[player_id]
            .hand
            .iter()
            .filter(|card| self.is_playable(player_id, card))
            .map(|card| card.id)
            .collect::<Vec<_>>();
        let result = if let Some(card_id) = legal.get((self.seed as usize) % legal.len().max(1)) {
            let chosen_color = if self.players[player_id]
                .hand
                .iter()
                .find(|card| card.id == *card_id)
                .map(|card| card.is_wild())
                .unwrap_or(false)
            {
                Color::PLAYABLE[(self.seed.rotate_left(11) as usize) % Color::PLAYABLE.len()]
            } else {
                Color::Red
            };
            self.play_card(player_id, *card_id, Some(chosen_color))
        } else {
            self.draw_for_player(player_id)
        };
        result.unwrap_or_else(|error| self.error_json(error))
    }

    pub fn snapshot_json(&self) -> String {
        self.snapshot_json_for(0)
    }

    /// Serialize a snapshot for a specific viewer. Only that viewer's hand is
    /// included; every other hand remains count-only for online play.
    pub fn snapshot_json_for(&self, viewer_id: usize) -> String {
        serde_json::to_string(&self.snapshot_for(viewer_id))
            .expect("snapshot serialization cannot fail")
    }

    pub fn error_json(&self, error: String) -> String {
        self.error_json_for(0, error)
    }

    pub fn error_json_for(&self, viewer_id: usize, error: String) -> String {
        serde_json::to_string(&CommandResponse {
            ok: false,
            error: Some(error),
            snapshot: self.snapshot_for(viewer_id),
        })
        .expect("error serialization cannot fail")
    }

    fn snapshot_for(&self, viewer_id: usize) -> Snapshot {
        Snapshot {
            players: self
                .players
                .iter()
                .map(|player| SnapshotPlayer {
                    id: player.id,
                    name: player.name.clone(),
                    kind: match player.kind {
                        PlayerKind::Human => "human".to_string(),
                        PlayerKind::Ai(profile) => profile.wire().to_string(),
                    },
                    hand_count: player.hand.len(),
                    hand: if player.id == viewer_id {
                        player.hand.iter().map(SnapshotCard::from).collect()
                    } else {
                        Vec::new()
                    },
                    uno_called: player.uno_called,
                })
                .collect(),
            current_player: self.current_player,
            next_player: self.next_index(self.current_player),
            direction: self.direction,
            active_color: self.active_color,
            top_card: SnapshotCard::from(self.top_card()),
            discard_cards: self.discard_pile.iter().map(SnapshotCard::from).collect(),
            draw_count: self.draw_pile.len(),
            discard_count: self.discard_pile.len(),
            pending_draw: self.pending_draw,
            status: self.status,
            winner: self.winner,
            turn_number: self.turn_number,
            message: self.message.clone(),
            last_action: self.last_action.clone(),
            ai_profile: self.ai_profile.wire().to_string(),
        }
    }

    fn assert_turn(&self, player_id: usize) -> Result<(), String> {
        if self.status != GameStatus::Playing {
            return Err("game-over".to_string());
        }
        if player_id != self.current_player {
            return Err("not-your-turn".to_string());
        }
        Ok(())
    }

    fn advance_turn_once(&mut self) {
        self.current_player = self.next_index(self.current_player);
        self.turn_number += 1;
    }

    fn advance_turn_twice(&mut self) {
        self.advance_turn_once();
        self.advance_turn_once();
    }

    fn next_index(&self, index: usize) -> usize {
        let len = self.players.len() as isize;
        ((index as isize + self.direction as isize).rem_euclid(len)) as usize
    }

    fn resolve_uno_penalty(&mut self) {
        let Some(player_id) = self.uno_pending.take() else {
            return;
        };
        if self.players[player_id].hand.len() == 1 && !self.players[player_id].uno_called {
            for _ in 0..2 {
                if let Some(card) = self.draw_one() {
                    self.players[player_id].hand.push(card);
                }
            }
            self.message = format!("{} missed UNO and draws 2.", self.players[player_id].name);
            self.last_action = format!("player-{player_id}-uno-penalty");
        }
    }

    fn draw_one(&mut self) -> Option<Card> {
        if self.draw_pile.is_empty() {
            if self.discard_pile.len() <= 1 {
                return None;
            }
            let top = self.discard_pile.pop().expect("top card exists");
            self.draw_pile.append(&mut self.discard_pile);
            self.discard_pile.push(top);
            self.seed = self.seed.wrapping_mul(6364136223846793005).wrapping_add(1);
            shuffle(&mut self.draw_pile, self.seed);
        }
        self.draw_pile.pop()
    }

    #[cfg(test)]
    pub fn set_active_color_for_test(&mut self, color: Color) {
        self.active_color = color;
    }

    #[cfg(test)]
    pub fn force_human_hand_for_test(&mut self, hand: Vec<Card>) {
        self.players[0].hand = hand;
        self.current_player = 0;
        self.status = GameStatus::Playing;
        self.winner = None;
        self.uno_pending = None;
    }
}

impl From<&Card> for SnapshotCard {
    fn from(card: &Card) -> Self {
        Self {
            id: card.id,
            color: card.color,
            kind: card.kind.wire(),
            label: card.kind.label(),
        }
    }
}

fn build_deck() -> Vec<Card> {
    let mut deck = Vec::with_capacity(108);
    let mut id = 0u16;
    for color in Color::PLAYABLE {
        deck.push(Card::number(id, color, 0));
        id += 1;
        for value in 1..=9 {
            deck.push(Card::number(id, color, value));
            id += 1;
            deck.push(Card::number(id, color, value));
            id += 1;
        }
        for kind in [CardKind::Skip, CardKind::Reverse, CardKind::DrawTwo] {
            deck.push(Card {
                id,
                color,
                kind: kind.clone(),
            });
            id += 1;
            deck.push(Card { id, color, kind });
            id += 1;
        }
    }
    for _ in 0..4 {
        deck.push(Card {
            id,
            color: Color::Wild,
            kind: CardKind::Wild,
        });
        id += 1;
        deck.push(Card {
            id,
            color: Color::Wild,
            kind: CardKind::WildDrawFour,
        });
        id += 1;
    }
    deck
}

fn shuffle(cards: &mut [Card], mut seed: u64) {
    for index in (1..cards.len()).rev() {
        seed ^= seed << 13;
        seed ^= seed >> 7;
        seed ^= seed << 17;
        let swap_index = (seed as usize) % (index + 1);
        cards.swap(index, swap_index);
    }
}
