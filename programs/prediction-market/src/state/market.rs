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
        options: Vec<PriceOption>, // Maximum 5 options can be added
        time: i64,
    },

    PercentageUp {
        price_feed: Pubkey,
        percentage: u8,
        current_price: i64,
        time: i64,
    },

    PercentageDown {
        price_feed: Pubkey,
        percentage: u8,
        current_price: i64,
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
    pub num_options: u8,

    pub options: Vec<OptionDetails>,

    pub market_end_time: i64, // people can bid upto this time (must be less than target time)

    pub resolved: bool,
    pub started: bool,
    pub final_outcome: Option<u8>, // for binary 0, 1 . and for options its multi choice like 0,1,2.

    pub vault: Pubkey,
    pub vault_bump: u8,
    pub bump: u8,
}

impl Market {
    pub const LEN: usize = 262 as usize
        + 4 as usize
        + MAX_STRING as usize
        + 4 as usize
        + (MAX_OUTCOMES as usize * 114 as usize) as usize;
}

#[derive(Debug, AnchorSerialize, AnchorDeserialize, PartialEq, Eq, Clone)]
pub struct OptionDetails {
    pub market: Pubkey,
    pub option_id: u8,
    pub mint: Pubkey,
    pub virtual_pool_amount: u64,
    pub pool_amount: u64,
}

impl OptionDetails {
    pub fn new() -> OptionDetails {
        OptionDetails {
            market: Pubkey::default(),
            option_id: 0,
            mint: Pubkey::default(),
            virtual_pool_amount: 0,
            pool_amount: 0,
        }
    }
}
