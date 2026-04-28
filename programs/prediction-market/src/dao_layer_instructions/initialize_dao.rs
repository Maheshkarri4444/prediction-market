use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token};

use crate::{Dao, PredictionMarketPlaceDetails , PredictionMarketDaoErrors};

#[derive(Accounts)]
pub struct InitializeDao<'info>{
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        mut,
        seeds = [b"predictionmarketplace_v1"],
        bump = prediction_market_place.bump,
    )]
    pub prediction_market_place: Account<'info, PredictionMarketPlaceDetails>,

    #[account(
        init,  
        payer = creator,
        space = Dao::LEN,
        seeds = [b"prediction_market_dao"],
        bump
    )]
    pub dao: Account<'info , Dao>,

    /// CHECK: Dao vault 
    #[account(
        init,
        payer = creator,
        space = 8,
        seeds = [b"prediction_market_dao_vault"],
        bump 
    )]
    pub dao_vault: UncheckedAccount<'info>,

    #[account(
        init,
        payer = creator,
        mint::authority = dao,
        mint::decimals = 6,
    )]
    pub mint: Account<'info,Mint>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info , Token>,
    pub rent: Sysvar<'info , Rent>,
}

pub fn initialize_dao(ctx: Context<InitializeDao>)->Result<()>{
    let prediction_market_place  = &mut ctx.accounts.prediction_market_place;
    let dao = &mut ctx.accounts.dao;
    let dao_vault = &mut ctx.accounts.dao_vault;
    let mint = &mut ctx.accounts.mint;
    let creator = &mut ctx.accounts.creator;

    require!(creator.key() == prediction_market_place.creator , PredictionMarketDaoErrors::CreatorMismatch);

    dao.creator = creator.key();
    dao.token_mint = mint.key();
    dao.vault = dao_vault.key();
    dao.total_members = 0;
    dao.total_events = 0;
    dao.vault_bump = ctx.bumps.dao_vault;
    dao.bump = ctx.bumps.dao;

    Ok(())
}

