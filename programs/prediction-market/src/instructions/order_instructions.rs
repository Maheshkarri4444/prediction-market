use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount},
};

use crate::{Market, Options, Order, User};

#[derive(Accounts)]
pub struct CreateOrder<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,

    #[account(
        mut,
        seeds = [b"user", user.pubkey.as_ref()],
        bump = user.bump,
    )]
    pub user: Account<'info, User>,

    #[account(
        mut,
        seeds=[b"market" , market.authority.as_ref() , &market.id.to_le_bytes()],
        bump = market.bump,
    )]
    pub market: Account<'info, Market>,

    #[account(
        mut,
        address= market.yes_mint,
    )]
    pub yes_token_mint: Account<'info, Mint>,

    #[account(
        mut,
        address = market.no_mint,
    )]
    pub no_token_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = buyer,
        space = Order::LEN,
        seeds = [b"buy_shares", market.key().as_ref(), &(user.total_interactions + 1).to_be_bytes()],
        bump
    )]
    pub order: Account<'info, Order>,

    #[account(
        init_if_needed,
        payer = buyer ,
        associated_token::mint = yes_token_mint,
        associated_token::authority = buyer,
    )]
    pub yes_token_account: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = buyer ,
        associated_token::mint = no_token_mint,
        associated_token::authority = buyer,
    )]
    pub no_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn create_order(ctx: Context<CreateOrder>, option: Options, quantity: u64) -> Result<()> {
    let order = &mut ctx.accounts.order;

    let clock = Clock::get()?;

    order.buyer = ctx.accounts.buyer.key();

    order.market = ctx.accounts.market.key();
    order.option = option.clone();
    order.quantity = quantity;

    if option == Options::Yes {
        order.token_account = ctx.accounts.yes_token_account.key();
    } else if option == Options::No {
        order.token_account = ctx.accounts.no_token_account.key();
    }

    order.time_stamp = clock.unix_timestamp as i64;

    Ok(())
}
