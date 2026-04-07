use crate::PredictionMarketPlaceErrors;
use anchor_lang::prelude::*;

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
