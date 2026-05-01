use anchor_lang::prelude::*;

use crate::{Dao, EventMarket, PredictionMarketDaoErrors, PredictionMarketPlaceErrors, RESOLVE_REWARD, User, VotingStatus};

#[derive(Accounts)]
pub struct ResolveEvent<'info> {
    #[account(mut)]
    pub resolver: Signer<'info>,

    #[account(
        mut,
        seeds = [b"user_v1", resolver.key().as_ref()],
        bump = user.bump,
    )]
    pub user: Account<'info, User>,

    #[account(
        mut,
        seeds = [b"event_market", market.authority.key().as_ref() , &market.id.to_le_bytes()],
        bump = market.bump
    )]
    pub market: Account<'info, EventMarket>,

    /// CHECK: vault for this market.
    #[account(
        mut,
        seeds = [b"event_market_vault", market.authority.as_ref(), market.key().as_ref()],
        bump = market.vault_bump,
    )]
    pub market_vault: UncheckedAccount<'info>,

    #[account(
        mut,  
        seeds = [b"prediction_market_dao"],
        bump = dao.bump,
    )]
    pub dao: Account<'info , Dao>,
    
    /// CHECK: Dao stake account
    #[account(
        mut,
        seeds = [b"prediction_market_dao_stake_account"],
        bump = dao.stake_account_bump,
    )]
    pub dao_stake_account: UncheckedAccount<'info>,

}

pub fn resolve_event_market(ctx:Context<ResolveEvent>) -> Result<()> {
    let resolver = &mut ctx.accounts.resolver;
    let market = &mut ctx.accounts.market;
    let market_vault = &mut ctx.accounts.market_vault;
    let dao = &mut ctx.accounts.dao;
    let dao_stake_account = &mut ctx.accounts.dao_stake_account;

    let clock = Clock::get()?;

    let mut total_pool: u64 = 0;

    for (_, option) in market.options.iter().enumerate() {
        total_pool += option.pool_amount as u64;
    }


    require!(clock.unix_timestamp > market.event_end_time, PredictionMarketDaoErrors::EventDidNotEnd);
    let mut max_option_id = 0;
    let mut max_stake = 0;
    let mut total_stake_voted:u64 = 0;
    for (i, option) in market.options.iter().enumerate() {
        total_stake_voted += option.stake_voted as u64;

        if option.stake_voted > max_stake {
            max_stake = option.stake_voted;
            max_option_id = i as u8; 
        }
    }

    let computed_quarum = dao.dao_total_stake.checked_div(10).ok_or(PredictionMarketPlaceErrors::MathOverflow)?;
    require!(total_stake_voted >= computed_quarum , PredictionMarketDaoErrors::QuarumNotReached);

    let winning_stake = total_stake_voted.checked_div(2).ok_or(PredictionMarketPlaceErrors::MathOverflow)?;
    require!(max_stake >= winning_stake , PredictionMarketDaoErrors::WinnerNotReachedWinningAmount);

    require!(dao_stake_account.lamports() >= RESOLVE_REWARD ,PredictionMarketPlaceErrors::InsufficientFundsInTreasury);
    let dao_stake_account_info = dao_stake_account.to_account_info();
    {

        let mut dao_stake_account_lamports = dao_stake_account_info.try_borrow_mut_lamports()?;

        let resolver_info = resolver.to_account_info();
        let mut resolver_lamports = resolver_info.try_borrow_mut_lamports()?;

        **dao_stake_account_lamports = (**dao_stake_account_lamports).checked_sub(RESOLVE_REWARD).ok_or(PredictionMarketPlaceErrors::MathOverflow)?;
        **resolver_lamports = (**resolver_lamports).checked_add(RESOLVE_REWARD).ok_or(PredictionMarketPlaceErrors::MathOverflow)?;
    }

    // 5% from total pool , moved to dao vault to reward the dao truth voters
    let computed_transfer = total_pool.checked_mul(5).ok_or(PredictionMarketPlaceErrors::MathOverflow)?.checked_div(100).ok_or(PredictionMarketPlaceErrors::MathOverflow)?;
    let market_vault_info = market_vault.to_account_info();
    {
        let mut dao_stake_account_lamports = dao_stake_account_info.try_borrow_mut_lamports()?;

        let mut market_vault_lamports = market_vault_info.try_borrow_mut_lamports()?;

        **market_vault_lamports = (**market_vault_lamports).checked_sub(computed_transfer).ok_or(PredictionMarketPlaceErrors::MathOverflow)?;
        **dao_stake_account_lamports = (**dao_stake_account_lamports).checked_add(computed_transfer).ok_or(PredictionMarketPlaceErrors::MathOverflow)?;

    }

    market.final_outcome = Some(max_option_id);
    market.voting_status = VotingStatus::Ended;

    Ok(())
}
