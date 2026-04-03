use anchor_lang::prelude::*;

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
