use anchor_lang::prelude::*;

use crate::{Dao, DaoUser, EventMarket, PredictionMarketDaoErrors, PredictionMarketPlaceErrors, Vote, VotingStatus};

#[derive(Accounts)]
pub struct VoteOnMarket<'info> {
    #[account(mut)]
    pub voter: Signer<'info>,

    #[account(
        mut,
        seeds = [b"prediction_market_dao"],
        bump = dao.bump,
    )]
    pub dao: Account<'info , Dao>,

    #[account(
        mut,
        seeds = [b"dao_user" , voter.key().as_ref()],
        bump = dao_user.bump,
    )]
    pub dao_user: Account<'info, DaoUser>,

    #[account(
        mut,
        seeds = [b"event_market", market.authority.key().as_ref() , &market.id.to_le_bytes()],
        bump = market.bump
    )]
    pub market: Account<'info , EventMarket>,

    #[account(
        init,
        payer = voter,
        space = 8 + Vote::LEN,
        seeds = [b"vote" , voter.key().as_ref() , market.key().as_ref()],
        bump 
    )]
    pub vote: Account<'info , Vote>,

    pub system_program: Program<'info , System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn vote_on_market(ctx:Context<VoteOnMarket> , option_id: u8 , stake: u64)->Result<()> {
    let market = &mut ctx.accounts.market;
    let vote = &mut ctx.accounts.vote;
    let dao_user = &mut ctx.accounts.dao_user;

    let clock = Clock::get()?;

    require!(clock.unix_timestamp >= market.event_end_time , PredictionMarketDaoErrors::NotYetEnded);
    require!(market.voting_status != VotingStatus::Ended , PredictionMarketDaoErrors::VotingEnded);
    require!(dao_user.free_amount >= stake ,PredictionMarketDaoErrors::InsufficientFreeAmountToVote );

    if market.voting_status != VotingStatus::Active {
        market.voting_status = VotingStatus::Active;
    }

    require!(option_id < market.num_options, PredictionMarketPlaceErrors::InvalidOption );

    let selected_option = &mut market.options[option_id as usize];

    selected_option.stake_voted += stake as u64;

    dao_user.total_actions += 1 as u64;  
    dao_user.total_votes += 1 as u64;

    vote.market = market.key();
    vote.voter = ctx.accounts.voter.key();
    vote.stake_voted = stake;
    vote.option_id = option_id;
    vote.bump = ctx.bumps.vote;

    dao_user.locked_amount += stake as u64;
    dao_user.free_amount -= stake as u64;

    Ok(())
}