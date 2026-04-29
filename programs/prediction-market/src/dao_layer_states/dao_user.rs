use anchor_lang::prelude::*;

use crate::MAX_USER;
#[account]
pub struct DaoUser {
    pub username: String,
    pub pubkey: Pubkey,
    pub nft_mint: Pubkey,
    pub total_actions: u64,
    pub total_votes: u64,
    pub user_stake_account: Pubkey,
    pub staked_amount: u64,
    pub stake_locked: bool,
    pub reputation: u64,
    pub stake_account_bump: u8,
    pub bump: u8,
}

impl DaoUser {
    pub const LEN: usize = MAX_USER as usize + 94 + 33 as usize;
}
