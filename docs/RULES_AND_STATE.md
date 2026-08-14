# Rules and state

English | [中文](RULES_AND_STATE.zh-CN.md) · [Architecture](ARCHITECTURE.md)

## Deck

The implementation builds the classic 108-card shape:

- each of red, yellow, green, and blue has one zero;
- each color has two of numbers 1–9;
- each color has two `Skip`, two `Reverse`, and two `DrawTwo` cards;
- there are four `Wild` and four `WildDrawFour` cards.

Offline tables support three to eight seats. Seat zero is the human (`You`) and
the remaining seats use the selected AI profile; four seats is the default. Every
seat receives seven cards. The first discard is selected from the remaining
numeric cards so the table starts with an active color and no action effect. The
draw pile is recycled from the discard pile (keeping the top card) when it runs
out. `GameState::new` remains a four-seat compatibility constructor while
`new_with_player_count` bounds domain input to 3–8.

The per-seat 1–30 second AI pause is a React scheduling setting, not part of the
Rust snapshot or rules. It only makes AI turns readable; `ai_step` still decides
the move and advances the authoritative state.

## Legal moves

A card is legal when it is a wild card, matches the active color, or matches the
top card's kind. A `WildDrawFour` is legal only when the player has no non-wild
card matching the active color. Commands that arrive out of turn, after a win, or
while a draw penalty is pending are rejected with a JSON error response.

## Effects

| Card | Effect |
| --- | --- |
| Number | Advance one player |
| Skip | Skip the next player |
| Reverse | Flip direction; with two players, it behaves as a skip |
| DrawTwo | Next player draws two and loses the pending effect |
| Wild | Choose the next active color |
| WildDrawFour | Choose color; next player draws four |

The current table uses a non-stacking penalty: the player facing `+2` or `+4`
draws the pending number of cards. The UI presents the pending count as a
chain-style badge and animates the forced draw; that is presentation only and
does not change the authoritative non-stacking rules. Stacking can be added later
as an explicit ruleset rather than silently changing this behavior.

## Drawing

Drawing one card that is playable leaves the human on the same turn so the card
can be played. Drawing a non-playable card advances the turn. Drawing a pending
penalty consumes the penalty and advances the turn. This behavior is visible in
`GameState::draw_for_player` and should be covered before changing it.

## UNO call

Playing down to one card creates an `uno_pending` marker. The player must call
`call_uno` while still holding one card. If the next command resolves the marker
and the player did not call, two cards are drawn. AI turns call UNO automatically
after reaching one card; the human UI exposes a `CALL UNO` button.

## Snapshot privacy

The public snapshot includes the human hand and each player's hand count. AI card
contents are deliberately omitted. This is a UI/privacy contract, not a security
boundary for a malicious client; a future authoritative server must keep hidden
hands on the server.
