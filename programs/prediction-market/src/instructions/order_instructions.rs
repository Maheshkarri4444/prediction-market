use anchor_lang::{accounts::option, prelude::*, system_program::Transfer};
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Burn, Mint, Token, TokenAccount},
};

use crate::{calculate_price, mint_tokens, QuestionType};
use crate::{Market, Order, PredictionMarketPlaceErrors, User};
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
        seeds = [b"market_vault", market.authority.as_ref(), market.key().as_ref()],
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

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}
pub fn create_order(ctx: Context<CreateOrder>, option: u8, quantity: u64) -> Result<()> {
    let order = &mut ctx.accounts.order;
    let market = &mut ctx.accounts.market;
    require!(
        option < market.num_options,
        PredictionMarketPlaceErrors::InvalidOption
    );
    let mut total_pool: u64 = 0;
    for (_, option) in market.options.iter().enumerate() {
        total_pool += option.pool_amount as u64;
        total_pool += option.virtual_pool_amount as u64;
    }

    let market_status = market.started;
    let market_info = market.to_account_info();
    let market_endtime = market.market_end_time;

    let market_vault = &mut ctx.accounts.market_vault;

    let selected = &mut market.options[option as usize];

    let pool_lamports = selected.pool_amount;

    let clock = Clock::get()?;

    require!(
        market_status,
        PredictionMarketPlaceErrors::MarketNotYetStarted
    );

    require!(
        clock.unix_timestamp < market_endtime,
        PredictionMarketPlaceErrors::MarketClosed
    );

    require!(
        ctx.accounts.token_mint.key() == selected.mint,
        PredictionMarketPlaceErrors::TokenMintMismatch
    );

    let selected_pool = pool_lamports + selected.virtual_pool_amount as u64;

    let computed_price = calculate_price(selected_pool, total_pool)?;
    let required_amount = computed_price as u64 * quantity as u64;

    let selected_mint = &ctx.accounts.token_mint;
    let selected_to_token_account = &ctx.accounts.token_account;

    let authority_info = market_info;

    require!(
        ctx.accounts.buyer.lamports() >= required_amount,
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

    selected.pool_amount = selected
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
    order.token_account = ctx.accounts.token_account.key();
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

    /// CHECK: yes pool vault for this market.
    #[account(
        mut,
        seeds = [b"market_vault", market.authority.as_ref(), market.key().as_ref()],
        bump = market.vault_bump,
    )]
    pub market_vault: UncheckedAccount<'info>,

    #[account(mut)]
    pub token_mint: Account<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = user,
    )]
    pub token_account: Account<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn claim_winning_reward(ctx: Context<ClaimWinningReward>) -> Result<()> {
    let market = &mut ctx.accounts.market;
    let token_mint = &mut ctx.accounts.token_mint;
    let token_account = &mut ctx.accounts.token_account;

    let user = &ctx.accounts.user;

    let market_vault = &mut ctx.accounts.market_vault;

    require!(
        market.resolved,
        PredictionMarketPlaceErrors::MarketNotYetResolved
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
    let option_index = option_index.ok_or(PredictionMarketPlaceErrors::TokenMintNotFound)?;

    let market_vault_account_info = market_vault.to_account_info();

    if let Some(outcome) = market.final_outcome {
        let user_account_info = user.to_account_info();
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
