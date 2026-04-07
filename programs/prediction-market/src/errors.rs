use anchor_lang::prelude::*;

#[error_code]
pub enum PredictionMarketPlaceErrors {
    #[msg("Creator mismatch , Unauthorized!")]
    CreatorMismatch,

    #[msg("Vault has no funds")]
    NoFundsInVault,

    #[msg("length too long")]
    LengthTooLong,

    #[msg("Insufficent funds for Creation Fee")]
    InsufficientFundsForCreationFee,

    #[msg("Username too long")]
    UsernameTooLong,

    #[msg("Pool vault mismatch")]
    PoolVaultMismatch,

    #[msg("Selected pool amount should be less than total pool")]
    InvalidValues,

    #[msg("Math overflow")]
    MathOverflow,

    #[msg("Insufficient Funds to make this order")]
    InsufficientFundsForOrder,

    #[msg("Marked endtime reached")]
    MarketClosed,
}
