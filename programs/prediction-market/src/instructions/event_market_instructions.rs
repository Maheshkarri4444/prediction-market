use anchor_lang::{prelude::*, system_program::Transfer};
use anchor_spl::{associated_token::spl_associated_token_account::solana_program::native_token::LAMPORTS_PER_SOL, token::{Mint, Token}};

use crate::{CREATION_FEE, Dao, EventMarket, EventOptionDetails, EventQuestionType, MAX_OUTCOMES, MAX_STRING, PredictionMarketPlaceDetails, PredictionMarketPlaceErrors, VotingStatus};

#[derive(Accounts)]
pub struct CreateEventMarket<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        mut,
        seeds = [b"predictionmarketplace_v1"],
        bump =  prediction_market_place.bump,
    )]
    pub prediction_market_place: Account<'info, PredictionMarketPlaceDetails>,

    #[account(
        init,
        payer = creator,
        space = 8 + EventMarket::LEN,
        seeds = [b"event_market", creator.key().as_ref() , &(prediction_market_place.total_markets + 1).to_le_bytes()],
        bump,
    )]
    pub market: Account<'info, EventMarket>,

    /// CHECK: Vault of Token pool
    #[account(
        init,
        payer = creator,
        space = 8,
        seeds = [b"event_market_vault", market.authority.as_ref(), market.key().as_ref()],
        bump,
    )]
    pub market_vault: UncheckedAccount<'info>,

    #[account(
        mut,  
        seeds = [b"prediction_market_dao"],
        bump = dao.bump,
    )]
    pub dao: Account<'info , Dao>,

    /// CHECK: Dao vault 
    #[account(
        mut,
        seeds = [b"prediction_market_dao_vault"],
        bump = dao.vault_bump,
    )]
    pub dao_vault: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn create_event_market (
    ctx:Context<CreateEventMarket>,
    question_type: EventQuestionType,
    question: String,
    market_end_time: i64,
    event_end_time: i64,
)-> Result<()> {
    let creator = &mut ctx.accounts.creator;
    let prediction_market_place = &mut ctx.accounts.prediction_market_place;
    let market = &mut ctx.accounts.market;
    let market_vault = &mut ctx.accounts.market_vault;

    let dao = &mut ctx.accounts.dao;
    let dao_vault = &mut ctx.accounts.dao_vault;

    let num_options: u8;


    require!(
        question.len() <= MAX_STRING,
        PredictionMarketPlaceErrors::LengthTooLong
    );
    require!(creator.lamports() >= CREATION_FEE , PredictionMarketPlaceErrors::InsufficientFundsForCreationFee);

    if let EventQuestionType::Optioned { options, .. } = &question_type {
        require!(
            options.len() < MAX_OUTCOMES,
            PredictionMarketPlaceErrors::OptionsOutOfRange
        );
        num_options = options.len() as u8;
    } else {
        num_options = 2;
    }

    anchor_lang::system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(), 
            Transfer { 
                from: creator.to_account_info() , 
                to: dao_vault.to_account_info(), 
            }
        ), 
        CREATION_FEE
    )?;

    market.id = prediction_market_place.total_markets + 1 as u64;
    market.authority = creator.key();
    market.question = question;
    market.question_type = question_type;
    market.market_end_time = market_end_time;
    market.event_end_time = event_end_time;
    market.num_options = num_options;
    
    market.options = Vec::new();

    market.started = false;
    market.resolved = false;
    market.voting_status = VotingStatus::NotYetStarted;
    market.final_outcome = None;

    market.vault = market_vault.key();
    market.vault_bump = ctx.bumps.market_vault;

    market.bump = ctx.bumps.market;


    prediction_market_place.total_markets += 1 as u64;
    Ok(())
}

#[derive(Accounts)]
pub struct AddEventOptionDetails<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        mut,
        seeds = [b"event_market", creator.key().as_ref() , &market.id.to_le_bytes()],
        bump = market.bump
    )]
    pub market: Account<'info , EventMarket>,

    #[account(
        init,
        payer = creator,
        mint::authority = market,
        mint::decimals = 6,
    )]
    pub token_mint: Account<'info, Mint>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info , System>,
}

pub fn add_option_for_event_market(
    ctx:Context<AddEventOptionDetails> 
)->Result<()> {

    let market = &mut ctx.accounts.market;
    let mut option = EventOptionDetails::new();

    require!(
        market.options.len() < market.num_options as usize,
        PredictionMarketPlaceErrors::OptionsOutOfRange
    );

    option.market = market.key();
    option.option_id = market.options.len() as u8;
    option.mint = ctx.accounts.token_mint.key();
    option.virtual_pool_amount = 10 * LAMPORTS_PER_SOL as u64;
    option.pool_amount = 0;
    option.stake_voted = 0;

    market.options.push(option);

    if market.options.len() == market.num_options as usize {
        market.started = true;
    }

    Ok(())
}