use serde::{Deserialize, Serialize};

use crate::{cards::CardKind, state::GameState, Color};

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub enum AiProfile {
    Garfield1993AiSimple,
    Garfield1993AiHard,
    Uno2026AiEasy,
    Uno2026AiStrategist,
}

impl AiProfile {
    pub fn from_wire(value: &str) -> Option<Self> {
        match value {
            "garfield1993-ai-simple" => Some(Self::Garfield1993AiSimple),
            "garfield1993-ai-hard" => Some(Self::Garfield1993AiHard),
            "uno-2026-ai-easy" => Some(Self::Uno2026AiEasy),
            "uno-2026-ai-strategist" => Some(Self::Uno2026AiStrategist),
            _ => None,
        }
    }

    pub fn wire(self) -> &'static str {
        match self {
            Self::Garfield1993AiSimple => "garfield1993-ai-simple",
            Self::Garfield1993AiHard => "garfield1993-ai-hard",
            Self::Uno2026AiEasy => "uno-2026-ai-easy",
            Self::Uno2026AiStrategist => "uno-2026-ai-strategist",
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AiDecision {
    Play { card_id: u16, chosen_color: Color },
    Draw,
}

pub fn choose_move(game: &GameState, player_id: usize, profile: AiProfile) -> AiDecision {
    let legal = game.players()[player_id]
        .hand
        .iter()
        .filter(|card| game.is_playable(player_id, card))
        .collect::<Vec<_>>();
    if legal.is_empty() {
        return AiDecision::Draw;
    }

    let selected = match profile {
        AiProfile::Garfield1993AiSimple | AiProfile::Uno2026AiEasy => legal[0],
        AiProfile::Garfield1993AiHard | AiProfile::Uno2026AiStrategist => legal
            .into_iter()
            .max_by_key(|card| score_card(game, player_id, card, profile))
            .expect("legal cards are non-empty"),
    };

    let chosen_color = if selected.is_wild() {
        best_color(game, player_id, profile)
    } else {
        selected.color
    };
    AiDecision::Play {
        card_id: selected.id,
        chosen_color,
    }
}

fn score_card(game: &GameState, player_id: usize, card: &crate::Card, profile: AiProfile) -> i32 {
    let mut score = match card.kind {
        CardKind::Number(value) => value as i32,
        CardKind::Skip => 16,
        CardKind::Reverse => 13,
        CardKind::DrawTwo => 22,
        CardKind::Wild => 9,
        CardKind::WildDrawFour => 31,
    };
    let hand_size = game.players()[player_id].hand.len() as i32;
    if hand_size <= 3 {
        score += match card.kind {
            CardKind::DrawTwo | CardKind::WildDrawFour => 18,
            _ => 0,
        };
    }
    if profile == AiProfile::Uno2026AiStrategist {
        score += match card.kind {
            CardKind::Wild | CardKind::WildDrawFour => 4,
            CardKind::Reverse if game.players().len() == 2 => 8,
            _ => 0,
        };
        let next = game.next_player_id(player_id);
        if game.players()[next].hand.len() <= 2 {
            score += match card.kind {
                CardKind::Skip | CardKind::DrawTwo | CardKind::WildDrawFour => 20,
                _ => 0,
            };
        }
    }
    score - (card.color == Color::Wild) as i32
}

fn best_color(game: &GameState, player_id: usize, profile: AiProfile) -> Color {
    Color::PLAYABLE
        .into_iter()
        .max_by_key(|color| {
            let own = game.players()[player_id]
                .hand
                .iter()
                .filter(|card| card.color == *color)
                .count() as i32;
            let opponent_pressure = game
                .players()
                .iter()
                .enumerate()
                .filter(|(id, _)| *id != player_id)
                .map(|(_, player)| {
                    if player.hand.len() <= 2 {
                        -(player
                            .hand
                            .iter()
                            .filter(|card| card.color == *color)
                            .count() as i32)
                    } else {
                        0
                    }
                })
                .sum::<i32>();
            own * 10
                + opponent_pressure
                + if profile == AiProfile::Uno2026AiStrategist {
                    (3 - own).max(0)
                } else {
                    0
                }
        })
        .unwrap_or(Color::Red)
}
