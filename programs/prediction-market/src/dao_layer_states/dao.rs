use anchor_lang::prelude::*;

#[account]
pub struct Dao {
    pub creator: Pubkey,
    pub vault: Pubkey, // it contains treasury
    pub total_events: u64,
    pub total_members: u64,
    pub dao_status: bool, // live after initialized.
    pub dao_stake_account: Pubkey,
    pub dao_total_stake: u64, // it contains all the stake users staked.
    pub stake_account_bump: u8,
    pub vault_bump: u8,
    pub bump: u8,
}

impl Dao {
    pub const LEN: usize = 156;
}
