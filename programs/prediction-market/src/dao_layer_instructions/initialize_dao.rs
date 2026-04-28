use anchor_lang::prelude::*;
use anchor_spl::{associated_token::AssociatedToken, token::{self, Mint, MintTo, Token, TokenAccount}};

use crate::{Dao, DaoUser, MAX_USER, PredictionMarketDaoErrors, PredictionMarketPlaceDetails, PredictionMarketPlaceErrors};
use mpl_token_metadata::{MAX_URI_LENGTH, instructions::CreateMetadataAccountV3};
use mpl_token_metadata::types::DataV2;
#[derive(Accounts)]
pub struct InitializeDao<'info>{
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        mut,
        seeds = [b"predictionmarketplace_v1"],
        bump = prediction_market_place.bump,
    )]
    pub prediction_market_place: Account<'info, PredictionMarketPlaceDetails>,

    #[account(
        init,  
        payer = creator,
        space = Dao::LEN,
        seeds = [b"prediction_market_dao"],
        bump
    )]
    pub dao: Account<'info , Dao>,

    /// CHECK: Dao vault 
    #[account(
        init,
        payer = creator,
        space = 8,
        seeds = [b"prediction_market_dao_vault"],
        bump 
    )]
    pub dao_vault: UncheckedAccount<'info>,

    #[account(
        init,
        payer = creator,
        mint::authority = dao,
        mint::decimals = 6,
    )]
    pub mint: Account<'info,Mint>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info , Token>,
    pub rent: Sysvar<'info , Rent>,
}

pub fn initialize_dao(ctx: Context<InitializeDao>)->Result<()>{
    let prediction_market_place  = &mut ctx.accounts.prediction_market_place;
    let dao = &mut ctx.accounts.dao;
    let dao_vault = &mut ctx.accounts.dao_vault;
    let mint = &mut ctx.accounts.mint;
    let creator = &mut ctx.accounts.creator;

    require!(creator.key() == prediction_market_place.creator , PredictionMarketDaoErrors::CreatorMismatch);

    dao.creator = creator.key();
    dao.token_mint = mint.key();
    dao.vault = dao_vault.key();
    dao.total_members = 0;
    dao.total_events = 0;
    dao.vault_bump = ctx.bumps.dao_vault;
    dao.bump = ctx.bumps.dao;

    Ok(())
}

#[derive(Accounts)]
pub struct AddFounder<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    pub founder: SystemAccount<'info>,

    #[account(
        init,
        payer = creator,
        space = DaoUser::LEN,
        seeds = [b"dao_user" , founder.key().as_ref()],
        bump
    )]
    pub dao_user: Account<'info , DaoUser>,

    #[account(
        mut,
        seeds = [b"prediction_market_dao"],
        bump = dao.bump,
    )]
    pub dao: Account<'info , Dao>,

    #[account(
        mut,
        address = dao.token_mint,
    )]
    pub dao_token_mint: Account<'info,Mint>,

    #[account(
        init,
        payer = creator,
        mint::authority = dao,
        mint::decimals = 0,
    )]
    pub dao_nft_mint: Account<'info,Mint>,

    #[account(
        init,
        payer = creator,
        associated_token::mint = dao_token_mint,
        associated_token::authority = founder,
    )]
    pub founder_token_account: Account<'info, TokenAccount>,

    #[account(
        init,
        payer = creator,
        associated_token::mint = dao_nft_mint,
        associated_token::authority = founder,
    )]
    pub founder_nft_account: Account<'info , TokenAccount>,

    /// CHECK: metadata
    #[account(mut)]
    pub metadata: UncheckedAccount<'info>,

    /// CHECK: Metaplex metadata program
    #[account(address = mpl_token_metadata::ID)]
    pub metadata_program: UncheckedAccount<'info>,

    pub associated_token_program: Program<'info,AssociatedToken>,
    pub token_program: Program<'info,Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info , Rent>,
}

pub fn add_founder (ctx: Context<AddFounder>, username: String , symbol: String , uri: String) -> Result<()> {

    let founder = &mut ctx.accounts.founder;
    let dao_user = &mut ctx.accounts.dao_user;
    let founder_token_account = &mut ctx.accounts.founder_token_account;
    let founder_nft_account = &mut ctx.accounts.founder_nft_account;
    let dao = &mut ctx.accounts.dao;


    require!(ctx.accounts.dao_nft_mint.supply == 0 , PredictionMarketDaoErrors::NftAlreadyMinted);

    require!(username.len() <= MAX_USER, PredictionMarketPlaceErrors::UsernameTooLong);
    require!(symbol.len() <= MAX_USER , PredictionMarketDaoErrors::SymbolTooLong);
    require!(uri.len() <= MAX_URI_LENGTH,PredictionMarketDaoErrors::UriTooLong);


    // DAO NFT 
    let signer: &[&[u8]] = &[
        b"prediction_market_dao",
        &[dao.bump],
    ];

    let signer_seeds = &[signer];
    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(), 
            MintTo { 
                mint: ctx.accounts.dao_nft_mint.to_account_info(), 
                to: founder_nft_account.to_account_info(), 
                authority: dao.to_account_info(), 
            },
            signer_seeds,
        ), 
        1
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
        payer: ctx.accounts.creator.key(),
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
            ctx.accounts.creator.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
            ctx.accounts.rent.to_account_info(),
        ],
    )?;

    // 500 tokens to be minted
    token::mint_to(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(), 
            MintTo { 
                mint: ctx.accounts.dao_token_mint.to_account_info(), 
                to: founder_token_account.to_account_info(), 
                authority: dao.to_account_info(),
            }
        ), 
        200
    )?;


    dao_user.username = username; 
    dao_user.pubkey = founder.key();
    dao_user.nft_mint = ctx.accounts.dao_nft_mint.key();
    dao_user.reputation = 20;
    dao_user.token_balance = 200; 
    dao_user.total_actions = 0;
    dao_user.bump = ctx.bumps.dao_user;
    dao.total_members += 1 as u64;


    Ok(())
}