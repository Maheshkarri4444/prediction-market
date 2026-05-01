use anchor_spl::associated_token::spl_associated_token_account::solana_program::native_token::LAMPORTS_PER_SOL;

pub const MAX_STRING: usize = 200;
pub const CREATION_FEE: u64 = (1 * LAMPORTS_PER_SOL as u64).checked_div(10).unwrap();

pub const DAO_USER_CREATION_FEE: u64 = (1 * LAMPORTS_PER_SOL as u64).checked_div(2).unwrap();

pub const RESOLVE_REWARD: u64 =
    CREATION_FEE as u64 - (1 * LAMPORTS_PER_SOL as u64).checked_div(40).unwrap() as u64;
pub const MAX_USER: usize = 30;
pub const MAX_OUTCOMES: usize = 5;

pub const QUARUM: u8 = 10; // min 10 % of the total stake to be voted on the market.
pub const WINNING_STAKE: u8 = 50; // min 50% voted stake should be on the winning side.

pub const PRECISION: u64 = 1_000_000;
