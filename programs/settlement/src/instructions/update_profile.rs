use anchor_lang::prelude::*;

use crate::state::UserProfile;

#[derive(Accounts)]
pub struct UpdateProfile<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"profile", authority.key().as_ref()],
        bump,
        has_one = authority,
    )]
    pub profile: Account<'info, UserProfile>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<UpdateProfile>, image_uri: String, x_handle: String) -> Result<()> {
    let profile = &mut ctx.accounts.profile;
    profile.image_uri = image_uri;
    profile.x_handle = x_handle;
    Ok(())
}
