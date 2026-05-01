use anchor_lang::{prelude::*, system_program::Transfer};
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Burn, Mint, Token, TokenAccount},
};

use crate::{
    calculate_price, mint_tokens, EventMarket, Order, PredictionMarketDaoErrors,
    PredictionMarketPlaceErrors, User, PRECISION,
};

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

    let mut option_data = market.options[option as usize].clone();

    require!(
        option_data.mint == option_token_mint.key(),
        PredictionMarketPlaceErrors::TokenMintMismatch
    );

    let pool_lamports = option_data.pool_amount;

    let clock = Clock::get()?;

    require!(
        market_status,
        PredictionMarketPlaceErrors::MarketNotYetStarted
    );

    require!(
        clock.unix_timestamp < market_end_time,
        PredictionMarketPlaceErrors::MarketClosed
    );

    let selected_pool = pool_lamports + option_data.virtual_pool_amount as u64;
    let computed_price = calculate_price(selected_pool, total_pool)?;
    let required_amount = computed_price
        .checked_mul(quantity)
        .ok_or(PredictionMarketPlaceErrors::MathOverflow)?
        .checked_div(PRECISION)
        .ok_or(PredictionMarketPlaceErrors::MathOverflow)?;

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

    option_data.pool_amount = option_data
        .pool_amount
        .checked_add(required_amount)
        .ok_or(PredictionMarketPlaceErrors::MathOverflow)?;

    // write back
    market.options[option as usize] = option_data;

    let signer: &[&[u8]] = &[
        b"event_market",
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

#[derive(Accounts)]
pub struct ClaimEventWinningReward<'info> {
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

pub fn claim_event_winning_reward(ctx: Context<ClaimEventWinningReward>) -> Result<()> {
    let buyer = &mut ctx.accounts.buyer;
    let user_account = &mut ctx.accounts.user;
    let market = &mut ctx.accounts.market;
    let token_mint = &mut ctx.accounts.token_mint;
    let market_vault = &mut ctx.accounts.market_vault;
    let token_account = &mut ctx.accounts.token_account;

    let clock = Clock::get()?;

    require!(
        clock.unix_timestamp >= market.event_end_time,
        PredictionMarketPlaceErrors::MarketEndtimeNotReached
    );
    require!(
        market.resolved,
        PredictionMarketDaoErrors::EventNotYetResolved
    );

    require!(
        market.vault == market_vault.key(),
        PredictionMarketPlaceErrors::MarketVaultMismatch
    );
    require!(
        market.final_outcome.is_some(),
        PredictionMarketPlaceErrors::NoOutcome
    );

    let total_option_tokens = token_mint.supply;
    require!(
        total_option_tokens > 0,
        PredictionMarketPlaceErrors::NoTokensInMint
    );

    let mut option_index: Option<u8> = None;
    let mut total_pool = 0;
    for (i, option) in market.options.iter().enumerate() {
        if option.mint == token_mint.key() {
            option_index = Some(i as u8);
        }
        total_pool += option.pool_amount as u64;
    }
    // 5% of pool for dao reward
    let dao_reward = total_pool
        .checked_mul(5)
        .ok_or(PredictionMarketPlaceErrors::MathOverflow)?
        .checked_div(100)
        .ok_or(PredictionMarketPlaceErrors::MathOverflow)?;

    total_pool = total_pool
        .checked_sub(dao_reward)
        .ok_or(PredictionMarketPlaceErrors::MathOverflow)?;
    let option_index = option_index.ok_or(PredictionMarketPlaceErrors::TokenMintNotFound)?;

    let market_vault_account_info = market_vault.to_account_info();

    if let Some(outcome) = market.final_outcome {
        let user_account_info = user_account.to_account_info();
        let user_tokens = token_account.amount;
        let user_reward = user_tokens
            .checked_mul(total_pool)
            .ok_or(PredictionMarketPlaceErrors::MathOverflow)?
            .checked_div(total_option_tokens)
            .ok_or(PredictionMarketPlaceErrors::MathOverflow)?;
        let is_winning_option = outcome == option_index;
        require!(
            user_tokens != 0,
            PredictionMarketPlaceErrors::NoTokensAvailable
        );

        // if the tokens belong to the winning option , then reward them.
        if is_winning_option {
            let mut user_lamports = user_account_info.try_borrow_mut_lamports()?;
            let mut market_vault_lamports = market_vault_account_info.try_borrow_mut_lamports()?;
            require!(
                **market_vault_lamports >= user_reward,
                PredictionMarketPlaceErrors::InsufficientFundsInTreasury
            );

            **market_vault_lamports = (**market_vault_lamports)
                .checked_sub(user_reward)
                .ok_or(PredictionMarketPlaceErrors::MathOverflow)?;
            **user_lamports = (**user_lamports)
                .checked_add(user_reward)
                .ok_or(PredictionMarketPlaceErrors::MathOverflow)?;

            user_account.total_won_amount += user_reward as u64;
        }
        token::burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Burn {
                    mint: token_mint.to_account_info(),
                    from: token_account.to_account_info(),
                    authority: user_account_info,
                },
            ),
            user_tokens,
        )?;
    }

    Ok(())
}
