mod ai;
mod cards;
mod state;

pub use ai::{AiDecision, AiProfile};
pub use cards::{Card, CardKind, Color};
pub use state::{CommandResponse, GameState, GameStatus, Player, PlayerKind, Snapshot};

use wasm_bindgen::prelude::*;

/// Browser-facing owner of the same deterministic game state used by native tests.
#[wasm_bindgen]
pub struct UnoGame {
    state: GameState,
    profile: AiProfile,
    player_count: usize,
}

#[wasm_bindgen]
impl UnoGame {
    #[wasm_bindgen(constructor)]
    pub fn new(seed: u32, profile: &str) -> UnoGame {
        Self::new_with_config(seed, profile, 4)
    }

    pub fn new_with_config(seed: u32, profile: &str, player_count: u8) -> UnoGame {
        let profile = AiProfile::from_wire(profile).unwrap_or(AiProfile::Garfield1993AiSimple);
        let player_count = (player_count as usize).clamp(3, 8);
        UnoGame {
            state: GameState::new_with_player_count(seed as u64, player_count, profile),
            profile,
            player_count,
        }
    }

    pub fn snapshot(&self) -> String {
        self.state.snapshot_json()
    }

    pub fn play_card(&mut self, card_id: u16, chosen_color: &str) -> String {
        let color = if chosen_color.is_empty() {
            None
        } else {
            Color::from_wire(chosen_color)
        };
        self.state
            .play_card(0, card_id, color)
            .unwrap_or_else(|error| self.state.error_json(error))
    }

    pub fn draw(&mut self) -> String {
        self.state
            .draw_for_player(0)
            .unwrap_or_else(|error| self.state.error_json(error))
    }

    pub fn call_uno(&mut self) -> String {
        self.state
            .call_uno(0)
            .unwrap_or_else(|error| self.state.error_json(error))
    }

    /// Advances one AI turn. The UI can call this between small delays to keep the
    /// opponent readable and still use exactly the native AI implementation.
    pub fn ai_step(&mut self) -> String {
        self.state.ai_step(self.profile)
    }

