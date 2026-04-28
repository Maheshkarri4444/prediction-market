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

    #[msg("Market endtime reached")]
    MarketClosed,

    #[msg("Market not yet started")]
    MarketNotYetStarted,

    #[msg("Market Endtime not yet reached")]
    MarketEndtimeNotReached,

    #[msg("Fund transfer Error")]
    FundTransferError,

    #[msg("Insufficient Funds in prediction market treasury")]
    InsufficientFundsInTreasury,

    #[msg("Market not yet resolved")]
    MarketNotYetResolved,

    #[msg("Market already resolved")]
    AlreadyResolved,

    #[msg("No Outcome")]
    NoOutcome,

    #[msg("Price feed mismatch")]
    PriceFeedMismatch,

    #[msg("Price feed error")]
    PriceFeedError,

    #[msg("User donot hold these tokens")]
    NoTokensAvailable,

    #[msg("Not Tokens in the mint")]
    NoTokensInMint,

    #[msg("Options Out of Range")]
    OptionsOutOfRange,

    #[msg("Target time not yet reached")]
    TargetTimeNotYetReached,

    #[msg("Token Mint mismatch")]
    TokenMintMismatch,

    #[msg("Token Mint Not Found")]
    TokenMintNotFound,

    #[msg("Market Vault mismatch")]
    MarketVaultMismatch,

    #[msg("Invalid Option")]
    InvalidOption,

    #[msg("Invalid Price")]
    InvalidPrice,
}

#[error_code]
pub enum PredictionMarketDaoErrors {
    #[msg("User is not the creator of the Preidctiom market place")]
    CreatorMismatch,

    #[msg("Symbol length too long")]
    SymbolTooLong,

    #[msg("Metadata uri length too long")]
    UriTooLong,

    #[msg("NFT already minted")]
    NftAlreadyMinted,
}
