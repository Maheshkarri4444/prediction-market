use anchor_lang::prelude::*;

use crate::{DaoUser, EventMarket, PredictionMarketPlaceErrors, Vote};

#[derive(Accounts)]
pub struct ClaimStake<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [b"dao_user" , user.key().as_ref()],
        bump = dao_user.bump,
    )]
    pub dao_user: Account<'info, DaoUser>,

    #[account(
        mut,
        seeds = [b"event_market", market.authority.key().as_ref() , &market.id.to_le_bytes()],
        bump = market.bump
    )]
    pub market: Account<'info, EventMarket>,

    #[account(
        mut,
        seeds = [b"vote" , user.key().as_ref() , market.key().as_ref()],
        bump = vote.bump
    )]
    pub vote: Account<'info, Vote>,

    pub system_program: Program<'info, System>,
}

pub fn claim_stake(ctx: Context<ClaimStake>) -> Result<()> {
    let market = &mut ctx.accounts.market;
    let dao_user = &mut ctx.accounts.dao_user;
    let vote = &mut ctx.accounts.vote;

    let voter_stake = vote.stake_voted;

    let final_outcome = market
        .final_outcome
        .ok_or(PredictionMarketPlaceErrors::NoOutcome)?;

    let mut total_pool: u64 = 0;
    let mut total_vote_stake: u64 = 0;
    let mut outcome_stake: u64 = 0;
    for (_, option) in market.options.iter().enumerate() {
        total_pool += option.pool_amount as u64;
        total_vote_stake += option.stake_voted as u64;
        if option.option_id == final_outcome {
            outcome_stake += option.stake_voted as u64;
        }
    }

    let wrong_voted_stake = total_vote_stake - outcome_stake as u64;

    // from the 5% dao reward amount , based on vote contribution towards the truth , that reward will be distributed.
    let reward_from_event_pool = total_pool
        .checked_mul(5)
        .ok_or(PredictionMarketPlaceErrors::MathOverflow)?
        .checked_div(100)
        .ok_or(PredictionMarketPlaceErrors::MathOverflow)?;

    // to be added here
    if vote.option_id == final_outcome {
        // truth contribution reward
        let contribution_reward = voter_stake
            .checked_mul(wrong_voted_stake)
            .ok_or(PredictionMarketPlaceErrors::MathOverflow)?
            .checked_div(outcome_stake)
            .ok_or(PredictionMarketPlaceErrors::MathOverflow)?;

        let vote_reward = voter_stake
            .checked_mul(reward_from_event_pool)
            .ok_or(PredictionMarketPlaceErrors::MathOverflow)?
            .checked_div(outcome_stake)
            .ok_or(PredictionMarketPlaceErrors::MathOverflow)?;

        // transfer computations.
        let total_reward = contribution_reward + vote_reward as u64;
        dao_user.total_stake += total_reward as u64;
        dao_user.locked_amount -= voter_stake as u64;
        dao_user.free_amount += total_reward as u64;
    } else {
        // false contribution
        dao_user.total_stake -= voter_stake as u64;
        dao_user.locked_amount -= voter_stake as u64
    }

    Ok(())
}
