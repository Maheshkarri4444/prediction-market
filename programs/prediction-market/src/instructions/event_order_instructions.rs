use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token};

use crate::{EventMarket, Order, User};

#[derive(Accounts)]
pub struct CreateEventOrder<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,

    #[account(
        mut,
        seeds = [b"user_v1", buyer.key().as_ref()],
        bump = user.bump,
    )]
    pub user: Account<'info, User>,

    #[account(
        mut,
        seeds = [b"event_market", market.authority.key().as_ref() , &market.id.to_le_bytes()],
        bump = market.bump
    )]
    pub market: Account<'info, EventMarket>,

    #[account(mut)]
    pub token_mint: Box<Account<'info, Mint>>,

    #[account(
        init,
        payer = buyer,
        space = 8 + Order::LEN,
        seeds = [b"buy_shares", market.key().as_ref(), &(user.total_orders + 1).to_be_bytes()],
        bump
    )]
    pub order: Account<'info, Order>,

    /// CHECK: vault for this market.
    #[account(
        mut,
        seeds = [b"event_market_vault", market.authority.as_ref(), market.key().as_ref()],
        bump = market.vault_bump,
    )]
    pub market_vault: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}
