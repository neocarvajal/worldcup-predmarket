use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Escrow {
    pub depositor: Pubkey,
    pub recipient: Pubkey,
    pub nonce: u64,
    pub fixture_id: u64,
    #[max_len(64)]
    pub fixture_name: String,
    pub selection: u8,
    #[max_len(32)]
    pub label: String,
    pub odds: u64,
    pub mint: Pubkey,
    pub vault: Pubkey,
    pub amount: u64,
    pub expiry: i64,
    pub depositor_won: bool,   
    pub state: EscrowState,
    pub bump: u8,
    pub vault_bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, InitSpace)]
pub enum EscrowState {
    Active,
    Settled,
    Cancelled,
}

#[account]
#[derive(InitSpace)]
pub struct UserProfile {
    pub authority: Pubkey,
    #[max_len(256)]
    pub txline_api_token: String,
    #[max_len(256)]
    pub image_uri: String,
    #[max_len(50)]
    pub x_handle: String,
}
