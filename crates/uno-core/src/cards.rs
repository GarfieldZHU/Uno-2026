use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub enum Color {
    Red,
    Yellow,
    Green,
    Blue,
    Wild,
}

impl Color {
    pub const PLAYABLE: [Color; 4] = [Color::Red, Color::Yellow, Color::Green, Color::Blue];

    pub fn from_wire(value: &str) -> Option<Self> {
        match value.to_ascii_lowercase().as_str() {
            "red" => Some(Self::Red),
            "yellow" => Some(Self::Yellow),
            "green" => Some(Self::Green),
            "blue" => Some(Self::Blue),
            "wild" => Some(Self::Wild),
            _ => None,
        }
    }

    pub fn wire(self) -> &'static str {
        match self {
            Self::Red => "red",
            Self::Yellow => "yellow",
            Self::Green => "green",
            Self::Blue => "blue",
            Self::Wild => "wild",
        }
    }
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub enum CardKind {
    Number(u8),
    Skip,
    Reverse,
    DrawTwo,
    Wild,
    WildDrawFour,
}

impl CardKind {
    pub fn wire(&self) -> String {
        match self {
            Self::Number(value) => format!("number-{value}"),
            Self::Skip => "skip".to_string(),
            Self::Reverse => "reverse".to_string(),
            Self::DrawTwo => "draw-two".to_string(),
            Self::Wild => "wild".to_string(),
            Self::WildDrawFour => "wild-draw-four".to_string(),
        }
    }

    pub fn label(&self) -> String {
        match self {
            Self::Number(value) => value.to_string(),
            Self::Skip => "SKIP".to_string(),
            Self::Reverse => "↻".to_string(),
            Self::DrawTwo => "+2".to_string(),
            Self::Wild => "WILD".to_string(),
            Self::WildDrawFour => "+4".to_string(),
        }
    }
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct Card {
    pub id: u16,
    pub color: Color,
    pub kind: CardKind,
}

impl Card {
    pub fn number(id: u16, color: Color, value: u8) -> Self {
        Self {
            id,
            color,
            kind: CardKind::Number(value),
        }
    }

    pub fn wild_draw_four(id: u16) -> Self {
        Self {
            id,
            color: Color::Wild,
            kind: CardKind::WildDrawFour,
        }
    }

    pub fn is_wild(&self) -> bool {
        matches!(self.kind, CardKind::Wild | CardKind::WildDrawFour)
    }

    pub fn same_symbol(&self, other: &Self) -> bool {
        self.kind == other.kind
    }
}
