use anchor_lang::prelude::*;

use crate::{Dao, EventMarket, User};

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

}
