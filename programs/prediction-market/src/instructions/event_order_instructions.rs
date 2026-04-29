use anchor_lang::{prelude::*, system_program::Transfer};
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount},
};

use crate::{calculate_price, mint_tokens, EventMarket, Order, PredictionMarketPlaceErrors, User};

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

    #[account(
        init_if_needed,
        payer = buyer,
        associated_token::mint = token_mint,
        associated_token::authority = buyer,
    )]
    pub token_account: Box<Account<'info, TokenAccount>>,

    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn create_event_order(ctx: Context<CreateEventOrder>, option: u8, quantity: u64) -> Result<()> {
    let buyer = &mut ctx.accounts.buyer;
    let market = &mut ctx.accounts.market;
    let mut total_pool: u64 = 0;
    for (_, option) in market.options.iter().enumerate() {
        total_pool += option.pool_amount as u64;
        total_pool += option.virtual_pool_amount as u64;
    }

    let option_token_mint = &mut ctx.accounts.token_mint;
    let order = &mut ctx.accounts.order;
    let market_vault = &mut ctx.accounts.market_vault;

    let market_info = market.to_account_info();
    let market_status = market.started;
    let market_end_time = market.market_end_time;

    let selected_option = &mut market.options[option as usize];

    require!(
        selected_option.mint == option_token_mint.key(),
        PredictionMarketPlaceErrors::TokenMintMismatch
    );

    let pool_lamports = selected_option.pool_amount;

    let clock = Clock::get()?;

    require!(
        market_status,
        PredictionMarketPlaceErrors::MarketNotYetStarted
    );

    require!(
        clock.unix_timestamp < market_end_time,
        PredictionMarketPlaceErrors::MarketClosed
    );

    let selected_pool = pool_lamports + selected_option.virtual_pool_amount as u64;
    let computed_price = calculate_price(selected_pool, total_pool)?;
    let required_amount = computed_price as u64 * quantity as u64;
    let selected_to_token_account = &mut ctx.accounts.token_account;

    require!(
        buyer.lamports() >= required_amount,
        PredictionMarketPlaceErrors::InsufficientFundsForOrder
    );

    anchor_lang::system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            Transfer {
                from: ctx.accounts.buyer.to_account_info(),
                to: market_vault.to_account_info(),
            },
        ),
        required_amount,
    )?;

    selected_option.pool_amount = selected_option
        .pool_amount
        .checked_add(required_amount)
        .ok_or(PredictionMarketPlaceErrors::MathOverflow)?;

    let signer: &[&[u8]] = &[
        b"market",
        market.authority.as_ref(),
        &market.id.to_le_bytes(),
        &[market.bump],
    ];

    let signer_seeds = &[signer];
    mint_tokens(
        option_token_mint,
        selected_to_token_account,
        &market_info,
        &ctx.accounts.token_program,
        signer_seeds,
        quantity,
    )?;

    order.buyer = ctx.accounts.buyer.key();

    order.market = ctx.accounts.market.key();
    order.option = option.clone();
    order.quantity = quantity;
    order.token_account = ctx.accounts.token_account.key();
    order.time_stamp = clock.unix_timestamp as i64;

    Ok(())
}
