use anchor_lang::prelude::*;
pub mod errors;
pub use errors::*;
pub mod state;
pub use state::*;
pub mod constants;
pub mod instructions;
pub use constants::*;
pub use instructions::*;
pub mod helper;
pub use helper::*;

pub mod dao_layer_instructions;
pub use dao_layer_instructions::*;
pub mod dao_layer_states;
pub use dao_layer_states::*;

declare_id!("9JcjW2redyHBkahstcNDvDJWd4zmPypDeufvS3NDeFyu");

#[program]
pub mod prediction_market {

    use super::*;
    // init dao
    pub fn initialize_prediction_market(ctx: Context<InitializePredictionMarket>) -> Result<()> {
        instructions::initialize_prediction_market(ctx)
    }

    // create user
    pub fn create_user(ctx: Context<CreateUser>, username: String) -> Result<()> {
        instructions::create_user(ctx, username)
    }

    // -----------------------------------
    // CREATE MARKET
    // -----------------------------------
    pub fn create_market(
        ctx: Context<CreateMarket>,
        question_type: QuestionType,
        question: String,
        market_end_time: i64,
    ) -> Result<()> {
        instructions::create_market(ctx, question_type, question, market_end_time)
    }

    // -----------------------------------
    // CREATE ORDER
    // -----------------------------------
    pub fn create_order(ctx: Context<CreateOrder>, option: u8, quantity: u64) -> Result<()> {
        instructions::create_order(ctx, option, quantity)
    }

    // -----------------------------------
    // RESOLVE MARKET
    // -----------------------------------
    pub fn resolve_market(ctx: Context<ResolveMarket>) -> Result<()> {
        instructions::resolve_market(ctx)
    }

    // -----------------------------------
    // CLAIM REWARD
    // -----------------------------------
    pub fn claim_winning_reward(ctx: Context<ClaimWinningReward>) -> Result<()> {
        instructions::claim_winning_reward(ctx)
    }

    // -----------------------------------
    // CLAIM TREASURY FUNDS
    // -----------------------------------
    pub fn claim_funds(ctx: Context<ClaimFunds>) -> Result<()> {
        instructions::claim_funds(ctx)
    }
}
