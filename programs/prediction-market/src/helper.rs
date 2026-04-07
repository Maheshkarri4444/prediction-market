use crate::PredictionMarketPlaceErrors;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, *};

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
