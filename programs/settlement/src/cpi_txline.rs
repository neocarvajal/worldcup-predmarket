use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::Instruction;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct ProofNode {
    pub hash: [u8; 32],
    pub is_right_sibling: bool,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct Fixture {
    pub ts: i64,
    pub start_time: i64,
    pub competition: String,
    pub competition_id: i32,
    pub fixture_group_id: i32,
    pub participant1_id: i32,
    pub participant1: String,
    pub participant2_id: i32,
    pub participant2: String,
    pub fixture_id: i64,
    pub participant1_is_home: bool,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct FixtureUpdateStats {
    pub update_count: u32,
    pub min_timestamp: i64,
    pub max_timestamp: i64,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct FixtureBatchSummary {
    pub fixture_id: i64,
    pub competition_id: i32,
    pub competition: String,
    pub update_stats: FixtureUpdateStats,
    pub update_sub_tree_root: [u8; 32],
}

pub fn validate_fixture_cpi(
    txline_program: &AccountInfo,
    ten_daily_fixtures_roots: &AccountInfo,
    snapshot: &Fixture,
    summary: &FixtureBatchSummary,
    sub_tree_proof: &[ProofNode],
    main_tree_proof: &[ProofNode],
) -> Result<()> {
    let discriminator = [231u8, 129, 218, 86, 223, 114, 21, 126];

    let mut data = Vec::with_capacity(1024);
    data.extend_from_slice(&discriminator);

    snapshot.serialize(&mut data)?;
    summary.serialize(&mut data)?;
    (sub_tree_proof.len() as u32).serialize(&mut data)?;
    for node in sub_tree_proof {
        node.serialize(&mut data)?;
    }
    (main_tree_proof.len() as u32).serialize(&mut data)?;
    for node in main_tree_proof {
        node.serialize(&mut data)?;
    }

    let accounts = vec![AccountMeta::new_readonly(
        ten_daily_fixtures_roots.key(),
        false,
    )];

    let instruction = Instruction {
        program_id: txline_program.key(),
        accounts,
        data,
    };

    anchor_lang::solana_program::program::invoke(
        &instruction,
        &[ten_daily_fixtures_roots.clone()],
    )?;

    Ok(())
}
