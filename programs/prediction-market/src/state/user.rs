use anchor_lang::prelude::*;

use crate::MAX_USER;

#[account]
pub struct User {
    pub username: String,
    pub pubkey: Pubkey,
    pub total_orders: u64,
    pub bump: u8,
}

impl User {
    pub const LEN: usize = 16 + MAX_USER as usize;
}
