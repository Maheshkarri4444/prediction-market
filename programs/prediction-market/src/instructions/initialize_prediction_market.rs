use anchor_lang::prelude::*;

use crate::{PredictionMarketPlaceDetails, prediction_marketplace_details};
use crate::errors::PredictionMarketPlaceErrors;

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

#[derive(Accounts)]
pub struct ClaimFunds<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"predictionmarketplace"],
        bump = prediction_market_place.bump,
    )]
    pub prediction_market_place: Account<'info, PredictionMarketPlaceDetails>,


    /// CHECK: Prediction market place vault
    #[account(
        mut,
        seeds = [b"predictionmarketplace_vault", prediction_market_place.key().as_ref()],
        bump = prediction_market_place.vault_bump,
    )]
    pub prediction_market_place_vault: UncheckedAccount<'info>,
}

pub fn claim_funds(ctx: Context<ClaimFunds>)-> Result<()> {
    let prediction_marketplace_vault = &mut ctx.accounts.prediction_market_place_vault;
    let prediction_marketplace = &mut ctx.accounts.prediction_market_place;
    require!(ctx.accounts.creator.key() == prediction_marketplace.creator , PredictionMarketPlaceErrors::CreatorMismatch );

    {
        let vault_info = ctx.accounts.prediction_market_place_vault.to_account_info();
        let creator_info = ctx.accounts.creator.to_account_info();

        let mut vault_lamports = vault_info.try_borrow_mut_lamports()?;
        let amount = **vault_lamports;
        let mut creator_lamports = creator_info.try_borrow_mut_lamports()?;

        require!(amount != 0 , PredictionMarketPlaceErrors::NoFundsInVault);

        **vault_lamports = (**vault_lamports).checked_sub(amount).unwrap();
        **creator_lamports = (**creator_lamports).checked_add(amount).unwrap();

    }

    Ok(())
}