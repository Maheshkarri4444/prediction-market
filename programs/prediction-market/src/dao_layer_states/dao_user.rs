use anchor_lang::prelude::*;

use crate::MAX_USER;
#[account]
pub struct DaoUser {
    pub username: String,
    pub pubkey: Pubkey,
    pub nft_mint: Pubkey,
    pub total_actions: u64,
    pub total_votes: u64,
    pub total_stake: u64, // total stake in stake account including rewards and slashes,
    pub locked_amount: u64, // stake voted on some market , but not yet resolved.
    pub free_amount: u64, // stake free to vote or unstake.
    pub reputation: u64,
    pub bump: u8,
}

impl DaoUser {
    pub const LEN: usize = MAX_USER as usize + 94 + 33 as usize;
}
