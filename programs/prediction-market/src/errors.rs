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
}
