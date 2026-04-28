use crate::PredictionMarketPlaceErrors;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, *};
use pyth_sdk_solana::state::SolanaPriceAccount;

pub fn calculate_price(selected_pool: u64, total_pool: u64) -> Result<u64> {
    require!(
        selected_pool <= total_pool && total_pool > 0,
        PredictionMarketPlaceErrors::InvalidValues
    );

    let price = selected_pool
        .checked_div(total_pool)
        .ok_or(PredictionMarketPlaceErrors::MathOverflow)?;

    Ok(price)
}

pub fn mint_tokens<'info>(
    mint: &Account<'info, Mint>,
    to: &Account<'info, TokenAccount>,
    authority: &AccountInfo<'info>,
    token_program: &Program<'info, Token>,
    signer_seeds: &[&[&[u8]]],
    amount: u64,
) -> Result<()> {
    token::mint_to(
        CpiContext::new_with_signer(
            token_program.to_account_info(),
            MintTo {
                mint: mint.to_account_info(),
                to: to.to_account_info(),
                authority: authority.clone(),
            },
            signer_seeds,
        ),
        amount,
    )?;
    Ok(())
}

pub fn get_normalized_price(
    price_feed_account: &AccountInfo,
    expected_pubkey: Pubkey,
    current_time: i64,
) -> Result<i64> {
    require!(
        price_feed_account.key() == expected_pubkey,
        PredictionMarketPlaceErrors::PriceFeedMismatch
    );

    let feed = SolanaPriceAccount::account_info_to_feed(price_feed_account).map_err(|_| {
        msg!("❌ Failed to parse price feed account");
        PredictionMarketPlaceErrors::PriceFeedError
    })?;

    let price_data = if let Some(price) = feed.get_price_no_older_than(current_time, 60) {
        msg!("✅ Using fresh Pyth price");
        price
    } else {
        msg!("⚠️ Using stale Pyth price (devnet fallback)");
        feed.get_price_unchecked()
    };

    let price = price_data.price;
    let expo = price_data.expo;

    // safer normalization
    let normalized_price = if expo < 0 {
        let divisor = 10_i64
            .checked_pow((-expo) as u32)
            .ok_or(PredictionMarketPlaceErrors::MathOverflow)?;

        price
            .checked_div(divisor)
            .ok_or(PredictionMarketPlaceErrors::MathOverflow)?
    } else {
        let multiplier = 10_i64
            .checked_pow(expo as u32)
            .ok_or(PredictionMarketPlaceErrors::MathOverflow)?;

        price
            .checked_mul(multiplier)
            .ok_or(PredictionMarketPlaceErrors::MathOverflow)?
    };

    Ok(normalized_price)
}
