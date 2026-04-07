use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Eq, PartialEq)]
pub enum Options {
    Yes,
    No,
}

#[account]
pub struct BuyShares {
    pub buyer: Pubkey,

    pub market: Pubkey,
    pub option: Options,

    pub quantity: u64,

    pub time: i64,
}

impl BuyShares {
    pub const LEN: usize = 81;
}
