use anchor_spl::associated_token::spl_associated_token_account::solana_program::native_token::LAMPORTS_PER_SOL;

pub const MAX_STRING: usize = 200;
pub const CREATION_FEE: u64 = (1 * LAMPORTS_PER_SOL as u64).checked_div(10).unwrap();

pub const DAO_USER_CREATION_FEE: u64 = (1 * LAMPORTS_PER_SOL as u64).checked_div(2).unwrap();

pub const RESOLVE_REWARD: u64 =
    CREATION_FEE as u64 - (1 * LAMPORTS_PER_SOL as u64).checked_div(40).unwrap() as u64;
pub const MAX_USER: usize = 30;
pub const MAX_OUTCOMES: usize = 5;