    pub fn restart(&mut self, seed: u32) -> String {
        self.state = GameState::new_with_player_count(seed as u64, self.player_count, self.profile);
        self.state.snapshot_json()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::PlayerKind;

    #[test]
    fn creates_a_standard_108_card_game_and_deals_seven() {
        let game = GameState::new(7, AiProfile::Garfield1993AiSimple);
        assert_eq!(game.total_cards(), 108);
        assert_eq!(game.players()[0].hand.len(), 7);
        assert_eq!(game.players()[1].hand.len(), 7);
        assert!(matches!(game.top_card().kind, CardKind::Number(_)));
    }

    #[test]
    fn same_number_or_color_is_playable_but_wrong_card_is_not() {
        let game = GameState::new(22, AiProfile::Garfield1993AiSimple);
        let hand = &game.players()[0].hand;
        let top = game.top_card();
        let legal = hand.iter().find(|card| game.is_playable(0, card)).unwrap();
        assert!(game.is_playable(0, legal));
        let wrong = hand.iter().find(|card| {
            !game.is_playable(0, card)
                && card.color != top.color
                && !card.is_wild()
                && !card.same_symbol(top)
        });
        assert!(wrong.is_some() || hand.iter().any(|card| card.is_wild()));
    }

    #[test]
    fn wild_draw_four_requires_no_card_of_active_color() {
        let mut game = GameState::new(42, AiProfile::Garfield1993AiHard);
        game.players_mut()[0].hand.clear();
        game.players_mut()[0]
            .hand
            .push(Card::number(900, Color::Red, 3));
        game.players_mut()[0].hand.push(Card::wild_draw_four(901));
        game.set_active_color_for_test(Color::Blue);
        let wild_draw_four = game.players()[0].hand[1].clone();
        assert!(game.is_playable(0, &wild_draw_four));

        game.players_mut()[0]
            .hand
            .push(Card::number(902, Color::Blue, 8));
        let wild_draw_four = game.players()[0].hand[1].clone();
        assert!(!game.is_playable(0, &wild_draw_four));
    }

    #[test]
    fn ai_profiles_always_return_a_legal_move_or_draw() {
        let game = GameState::new(99, AiProfile::Garfield1993AiHard);
        for profile in [
            AiProfile::Garfield1993AiSimple,
            AiProfile::Garfield1993AiHard,
            AiProfile::Uno2026AiEasy,
            AiProfile::Uno2026AiStrategist,
        ] {
            let decision = ai::choose_move(&game, 1, profile);
            if let AiDecision::Play { card_id, .. } = decision {
                let card = game.players()[1]
                    .hand
                    .iter()
                    .find(|card| card.id == card_id)
                    .unwrap();
                assert!(game.is_playable(1, card));
            }
        }
    }

    #[test]
    fn uno_call_prevents_the_two_card_penalty() {
        let mut game = GameState::new(11, AiProfile::Garfield1993AiSimple);
        game.force_human_hand_for_test(vec![
            Card::number(600, Color::Red, 0),
            Card::number(601, Color::Red, 1),
        ]);
        game.set_active_color_for_test(Color::Red);
        let card_id = game.players()[0].hand[0].id;
        game.play_card(0, card_id, None).unwrap();
        game.call_uno(0).unwrap();
        assert!(game.players()[0].uno_called);
        assert_eq!(game.players()[0].hand.len(), 1);
    }

    #[test]
    fn snapshot_is_stable_json_for_the_frontend_boundary() {
        let game = GameState::new(13, AiProfile::Uno2026AiStrategist);
        let snapshot: Snapshot = serde_json::from_str(&game.snapshot_json()).unwrap();
        assert_eq!(snapshot.players.len(), 4);
        assert_eq!(snapshot.players[0].hand.len(), 7);
        assert!(snapshot.players[1].hand.is_empty());
        assert_eq!(snapshot.draw_count + snapshot.discard_count, 80);
        assert_eq!(snapshot.discard_cards.len(), snapshot.discard_count);
        assert_eq!(
            snapshot.discard_cards.last().unwrap().id,
            snapshot.top_card.id
        );
    }

    #[test]
    fn supports_three_to_eight_player_tables_with_seven_card_hands() {
        for player_count in 3..=8 {
            let game = GameState::new_with_player_count(
                100 + player_count as u64,
                player_count,
                AiProfile::Garfield1993AiSimple,
            );
            assert_eq!(game.players().len(), player_count);
            assert!(game.players().iter().all(|player| player.hand.len() == 7));
            assert_eq!(game.total_cards(), 108);
            assert_eq!(game.players()[0].name, "You");
            assert!(game.players()[1..]
                .iter()
                .all(|player| matches!(player.kind, PlayerKind::Ai(_))));
        }
    }

    #[test]
    fn player_count_is_bounded_and_turns_wrap_at_the_last_seat() {
        let small = GameState::new_with_player_count(1, 1, AiProfile::Garfield1993AiHard);
        assert_eq!(small.players().len(), 3);
        let large = GameState::new_with_player_count(2, 99, AiProfile::Garfield1993AiHard);
        assert_eq!(large.players().len(), 8);
        assert_eq!(large.next_player_id(7), 0);
    }

    #[test]
    fn wasm_config_and_restart_preserve_the_selected_player_count() {
        let mut game = UnoGame::new_with_config(3, "garfield1993-ai-hard", 8);
        let initial: Snapshot = serde_json::from_str(&game.snapshot()).unwrap();
        assert_eq!(initial.players.len(), 8);
        let restarted: Snapshot = serde_json::from_str(&game.restart(4)).unwrap();
        assert_eq!(restarted.players.len(), 8);
    }
}
