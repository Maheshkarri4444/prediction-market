use anchor_lang::{prelude::*, system_program::Transfer};
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount},
};

use crate::calculate_price;
use crate::{Market, Options, Order, PredictionMarketPlaceErrors, User};
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

    /// CHECK: yes pool vault for this market.
    #[account(
        mut,
        seeds = [b"yes_token_vault",market.key().as_ref(),yes_token_mint.key().as_ref()],
        bump = market.yes_pool_vault_bump,
    )]
    pub yes_pool_vault: UncheckedAccount<'info>,

    /// CHECK: no pool vault for this market.
    #[account(
        mut,
        seeds = [b"no_token_vault",market.key().as_ref(),no_token_mint.key().as_ref()],
        bump = market.no_pool_vault_bump,
    )]
    pub no_pool_vault: UncheckedAccount<'info>,

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
    let market = &mut ctx.accounts.market;
    let yes_pool_vault = &mut ctx.accounts.yes_pool_vault;
    let no_pool_vault = &mut ctx.accounts.no_pool_vault;
    let clock = Clock::get()?;

    require!(
        yes_pool_vault.key() == market.yes_pool_vault,
        PredictionMarketPlaceErrors::PoolVaultMismatch
    );
    require!(
        no_pool_vault.key() == market.no_pool_vault,
        PredictionMarketPlaceErrors::PoolVaultMismatch
    );
    let selected_pool = if option == Options::Yes {
        yes_pool_vault.lamports() as u64 + market.yes_virtual_pool_amount as u64
    } else {
        no_pool_vault.lamports() as u64 + market.no_virtual_pool_amount as u64
    };
    let total_pool = yes_pool_vault.lamports() as u64
        + no_pool_vault.lamports() as u64
        + market.yes_virtual_pool_amount as u64
        + market.no_virtual_pool_amount as u64;

    let computed_price = calculate_price(selected_pool, total_pool)?;
    let required_amount = computed_price as u64 * quantity as u64;

    let selected_vault = if option == Options::Yes {
        yes_pool_vault
    } else {
        no_pool_vault
    };

    require!(
        ctx.accounts.buyer.lamports() >= required_amount,
        PredictionMarketPlaceErrors::InsufficientFundsForOrder
    );

    anchor_lang::system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            Transfer {
                from: ctx.accounts.buyer.to_account_info(),
                to: selected_vault.to_account_info(),
            },
        ),
        required_amount,
    )?;

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
