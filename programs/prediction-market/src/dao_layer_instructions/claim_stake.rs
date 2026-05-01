use anchor_lang::prelude::*;

use crate::{DaoUser, EventMarket, Vote};

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

    // from the 5% dao reward amount , based on vote contribution towards the truth , that reward will be distributed.
    // wrong voters stake is slashed based on their contribuiton to the wrong vote and rewarded to truth voters.

    Ok(())
}
