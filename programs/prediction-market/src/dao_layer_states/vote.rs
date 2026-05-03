use anchor_lang::prelude::*;

#[account]
pub struct Vote {
    pub voter: Pubkey,
    pub market: Pubkey,
    pub option_id: u8,
    pub stake_voted: u64,
    pub stake_claimed: bool,
    pub bump: u8,
}

impl Vote {
    pub const LEN: usize = 75;
}
