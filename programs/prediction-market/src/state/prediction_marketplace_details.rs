use anchor_lang::prelude::*;
use anchor_spl::token::*;

#[account]
pub struct PredictionMarketPlaceDetails {
    pub creator: Pubkey,
    pub total_markets: u64,
    pub total_resolved: u64,
    pub vault: Pubkey,
    pub vault_bump: u8,
    pub bump: u8,
}

impl PredictionMarketPlaceDetails {
    pub const LEN: usize = 82;
}
