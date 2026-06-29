use anchor_lang::prelude::*;

#[error_code]
pub enum SettlementError {
    #[msg("Escrow already settled")]
    AlreadySettled,
    #[msg("Escrow already cancelled")]
    AlreadyCancelled,
    #[msg("Escrow expired")]
    EscrowExpired,
    #[msg("Not the intended recipient")]
    InvalidRecipient,
    #[msg("Not the depositor")]
    InvalidDepositor,
    #[msg("Invalid escrow state for this action")]
    InvalidEscrowState,
    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,
    #[msg("Invalid token account")]
    InvalidTokenAccount,
    #[msg("Escrow not yet fulfillable")]
    NotFulfillable,
}
