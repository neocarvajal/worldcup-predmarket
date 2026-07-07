use anchor_lang::prelude::*;

pub mod cpi_txline;
pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("E4Y1BwM5BDXzTSkoACbwTT6Zg86wHETDWMNPLh4Hriu6");

#[program]
pub mod settlement {
    use super::*;

    pub fn init_escrow(ctx: Context<InitEscrow>, expiry: i64, nonce: u64, fixture_id: u64, fixture_name: String, selection: u8, label: String, odds: u64) -> Result<()> {
        instructions::init_escrow::handler(ctx, expiry, nonce, fixture_id, fixture_name, selection, label, odds)
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        instructions::deposit::handler(ctx, amount)
    }

    pub fn settle(ctx: Context<Settle>) -> Result<()> {
        instructions::settle::handler(ctx)
    }

    pub fn settle_with_cpi(
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
        fixture_epoch_day: u16,
        summary_fixture_id: i64,
        summary_competition_id: i32,
        summary_competition: String,
        summary_update_count: u32,
        summary_min_timestamp: i64,
        summary_max_timestamp: i64,
        summary_sub_tree_root: [u8; 32],
        sub_tree_proof: Vec<cpi_txline::ProofNode>,
        main_tree_proof: Vec<cpi_txline::ProofNode>,
    ) -> Result<()> {
        instructions::settle_with_cpi::handler(
            ctx, score1, score2,
            fixture_ts, fixture_start_time,
            competition, competition_id, fixture_group_id,
            participant1_id, participant1, participant2_id, participant2,
            fixture_id, participant1_is_home, fixture_epoch_day,
            summary_fixture_id, summary_competition_id, summary_competition,
            summary_update_count, summary_min_timestamp, summary_max_timestamp,
            summary_sub_tree_root,
            sub_tree_proof, main_tree_proof,
        )
    }

    pub fn claim(ctx: Context<Claim>) -> Result<()> {
        instructions::claim::handler(ctx)
    }

    pub fn cancel(ctx: Context<Cancel>) -> Result<()> {
        instructions::cancel::handler(ctx)
    }

    pub fn init_profile(ctx: Context<InitProfile>, image_uri: String, x_handle: String) -> Result<()> {
        instructions::init_profile::handler(ctx, image_uri, x_handle)
    }

    pub fn update_profile(ctx: Context<UpdateProfile>, image_uri: String, x_handle: String) -> Result<()> {
        instructions::update_profile::handler(ctx, image_uri, x_handle)
    }

    pub fn set_txline_token(ctx: Context<SetTxlineToken>, token: String) -> Result<()> {
        instructions::set_txline_token::set_txline_token(ctx, token)
    }
}
