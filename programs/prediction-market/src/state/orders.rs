use anchor_lang::prelude::*;

#[account]
pub struct Order {
    pub buyer: Pubkey,

    pub market: Pubkey,
    pub option: u8,

    pub quantity: u64,

    pub token_account: Pubkey,

    pub time_stamp: i64,
}

impl Order {
    pub const LEN: usize = 128;
}
