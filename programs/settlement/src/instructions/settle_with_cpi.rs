use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface, transfer_checked, TransferChecked};

use crate::state::{Escrow, EscrowState};
use crate::errors::SettlementError;
use crate::cpi_txline::{self, Fixture, FixtureBatchSummary, ProofNode};

#[derive(Accounts)]
pub struct SettleWithCpi<'info> {
    pub caller: Signer<'info>,

    #[account(
        mut,
        seeds = [b"escrow", escrow.depositor.key().as_ref(), escrow.recipient.key().as_ref(), &escrow.nonce.to_le_bytes()],
        bump = escrow.bump,
        constraint = escrow.state == EscrowState::Active @ SettlementError::InvalidEscrowState,
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
    pub depositor_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub recipient_token_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,

    /// CHECK: TxLINE validation program for CPI
    pub txline_program: UncheckedAccount<'info>,

    /// CHECK: TenDailyFixturesRoots PDA owned by TxLINE program — verified in handler
    pub ten_daily_fixtures_roots: UncheckedAccount<'info>,
}

pub fn handler(
    ctx: Context<SettleWithCpi>,
    score1: u64,
    score2: u64,
    fixture_ts: i64,
    fixture_start_time: i64,
    competition: String,
    competition_id: i32,
    fixture_group_id: i32,
    participant1_id: i32,
    participant1: String,
    participant2_id: i32,
    participant2: String,
    fixture_id: i64,
    participant1_is_home: bool,
    summary_fixture_id: i64,
    summary_competition_id: i32,
    summary_competition: String,
    summary_update_count: u32,
    summary_min_timestamp: i64,
    summary_max_timestamp: i64,
    summary_sub_tree_root: [u8; 32],
    sub_tree_proof: Vec<ProofNode>,
    main_tree_proof: Vec<ProofNode>,
) -> Result<()> {
    let expected_fixtures_pda = Pubkey::find_program_address(
        &[b"ten_daily_fixtures_roots"],
        &ctx.accounts.txline_program.key(),
    )
    .0;
    require!(
        ctx.accounts.ten_daily_fixtures_roots.key() == expected_fixtures_pda,
        SettlementError::InvalidTxLinePda
    );

    let fixture = Fixture {
        ts: fixture_ts,
        start_time: fixture_start_time,
        competition,
        competition_id,
        fixture_group_id,
        participant1_id,
        participant1,
        participant2_id,
        participant2,
        fixture_id,
        participant1_is_home,
    };

    let summary = FixtureBatchSummary {
        fixture_id: summary_fixture_id,
        competition_id: summary_competition_id,
        competition: summary_competition,
        update_stats: cpi_txline::FixtureUpdateStats {
            update_count: summary_update_count,
            min_timestamp: summary_min_timestamp,
            max_timestamp: summary_max_timestamp,
        },
        update_sub_tree_root: summary_sub_tree_root,
    };

    cpi_txline::validate_fixture_cpi(
        &ctx.accounts.txline_program.to_account_info(),
        &ctx.accounts.ten_daily_fixtures_roots.to_account_info(),
        &fixture,
        &summary,
        &sub_tree_proof,
        &main_tree_proof,
    )?;

    let depositor_won = if score1 > score2 {
        ctx.accounts.escrow.selection == 0
    } else if score1 < score2 {
        ctx.accounts.escrow.selection == 2
    } else {
        ctx.accounts.escrow.selection == 1
    };

    let escrow_account_info = ctx.accounts.escrow.to_account_info();
    let escrow_amount = ctx.accounts.escrow.amount;
    let escrow_key = ctx.accounts.escrow.key();
    let vault_bump = ctx.accounts.escrow.vault_bump;

    let vault_seeds = &[b"vault", escrow_key.as_ref(), &[vault_bump]];
    let vault_signer = &[&vault_seeds[..]];

    let destination = if depositor_won {
        ctx.accounts.depositor_token_account.to_account_info()
    } else {
        ctx.accounts.recipient_token_account.to_account_info()
    };

    transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            TransferChecked {
                from: ctx.accounts.vault.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: destination,
                authority: escrow_account_info,
            },
            vault_signer,
        ),
        escrow_amount,
        ctx.accounts.mint.decimals,
    )?;

    let escrow = &mut ctx.accounts.escrow;
    escrow.depositor_won = depositor_won;
    escrow.state = EscrowState::Settled;

    Ok(())
}
