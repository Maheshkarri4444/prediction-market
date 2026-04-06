use anchor_lang::prelude::*;

use crate::PredictionMarketPlaceDetails;

#[derive(Accounts)]
pub struct InitializePredictionMarket<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        init,
        payer = creator,
        space = PredictionMarketPlaceDetails::LEN,
        seeds = [b"predictionmarketplace"],
        bump 
    )]
    pub prediction_market_place: Account<'info,PredictionMarketPlaceDetails>,


    /// CHECK: prediction market place vault ( it collects the fees for treasury)
    #[account(
        init,
        payer = creator,
        space = 8,
        seeds = [b"predictionmarketplace_vault", prediction_market_place.key().as_ref()],
        bump,
    )]
    pub prediction_market_place_vault: UncheckedAccount<'info>,

    pub system_program: Program<'info , System>,
}

pub fn initialize_prediction_market(ctx: Context<InitializePredictionMarket>)->Result<()> {
    let predition_market_place = &mut ctx.accounts.prediction_market_place;

    predition_market_place.creator = ctx.accounts.creator.key();
    predition_market_place.total_markets = 0;
    predition_market_place.total_resolved = 0;
    predition_market_place.bump = ctx.bumps.prediction_market_place;

    predition_market_place.vault = ctx.accounts.prediction_market_place_vault.key();
    Ok(())
}
