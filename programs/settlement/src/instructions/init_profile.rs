use anchor_lang::prelude::*;

use crate::state::UserProfile;

#[derive(Accounts)]
pub struct InitProfile<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + UserProfile::INIT_SPACE,
        seeds = [b"profile", authority.key().as_ref()],
        bump,
    )]
    pub profile: Account<'info, UserProfile>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<InitProfile>, image_uri: String, x_handle: String, notifications_enabled: bool) -> Result<()> {
    let profile = &mut ctx.accounts.profile;
    profile.authority = ctx.accounts.authority.key();
    profile.image_uri = image_uri;
    profile.x_handle = x_handle;
    profile.notifications_enabled = notifications_enabled;
    Ok(())
}
