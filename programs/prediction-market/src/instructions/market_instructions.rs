use crate::{
    market::Market, PredictionMarketPlaceDetails, PredictionMarketPlaceErrors, QuestionType,
    MAX_STRING,
};
use anchor_lang::prelude::*;
use anchor_spl::token::*;

#[derive(Accounts)]
pub struct CreateMarket<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        mut,
        seeds = [b"predictionmarketplace"],
        bump =  prediction_market_place.bump,
    )]
    pub prediction_market_place: Account<'info, PredictionMarketPlaceDetails>,

    /// CHECK: Prediction market vault
    #[account(
        mut,
        seeds = [b"predictionmarketplace_vault", prediction_market_place.key().as_ref()],
        bump = prediction_market_place.vault_bump,
    )]
    pub prediction_market_vault: UncheckedAccount<'info>,

    #[account(
        init,
        payer = creator,
        space = Market::LEN,
        seeds = [b"market", creator.key().as_ref() , &(prediction_market_place.total_markets + 1).to_le_bytes()],
        bump,
    )]
    pub market: Account<'info, Market>,

    pub system_program: Program<'info, System>,
}

pub fn create_market(
    ctx: Context<CreateMarket>,
    question_type: QuestionType,
    question: String,
    market_end_time: i64,
) -> Result<()> {
    let market = &mut ctx.accounts.market;
    let prediction_market = &mut ctx.accounts.prediction_market_place;
    let prediction_market_vault = &mut ctx.accounts.prediction_market_vault;

    require!(
        question.len() <= MAX_STRING,
        PredictionMarketPlaceErrors::LengthTooLong
    );

    market.id = prediction_market.total_markets + 1 as u64;
    market.question_type = question_type;
    market.question = question;

    market.market_end_time = market_end_time;
    market.bump = ctx.bumps.market;

    Ok(())
}
