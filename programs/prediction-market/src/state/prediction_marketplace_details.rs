use anchor_lang::prelude::*;
use anchor_spl::token::*;

#[account]
pub struct PredictionMarketPlaceDetails {
    pub creator: Pubkey,
    pub total_markets: u64,
    pub total_resolved: u64,
    pub vault: Pubkey,
}

impl PredictionMarketPlaceDetails {
    pub const LEN: usize = 80;
}
