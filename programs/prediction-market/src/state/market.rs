use anchor_lang::prelude::*;

use crate::MAX_OUTCOMES;
use crate::MAX_STRING;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Eq, PartialEq)]
pub enum QuestionType {
    GreaterThanAtTime {
        price_feed: Pubkey,
        target_price: i64,
        time: i64,
    },
    LessThanAtTime {
        price_feed: Pubkey,
        target_price: i64,
        time: i64,
    },

    RangeAtTime {
        price_feed: Pubkey,
        upper_bound: i64,
        lower_bound: i64,
        time: i64,
    },

    RangeOfPrice {
        price_feed: Pubkey,
        options: Vec<PriceOption>,
        time: i64,
    },
}

#[derive(Debug, AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub struct PriceOption {
    pub upper_bound: i64,
    pub lower_bound: i64,
}

#[account]
pub struct Market {
    pub id: u64,

    pub authority: Pubkey,

    pub question_type: QuestionType,
    pub question: String,
    pub num_outcomes: u8,

    pub outcomes: Vec<Outcome>,

    pub market_end_time: i64, // people can bid upto this time (must be less than target time)

    pub resolved: bool,
    pub outcome: Option<u8>, // for binary 0, 1 . and for options its multi choice like 0,1,2.

    pub bump: u8,
}

impl Market {
    pub const LEN: usize = 261 as usize
        + 4 as usize
        + MAX_STRING as usize
        + 4 as usize
        + (MAX_OUTCOMES as usize * 114 as usize) as usize;
}

#[derive(Debug, AnchorSerialize, AnchorDeserialize, PartialEq, Eq, Clone)]
pub struct Outcome {
    pub market: Pubkey,
    pub outcome_id: u8,
    pub mint: Pubkey,
    pub pool_vault: Pubkey,
    pub virtual_pool_amount: u64,
    pub pool_amount: u64,
    pub pool_vault_bump: u8,
}
