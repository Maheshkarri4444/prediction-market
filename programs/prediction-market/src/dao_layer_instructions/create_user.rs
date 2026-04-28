use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, MintTo, Token, TokenAccount},
};
use mpl_token_metadata::{instructions::CreateMetadataAccountV3, types::DataV2, MAX_URI_LENGTH};

use crate::PredictionMarketPlaceErrors;
use crate::{Dao, DaoUser, DAO_USER_CREATION_FEE};
use crate::{PredictionMarketDaoErrors, MAX_USER};

#[derive(Accounts)]
pub struct CreateDaoUser<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [b"prediction_market_dao"],
        bump = dao.bump,
    )]
    pub dao: Account<'info, Dao>,

    /// CHECK: Dao vault
    #[account(
        mut,
        seeds = [b"prediction_market_dao_vault"],
        bump = dao.vault_bump,
    )]
    pub dao_vault: UncheckedAccount<'info>,

    #[account(
        init,
        payer = user,
        space = Dao::LEN,
        seeds = [b"dao_user" , user.key().as_ref()],
        bump
    )]
    pub dao_user: Account<'info, DaoUser>,

    #[account(
        mut,
        address = dao.token_mint,
    )]
    pub dao_token_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = user,
        mint::authority = dao,
        mint::decimals = 0,
    )]
    pub dao_nft_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = user,
        associated_token::mint = dao_token_mint,
        associated_token::authority = user,
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(
        init,
        payer = user,
        associated_token::mint = dao_nft_mint,
        associated_token::authority = user,
    )]
    pub user_nft_account: Account<'info, TokenAccount>,

    /// CHECK: metadata
    #[account(mut)]
    pub metadata: UncheckedAccount<'info>,

    /// CHECK: Metaplex metadata program
    #[account(address = mpl_token_metadata::ID)]
    pub metadata_program: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn create_user(
    ctx: Context<CreateDaoUser>,
    username: String,
    symbol: String,
    uri: String,
) -> Result<()> {
    let dao = &mut ctx.accounts.dao;
    let user = &mut ctx.accounts.user;
    let dao_user = &mut ctx.accounts.dao_user;
    let user_token_account = &mut ctx.accounts.user_token_account;
    let user_nft_account = &mut ctx.accounts.user_nft_account;

    require!(
        ctx.accounts.dao_nft_mint.supply == 0,
        PredictionMarketDaoErrors::NftAlreadyMinted
    );
    require!(
        username.len() <= MAX_USER,
        PredictionMarketPlaceErrors::UsernameTooLong
    );
    require!(
        symbol.len() <= MAX_USER,
        PredictionMarketDaoErrors::SymbolTooLong
    );
    require!(
        uri.len() <= MAX_URI_LENGTH,
        PredictionMarketDaoErrors::UriTooLong
    );

    require!(
        user.lamports() >= DAO_USER_CREATION_FEE,
        PredictionMarketDaoErrors::InsufficientBalance
    );

    {
        let user_info = ctx.accounts.user.to_account_info();
        let mut user_lamports = user_info.try_borrow_mut_lamports()?;

        let dao_vault_info = ctx.accounts.dao_vault.to_account_info();
        let mut dao_vault_lamports = dao_vault_info.try_borrow_mut_lamports()?;

        **user_lamports = (**user_lamports)
            .checked_sub(DAO_USER_CREATION_FEE)
            .ok_or(PredictionMarketPlaceErrors::FundTransferError)?;
        **dao_vault_lamports = (**dao_vault_lamports)
            .checked_add(DAO_USER_CREATION_FEE)
            .ok_or(PredictionMarketPlaceErrors::FundTransferError)?;
    }

    // DAO NFT
    let signer: &[&[u8]] = &[b"prediction_market_dao", &[dao.bump]];

    let signer_seeds = &[signer];
    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.dao_nft_mint.to_account_info(),
                to: user_nft_account.to_account_info(),
                authority: dao.to_account_info(),
            },
            signer_seeds,
        ),
        1,
    )?;

    // metaplex metadata
    let name = username.clone();
    let data = DataV2 {
        name,
        symbol,
        uri,
        seller_fee_basis_points: 500,
        creators: None,
        collection: None,
        uses: None,
    };

    let ix = CreateMetadataAccountV3 {
        metadata: ctx.accounts.metadata.key(),
        mint: ctx.accounts.dao_nft_mint.key(),
        mint_authority: dao.key(),
        payer: ctx.accounts.user.key(),
        update_authority: (dao.key(), true),
        system_program: ctx.accounts.system_program.key(),
        rent: Some(ctx.accounts.rent.key()),
    }
    .instruction(
        mpl_token_metadata::instructions::CreateMetadataAccountV3InstructionArgs {
            data,
            is_mutable: true,
            collection_details: None,
        },
    );

    anchor_lang::solana_program::program::invoke(
        &ix,
        &[
            ctx.accounts.metadata_program.to_account_info(),
            ctx.accounts.metadata.to_account_info(),
            ctx.accounts.dao_nft_mint.to_account_info(),
            dao.to_account_info(),
            ctx.accounts.user.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
            ctx.accounts.rent.to_account_info(),
        ],
    )?;

    // 100 tokens to be minted
    token::mint_to(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.dao_token_mint.to_account_info(),
                to: user_token_account.to_account_info(),
                authority: dao.to_account_info(),
            },
        ),
        100,
    )?;

    dao_user.username = username;
    dao_user.pubkey = ctx.accounts.user.key();
    dao_user.nft_mint = ctx.accounts.dao_nft_mint.key();
    dao_user.reputation = 10;
    dao_user.token_balance = 100;
    dao_user.total_actions = 0;
    dao_user.bump = ctx.bumps.dao_user;

    dao.total_members += 1 as u64;

    Ok(())
}
