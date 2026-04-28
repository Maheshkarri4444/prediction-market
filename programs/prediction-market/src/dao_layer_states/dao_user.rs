use anchor_lang::prelude::*;

use crate::MAX_USER;
#[account]
pub struct DaoUser {
    pub username: String,
    pub pubkey: Pubkey,
    pub nft_mint: Pubkey,
    pub total_actions: u64,
    pub token_balance: u64,
    pub reputation: u64,
    pub bump: u8,
}

impl DaoUser {
    pub const LEN: usize = MAX_USER as usize + 94;
}
