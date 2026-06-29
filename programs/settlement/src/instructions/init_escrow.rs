use anchor_lang::prelude::*;

use crate::state::{Escrow, EscrowState};

#[derive(Accounts)]
#[instruction(expiry: i64, nonce: u64, fixture_name: String, selection: u8, label: String, odds: u64)]
pub struct InitEscrow<'info> {
    #[account(mut)]
    pub depositor: Signer<'info>,

    /// CHECK: recipient is a public key, no need to deserialize
    pub recipient: UncheckedAccount<'info>,

    #[account(
        init,
        payer = depositor,
        space = 8 + Escrow::INIT_SPACE,
        seeds = [b"escrow", depositor.key().as_ref(), recipient.key().as_ref(), &nonce.to_le_bytes()],
        bump,
    )]
    pub escrow: Account<'info, Escrow>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<InitEscrow>, expiry: i64, nonce: u64, fixture_name: String, selection: u8, label: String, odds: u64) -> Result<()> {
    let escrow = &mut ctx.accounts.escrow;
    escrow.depositor = ctx.accounts.depositor.key();
    escrow.recipient = ctx.accounts.recipient.key();
    escrow.nonce = nonce;
    escrow.fixture_name = fixture_name;
    escrow.selection = selection;
    escrow.label = label;
    escrow.odds = odds;
    escrow.mint = Pubkey::default();
    escrow.vault = Pubkey::default();
    escrow.amount = 0;
    escrow.expiry = expiry;
    escrow.state = EscrowState::Active;
    escrow.bump = ctx.bumps.escrow;
    escrow.vault_bump = 0;

    Ok(())
}
