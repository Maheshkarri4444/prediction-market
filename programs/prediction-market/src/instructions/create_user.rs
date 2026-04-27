use crate::{PredictionMarketPlaceErrors, User, MAX_USER};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct CreateUser<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        init,
        payer = user,
        space = 8 + User::LEN,
        seeds = [b"user_v1", user.key().as_ref()],
        bump,
    )]
    pub user_account: Account<'info, User>,

    pub system_program: Program<'info, System>,
}

pub fn create_user(ctx: Context<CreateUser>, username: String) -> Result<()> {
    let user_account = &mut ctx.accounts.user_account;
    let user = &mut ctx.accounts.user;

    require!(
        username.len() < MAX_USER,
        PredictionMarketPlaceErrors::UsernameTooLong
    );

    user_account.username = username;
    user_account.pubkey = user.key();
    user_account.total_orders = 0;
    user_account.bump = ctx.bumps.user_account;

    Ok(())
}
