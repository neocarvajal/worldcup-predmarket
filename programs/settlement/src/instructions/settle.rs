use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface, transfer_checked, TransferChecked};

use crate::state::{Escrow, EscrowState};
use crate::errors::SettlementError;

#[derive(Accounts)]
pub struct Settle<'info> {
    /// CHECK: caller can be anyone (recipient or depositor triggers settlement)
    pub caller: Signer<'info>,

    #[account(
        mut,
        seeds = [b"escrow", escrow.depositor.key().as_ref(), escrow.recipient.key().as_ref(), &escrow.nonce.to_le_bytes()],
        bump = escrow.bump,
        constraint = escrow.state == EscrowState::Active @ SettlementError::InvalidEscrowState,
        constraint = Clock::get()?.unix_timestamp < escrow.expiry @ SettlementError::EscrowExpired,
    )]
    pub escrow: Account<'info, Escrow>,

    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        seeds = [b"vault", escrow.key().as_ref()],
        bump = escrow.vault_bump,
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub recipient_token_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handler(ctx: Context<Settle>) -> Result<()> {
    let escrow_account_info = ctx.accounts.escrow.to_account_info();
    let escrow_amount = ctx.accounts.escrow.amount;
    let escrow_key = ctx.accounts.escrow.key();
    let vault_bump = ctx.accounts.escrow.vault_bump;

    let vault_seeds = &[b"vault", escrow_key.as_ref(), &[vault_bump]];
    let vault_signer = &[&vault_seeds[..]];

    transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            TransferChecked {
                from: ctx.accounts.vault.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.recipient_token_account.to_account_info(),
                authority: escrow_account_info,
            },
            vault_signer,
        ),
        escrow_amount,
        ctx.accounts.mint.decimals,
    )?;

    ctx.accounts.escrow.state = EscrowState::Settled;

    Ok(())
}
