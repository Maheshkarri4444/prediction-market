use anchor_lang::prelude::*;

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
}

#[account]
pub struct Market {
    pub id: u64,

    pub question_type: QuestionType,
    pub question: String,

    pub yes_mint: Pubkey,
    pub no_mint: Pubkey,

    pub yes_pool: Pubkey,
    pub no_pool: Pubkey,

    pub yes_virtual_pool_amount: u64,
    pub no_virtual_pool_amount: u64,

    pub yes_pool_amount: u64,
    pub no_pool_amount: u64,

    pub market_end_time: u64,

    pub resolved: bool,
    pub outcome: Option<bool>,

    pub bump: u8,
}

impl Market {
    pub const LEN: usize = 245 + MAX_STRING as usize;
}
