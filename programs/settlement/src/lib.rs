use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("568BYcuHndKngsEYfEv7aMTqFXRCC5MzRxZdJuZDgU2J");

#[program]
pub mod settlement {
    use super::*;

    pub fn init_escrow(ctx: Context<InitEscrow>, expiry: i64, nonce: u64, fixture_name: String, selection: u8, label: String, odds: u64) -> Result<()> {
        instructions::init_escrow::handler(ctx, expiry, nonce, fixture_name, selection, label, odds)
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        instructions::deposit::handler(ctx, amount)
    }

    pub fn settle(ctx: Context<Settle>) -> Result<()> {
        instructions::settle::handler(ctx)
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
}
