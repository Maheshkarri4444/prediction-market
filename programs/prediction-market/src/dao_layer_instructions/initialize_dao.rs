use anchor_lang::prelude::*;
use anchor_spl::{associated_token::AssociatedToken, token::{Mint, Token, TokenAccount}};

use crate::{Dao, DaoUser, MAX_USER, PredictionMarketDaoErrors,PredictionMarketPlaceErrors, PredictionMarketPlaceDetails};

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

#[derive(Accounts)]
pub struct AddFounder<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    pub founder: SystemAccount<'info>,

    #[account(
        init,
        payer = creator,
        space = DaoUser::LEN,
        seeds = [b"dao_user" , founder.key().as_ref()],
        bump
    )]
    pub dao_user: Account<'info , DaoUser>,

    #[account(
        mut,
        seeds = [b"prediction_market_dao"],
        bump = dao.bump,
    )]
    pub dao: Account<'info , Dao>,

    #[account(
        mut,
        address = dao.token_mint,
    )]
    pub dao_token_mint: Account<'info,Mint>,

    #[account(
        init,
        payer = creator,
        associated_token::mint = dao_token_mint,
        associated_token::authority = founder,
    )]
    pub founder_token_account: Account<'info, TokenAccount>,

    pub associated_token_program: Program<'info,AssociatedToken>,
    pub token_program: Program<'info,Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info , Rent>,
}

pub fn add_founder (ctx: Context<AddFounder>, username: String) -> Result<()> {
    let creator = &mut ctx.accounts.creator;
    let founder = &mut ctx.accounts.founder;
    let dao_user = &mut ctx.accounts.dao_user;

    let dao = &mut ctx.accounts.dao;
    let dao_token_mint = &mut ctx.accounts.dao_token_mint;

    require!(username.len() <= MAX_USER, PredictionMarketPlaceErrors::UsernameTooLong);

    // nft token mint to be added here 
    // metaplex metadata thing to be added here

    dao_user.username = username; 
    dao_user.pubkey = founder.key();
    dao_user.reputation = 10;
    dao_user.token_balance = 500; // 500 tokens to be minted.
    dao_user.total_actions = 0;
    dao.total_members += 1 as u64;
    dao.bump = ctx.bumps.dao_user;

    Ok(())
}