use anchor_lang::prelude::*;
use crate::state::UserProfile;

#[derive(Accounts)]
pub struct SetTxlineToken<'info> {
    #[account(mut, has_one = authority)]
    pub profile: Account<'info, UserProfile>,
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn set_txline_token(ctx: Context<SetTxlineToken>, token: String) -> Result<()> {
    let profile = &mut ctx.accounts.profile;
    profile.txline_api_token = token;
    Ok(())
}
