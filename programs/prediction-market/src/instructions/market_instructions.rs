use crate::{
    CREATION_FEE, MAX_STRING, PredictionMarketPlaceDetails, PredictionMarketPlaceErrors, QuestionType, RESOLVE_REWARD, market::Market
};
use anchor_lang::{prelude::*, system_program::Transfer};
use anchor_spl::{associated_token::spl_associated_token_account::solana_program::{ native_token::{LAMPORTS_PER_SOL}}, token::*};
use pyth_sdk_solana::state::SolanaPriceAccount;
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

    #[account(
        init,
        payer = creator,
        mint::authority = market,
        mint::decimals = 6, 
    )]
    pub yes_token_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = creator,
        mint::authority = market,
        mint::decimals = 6,
    )]
    pub no_token_mint: Account<'info , Mint>,


    /// CHECK: Vault of yes token mint 
    #[account(
        init,
        payer = creator,
        space = 8,
        seeds = [b"yes_token_vault",market.key().as_ref(),yes_token_mint.key().as_ref()],
        bump
    )]
    pub yes_token_vault: UncheckedAccount<'info>,

    /// CHECK: Vault of no token mint 
    #[account(
        init,
        payer = creator,
        space = 8,
        seeds = [b"no_token_vault",market.key().as_ref(),no_token_mint.key().as_ref()],
        bump
    )]
    pub no_token_vault: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn create_market(
    ctx: Context<CreateMarket>,
    question_type: QuestionType,
    question: String,
    market_end_time: i64,
) -> Result<()> {
    let market = &mut ctx.accounts.market;
    let prediction_market_vault = &mut ctx.accounts.prediction_market_vault;
    let prediction_market = &mut ctx.accounts.prediction_market_place;

    require!(
        question.len() <= MAX_STRING,
        PredictionMarketPlaceErrors::LengthTooLong
    );

    require!(
        ctx.accounts.creator.lamports() >= CREATION_FEE, PredictionMarketPlaceErrors::InsufficientFundsForCreationFee
    );

    anchor_lang::system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(), 
            Transfer { 
                from: ctx.accounts.creator.to_account_info(), 
                to: prediction_market_vault.to_account_info() 
            }
        ), 
    CREATION_FEE
    )?;

    market.id = prediction_market.total_markets + 1 as u64;
    market.authority = ctx.accounts.creator.key();
    market.question_type = question_type;
    market.question = question;

    market.yes_mint = ctx.accounts.yes_token_mint.key();
    market.no_mint = ctx.accounts.no_token_mint.key();

    market.yes_pool_vault = ctx.accounts.yes_token_vault.key();
    market.no_pool_vault = ctx.accounts.no_token_vault.key();

    market.yes_virtual_pool_amount = 10 * LAMPORTS_PER_SOL as u64;
    market.no_virtual_pool_amount = 10 * LAMPORTS_PER_SOL as u64;

    market.yes_pool_amount = 0;
    market.no_pool_amount = 0;

    market.market_end_time = market_end_time;

    market.resolved = false;
    market.outcome = None;

    market.yes_pool_vault_bump = ctx.bumps.yes_token_vault;
    market.no_pool_vault_bump = ctx.bumps.no_token_vault;

    market.bump = ctx.bumps.market;

    prediction_market.total_markets += 1 as u64;
    Ok(())
}


#[derive(Accounts)]
pub struct ResolveMarket<'info> {
    #[account(mut)]
    pub resolver: Signer<'info>,

    #[account(
        mut,
        seeds=[b"market" , market.authority.as_ref() , &market.id.to_le_bytes()],
        bump = market.bump,
    )]
    pub market: Account<'info , Market>,

    /// CHECK: Price feed from pyth
    pub price_feed: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [b"predictionmarketplace"],
        bump = prediction_marketplace.bump,
    )]
    pub prediction_marketplace: Account<'info , PredictionMarketPlaceDetails>,


    /// CHECK: prediction market vault
    #[account(
        mut,
        seeds = [b"predictionmarketplace_vault", prediction_marketplace.key().as_ref()],
        bump = prediction_marketplace.vault_bump ,
    )]
    pub prediction_marketplace_vault: UncheckedAccount<'info>,
}

pub fn resolve_market(ctx:Context<ResolveMarket>)-> Result<()> {
    let market = &mut ctx.accounts.market;
    let clock = Clock::get()?;
    let prediction_market_vault = &mut ctx.accounts.prediction_marketplace_vault;
    let prediction_market = &mut ctx.accounts.prediction_marketplace;
    let price_feed_account = &mut ctx.accounts.price_feed;
    let expected_feed = match market.question_type {
        QuestionType::GreaterThanAtTime { price_feed, .. } => price_feed,
        QuestionType::LessThanAtTime { price_feed, .. } => price_feed,
    };

    require!(market.market_end_time <= clock.unix_timestamp , PredictionMarketPlaceErrors::MarketEndtimeNotReached);
    require!(prediction_market_vault.lamports()>= RESOLVE_REWARD,PredictionMarketPlaceErrors::InsufficientFundsInTreasury);
    require!(!market.resolved,PredictionMarketPlaceErrors::AlreadyResolved);
    require!(price_feed_account.key() == expected_feed, PredictionMarketPlaceErrors::PriceFeedMismatch);

    let price_feed = SolanaPriceAccount::account_info_to_feed(&price_feed_account.to_account_info(),).map_err(|_| PredictionMarketPlaceErrors::PriceFeedError)?;

    let current_price = price_feed
        .get_price_no_older_than(clock.unix_timestamp, 60)
        .ok_or(PredictionMarketPlaceErrors::PriceFeedError)?;

    let price = current_price.price; // i64
    let expo = current_price.expo;   // i32

    let normalized_price: i64 = if expo < 0 {
        price
            .checked_div(10_i64.pow((-expo) as u32))
            .ok_or(PredictionMarketPlaceErrors::MathOverflow)?
    } else {
        price
            .checked_mul(10_i64.pow(expo as u32))
            .ok_or(PredictionMarketPlaceErrors::MathOverflow)?
    };

    let outcome = match &market.question_type {
        QuestionType::GreaterThanAtTime { target_price, .. } => {
            normalized_price > *target_price
        }
        QuestionType::LessThanAtTime { target_price, .. } => {
            normalized_price < *target_price
        }
    };
    market.outcome = Some(outcome);
    market.resolved = true;

    {
        let prediction_vault_info = prediction_market_vault.to_account_info();
        let resolver_info = ctx.accounts.resolver.to_account_info();

        let mut prediction_vault_lamports = prediction_vault_info.try_borrow_mut_lamports()?;
        let mut resolver_lamports = resolver_info.try_borrow_mut_lamports()?;

        **prediction_vault_lamports = (**prediction_vault_lamports).checked_sub(RESOLVE_REWARD).ok_or(PredictionMarketPlaceErrors::FundTransferError)?;
        **resolver_lamports = (**resolver_lamports).checked_add(RESOLVE_REWARD).ok_or(PredictionMarketPlaceErrors::FundTransferError)?;
    }

    prediction_market.total_resolved += 1 as u64;

    Ok(())
}