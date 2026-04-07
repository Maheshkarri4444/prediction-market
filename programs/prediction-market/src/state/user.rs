use anchor_lang::prelude::*;

use crate::MAX_USER;

#[account]
pub struct User {
    pub username: String,
    pub total_interactions: u64,
    pub bump: u64,
}

impl User {
    pub const LEN: usize = 16 + MAX_USER as usize;
}
