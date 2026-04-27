use anchor_lang::{prelude::*, system_program::Transfer};
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Burn, Mint, Token, TokenAccount},
};

use crate::{calculate_price, mint_tokens};
use crate::{Market, Options, Order, PredictionMarketPlaceErrors, User};
#[derive(Accounts)]
pub struct CreateOrder<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,

    #[account(
        mut,
        seeds = [b"user_v1", user.pubkey.as_ref()],  
        bump = user.bump,
    )]
    pub user: Box<Account<'info, User>>,

    #[account(
        mut,
        seeds=[b"market", market.authority.as_ref(), &market.id.to_le_bytes()],
        bump = market.bump,
    )]
    pub market: Box<Account<'info, Market>>,

    #[account(
        mut,
        address = market.yes_mint,
    )]
    pub yes_token_mint: Box<Account<'info, Mint>>,

    #[account(
        mut,
        address = market.no_mint,
    )]
    pub no_token_mint: Box<Account<'info, Mint>>,

    #[account(
        init,
        payer = buyer,
        space = 8 + Order::LEN,
        seeds = [b"buy_shares", market.key().as_ref(), &(user.total_orders + 1).to_be_bytes()],
        bump
    )]
    pub order: Account<'info, Order>,

    /// CHECK: yes pool vault for this market.
    #[account(
        mut,
        seeds = [b"yes_token_vault", market.key().as_ref(), yes_token_mint.key().as_ref()],
        bump = market.yes_pool_vault_bump,
    )]
    pub yes_pool_vault: UncheckedAccount<'info>,

    /// CHECK: no pool vault for this market.
    #[account(
        mut,
        seeds = [b"no_token_vault", market.key().as_ref(), no_token_mint.key().as_ref()],
        bump = market.no_pool_vault_bump,
    )]
    pub no_pool_vault: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        payer = buyer,
        associated_token::mint = yes_token_mint,
        associated_token::authority = buyer,
    )]
    pub yes_token_account: Box<Account<'info, TokenAccount>>,

    #[account(
        init_if_needed,
        payer = buyer,
        associated_token::mint = no_token_mint,
        associated_token::authority = buyer,
    )]
    pub no_token_account: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}
