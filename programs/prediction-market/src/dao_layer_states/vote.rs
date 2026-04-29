use anchor_lang::prelude::*;

#[account]
pub struct Vote {
    pub voter: Pubkey,
    pub market: Pubkey,
    pub option_id: u8,
    pub bump: u8,
}

impl Vote {
    pub const LEN: usize = 66;
}
