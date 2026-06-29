use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface, transfer_checked, TransferChecked};

use crate::state::{Escrow, EscrowState};
use crate::errors::SettlementError;

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub depositor: Signer<'info>,

    #[account(
        mut,
        seeds = [b"escrow", escrow.depositor.key().as_ref(), escrow.recipient.key().as_ref(), &escrow.nonce.to_le_bytes()],
        bump = escrow.bump,
        constraint = escrow.depositor == depositor.key() @ SettlementError::InvalidDepositor,
        constraint = escrow.state == EscrowState::Active @ SettlementError::InvalidEscrowState,
    )]
    pub escrow: Account<'info, Escrow>,

    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        init,
        payer = depositor,
        token::mint = mint,
        token::authority = escrow,
        seeds = [b"vault", escrow.key().as_ref()],
        bump,
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub user_token_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Deposit>, amount: u64) -> Result<()> {
    let escrow = &mut ctx.accounts.escrow;

    require!(amount > 0, SettlementError::ArithmeticOverflow);
    require!(
        escrow.vault == Pubkey::default(),
        SettlementError::AlreadySettled
    );

    transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.key(),
            TransferChecked {
                from: ctx.accounts.user_token_account.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.depositor.to_account_info(),
            },
        ),
        amount,
        ctx.accounts.mint.decimals,
    )?;

    escrow.mint = ctx.accounts.mint.key();
    escrow.vault = ctx.accounts.vault.key();
    escrow.vault_bump = ctx.bumps.vault;
    escrow.amount = escrow
        .amount
        .checked_add(amount)
        .ok_or(SettlementError::ArithmeticOverflow)?;

    Ok(())
}
