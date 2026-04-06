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

    pub authority: Pubkey,

    pub question_type: QuestionType,
    pub question: String,

    pub yes_mint: Pubkey, // mint address of yes tokens for this market
    pub no_mint: Pubkey,  // mint address of no tokens for this market

    pub yes_pool_vault: Pubkey, // vault address of yes tokens for this market
    pub no_pool_vault: Pubkey,  // vault address of no tokens for this market

    pub yes_virtual_pool_amount: u64, // virtual amount (initially 10) , this is used to start the market at 0.5 per either yes/no share
    pub no_virtual_pool_amount: u64, // virtual amount (initially 10 (to reduce early price volatility and prevent large price swings from small initial trades)) , this is used to start the market at 0.5 per either yes/no share

    pub yes_pool_amount: u64, // amount of sol in yes vault
    pub no_pool_amount: u64,  // amount of sol in no vault

    pub market_end_time: i64, // people can bid upto this time (must be less than target time)

    pub resolved: bool,
    pub outcome: Option<bool>,

    pub yes_pool_vault_bump: u8,
    pub no_pool_vault_bump: u8,
    pub bump: u8,
}

impl Market {
    pub const LEN: usize = 279 + MAX_STRING as usize;
}
