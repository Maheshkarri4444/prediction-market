use anchor_lang::prelude::*;

#[account]
pub struct Dao {
    pub creator: Pubkey,
    pub token_mint: Pubkey,
    pub vault: Pubkey,
    pub total_events: u64,
    pub total_members: u64,
    pub vault_bump: u8,
    pub bump: u8,
}

impl Dao {
    pub const LEN: usize = 114;
}
