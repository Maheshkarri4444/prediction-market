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

declare_id!("HMYsLuDhjARNTLb5eTbZS6aiJSfHgZ1tDwkJTMF2tKs3");

#[program]
pub mod prediction_market {

    use super::*;

    // -----------------------------------
    // INITIALIZE CORE
    // -----------------------------------
    pub fn initialize_prediction_market(ctx: Context<InitializePredictionMarket>) -> Result<()> {
        instructions::initialize_prediction_market(ctx)
    }

    pub fn create_user(ctx: Context<CreateUser>, username: String) -> Result<()> {
        instructions::create_user(ctx, username)
    }

    // NORMAL MARKET FLOW
    pub fn create_market(
        ctx: Context<CreateMarket>,
        question_type: QuestionType,
        question: String,
        market_end_time: i64,
    ) -> Result<()> {
        instructions::create_market(ctx, question_type, question, market_end_time)
    }

    pub fn add_option_details(ctx: Context<AddOptionDetails>) -> Result<()> {
        instructions::add_option_details(ctx)
    }

    pub fn create_order(ctx: Context<CreateOrder>, option: u8, quantity: u64) -> Result<()> {
        instructions::create_order(ctx, option, quantity)
    }

    pub fn resolve_market(ctx: Context<ResolveMarket>) -> Result<()> {
        instructions::resolve_market(ctx)
    }

    pub fn claim_winning_reward(ctx: Context<ClaimWinningReward>) -> Result<()> {
        instructions::claim_winning_reward(ctx)
    }

    pub fn claim_funds(ctx: Context<ClaimFunds>) -> Result<()> {
        instructions::claim_funds(ctx)
    }

    // EVENT MARKET FLOW
    pub fn create_event_market(
        ctx: Context<CreateEventMarket>,
        question_type: EventQuestionType,
        question: String,
        market_end_time: i64,
        event_end_time: i64,
    ) -> Result<()> {
        instructions::create_event_market(
            ctx,
            question_type,
            question,
            market_end_time,
            event_end_time,
        )
    }

    pub fn add_option_for_event_market(ctx: Context<AddEventOptionDetails>) -> Result<()> {
        instructions::add_option_for_event_market(ctx)
    }

    pub fn create_event_order(
        ctx: Context<CreateEventOrder>,
        option: u8,
        quantity: u64,
    ) -> Result<()> {
        instructions::create_event_order(ctx, option, quantity)
    }

    pub fn resolve_event_market(ctx: Context<ResolveEvent>) -> Result<()> {
        instructions::resolve_event_market(ctx)
    }

    pub fn claim_event_winning_reward(ctx: Context<ClaimEventWinningReward>) -> Result<()> {
        instructions::claim_event_winning_reward(ctx)
    }

    // DAO LAYER

    pub fn initialize_dao(ctx: Context<InitializeDao>) -> Result<()> {
        dao_layer_instructions::initialize_dao(ctx)
    }

    pub fn create_dao_user(
        ctx: Context<CreateDaoUser>,
        username: String,
        symbol: String,
        uri: String,
    ) -> Result<()> {
        dao_layer_instructions::create_dao_user(ctx, username, symbol, uri)
    }

    pub fn stake(ctx: Context<DaoUserStake>, amount: u64) -> Result<()> {
        dao_layer_instructions::dao_user_stake(ctx, amount)
    }

    pub fn unstake(ctx: Context<DaoUserUnstake>, amount: u64) -> Result<()> {
        dao_layer_instructions::dao_user_unstake(ctx, amount)
    }

    pub fn vote_on_market(ctx: Context<VoteOnMarket>, option: u8, amount: u64) -> Result<()> {
        dao_layer_instructions::vote_on_market(ctx, option, amount)
    }

    pub fn claim_stake(ctx: Context<ClaimStake>) -> Result<()> {
        dao_layer_instructions::claim_stake(ctx)
    }
}
