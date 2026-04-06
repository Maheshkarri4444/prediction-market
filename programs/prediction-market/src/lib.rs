use anchor_lang::prelude::*;
pub mod errors;
pub use errors::*;
pub mod state;
pub use state::*;
pub mod constants;
pub mod instructions;
pub use constants::*;
declare_id!("3nvkQT6k9kcsRuUHoXhUg46p27as9SyJVq4Q6A6ATSkC");

#[program]
pub mod prediction_market {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