pub fn create_order(ctx: Context<CreateOrder>, option: Options, quantity: u64) -> Result<()> {
    let order = &mut ctx.accounts.order;
    let market = &mut ctx.accounts.market;
    let yes_pool_vault = &mut ctx.accounts.yes_pool_vault;
    let no_pool_vault = &mut ctx.accounts.no_pool_vault;

    let yes_lamports = yes_pool_vault.to_account_info().lamports();
    let no_lamports = no_pool_vault.to_account_info().lamports();

    let clock = Clock::get()?;

    require!(
        clock.unix_timestamp < market.market_end_time,
        PredictionMarketPlaceErrors::MarketClosed
    );

    require!(
        yes_pool_vault.key() == market.yes_pool_vault,
        PredictionMarketPlaceErrors::PoolVaultMismatch
    );
    require!(
        no_pool_vault.key() == market.no_pool_vault,
        PredictionMarketPlaceErrors::PoolVaultMismatch
    );

    let selected_pool = if option == Options::Yes {
        yes_lamports as u64 + market.yes_virtual_pool_amount as u64
    } else {
        no_lamports as u64 + market.no_virtual_pool_amount as u64
    };
    let total_pool = yes_lamports as u64
        + no_lamports as u64
        + market.yes_virtual_pool_amount as u64
        + market.no_virtual_pool_amount as u64;

    msg!("yes lamports: {}", yes_lamports);
    msg!("no lamports: {}", no_lamports);
    msg!("total pool: {}", total_pool);

    let computed_price = calculate_price(selected_pool, total_pool)?;
    let required_amount = computed_price as u64 * quantity as u64;

    let selected_vault = if option == Options::Yes {
        yes_pool_vault
    } else {
        no_pool_vault
    };
    let selected_mint = if option == Options::Yes {
        &ctx.accounts.yes_token_mint
    } else {
        &ctx.accounts.no_token_mint
    };
    let selected_to_token_account = if option == Options::Yes {
        &ctx.accounts.yes_token_account
    } else {
        &ctx.accounts.no_token_account
    };

    let authority_info = market.to_account_info();

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

    if option == Options::Yes {
        market.yes_pool_amount = market
            .yes_pool_amount
            .checked_add(required_amount)
            .ok_or(PredictionMarketPlaceErrors::MathOverflow)?;
    } else {
        market.no_pool_amount = market
            .no_pool_amount
            .checked_add(required_amount)
            .ok_or(PredictionMarketPlaceErrors::MathOverflow)?;
    }

    let signer: &[&[u8]] = &[
        b"market",
        market.authority.as_ref(),
        &market.id.to_le_bytes(),
        &[market.bump],
    ];

    let signer_seeds = &[signer];
    mint_tokens(
        selected_mint,
        selected_to_token_account,
        &authority_info,
        &ctx.accounts.token_program,
        signer_seeds,
        quantity,
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

#[derive(Accounts)]
pub struct ClaimWinningReward<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

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
        mut,
        associated_token::mint = yes_token_mint,
        associated_token::authority = user,
    )]
    pub yes_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = no_token_mint,
        associated_token::authority = user,
    )]
    pub no_token_account: Account<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn claim_winning_reward(ctx: Context<ClaimWinningReward>) -> Result<()> {
    let market = &mut ctx.accounts.market;
    let yes_token_mint = &mut ctx.accounts.yes_token_mint;
    let no_token_mint = &mut ctx.accounts.no_token_mint;
    let yes_token_account = &mut ctx.accounts.yes_token_account;
    let no_token_account = &mut ctx.accounts.no_token_account;

    let user = &ctx.accounts.user;

    let yes_vault = &mut ctx.accounts.yes_pool_vault;
    let no_vault = &mut ctx.accounts.no_pool_vault;

    require!(
        market.resolved,
        PredictionMarketPlaceErrors::MarketNotYetResolved
    );
    require!(
        market.outcome.is_some(),
        PredictionMarketPlaceErrors::NoOutcome
    );
    let total_yes_tokens = yes_token_mint.supply;
    let total_no_tokens = no_token_mint.supply;

    let no_vault_account_info = no_vault.to_account_info();
    let yes_vault_account_info = yes_vault.to_account_info();

    let no_vault_funds = no_vault.lamports();
    let yes_vault_funds = yes_vault.lamports();

    if let Some(outcome) = market.outcome {
        let user_account_info = user.to_account_info();
        let user_yes_tokens = yes_token_account.amount;
        let user_no_tokens = no_token_account.amount;
        {
            let mut user_lamports = user_account_info.try_borrow_mut_lamports()?;

            if outcome {
                require!(
                    user_yes_tokens != 0,
                    PredictionMarketPlaceErrors::NoTokensAvailable
                );
                let user_reward = user_yes_tokens
                    .checked_mul(market.yes_pool_amount + market.no_pool_amount as u64)
                    .ok_or(PredictionMarketPlaceErrors::MathOverflow)?
                    .checked_div(total_yes_tokens)
                    .ok_or(PredictionMarketPlaceErrors::MathOverflow)?;

                {
                    let mut yes_vault_lamports =
                        yes_vault_account_info.try_borrow_mut_lamports()?;
                    let mut no_vault_lamports = no_vault_account_info.try_borrow_mut_lamports()?;

                    if **no_vault_lamports != 0 {
                        **no_vault_lamports =
                            (**no_vault_lamports).checked_sub(no_vault_funds).unwrap();
                        **yes_vault_lamports =
                            (**yes_vault_lamports).checked_add(no_vault_funds).unwrap();
                    }
                    **yes_vault_lamports = (**yes_vault_lamports).checked_sub(user_reward).unwrap();
                    **user_lamports = (**user_lamports).checked_add(user_reward).unwrap();
                }
            } else {
                require!(
                    user_no_tokens != 0,
                    PredictionMarketPlaceErrors::NoTokensAvailable
                );
                let user_reward = user_no_tokens
                    .checked_mul(market.no_pool_amount + market.yes_pool_amount as u64)
                    .ok_or(PredictionMarketPlaceErrors::MathOverflow)?
                    .checked_div(total_no_tokens)
                    .ok_or(PredictionMarketPlaceErrors::MathOverflow)?;
                {
                    let mut yes_vault_lamports =
                        yes_vault_account_info.try_borrow_mut_lamports()?;
                    let mut no_vault_lamports = no_vault_account_info.try_borrow_mut_lamports()?;

                    if **yes_vault_lamports != 0 {
                        **yes_vault_lamports =
                            (**yes_vault_lamports).checked_sub(yes_vault_funds).unwrap();
                        **no_vault_lamports =
                            (**no_vault_lamports).checked_add(yes_vault_funds).unwrap();
                    }

                    **no_vault_lamports = (**no_vault_lamports)
                        .checked_sub(user_reward)
                        .ok_or(PredictionMarketPlaceErrors::MathOverflow)?;
                    **user_lamports = (**user_lamports)
                        .checked_add(user_reward)
                        .ok_or(PredictionMarketPlaceErrors::MathOverflow)?;
                }
            }
        }
        token::burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Burn {
                    mint: yes_token_mint.to_account_info(),
                    from: yes_token_account.to_account_info(),
                    authority: user_account_info,
                },
            ),
            user_yes_tokens,
        )?;
        token::burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Burn {
                    mint: no_token_mint.to_account_info(),
                    from: no_token_account.to_account_info(),
                    authority: user.to_account_info(),
                },
            ),
            user_no_tokens,
        )?;
    }
    Ok(())
}
