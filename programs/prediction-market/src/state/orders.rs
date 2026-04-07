use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Eq, PartialEq)]
pub enum Options {
    Yes,
    No,
}

#[account]
pub struct Order {
    pub buyer: Pubkey,

    pub market: Pubkey,
    pub option: Options,

    pub quantity: u64,

    pub token_account: Pubkey,

    pub time_stamp: i64,
}

impl Order {
    pub const LEN: usize = 81;
}
