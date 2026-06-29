import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, createMint, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import { assert } from "chai";
import { Settlement } from "../target/types/settlement";

describe("settlement", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Settlement as Program<Settlement>;
  const depositor = provider.wallet.publicKey;

  let mint: PublicKey;
  let recipient: PublicKey;
  let escrowPda: PublicKey;
  let vaultPda: PublicKey;
  let userTokenAccount: PublicKey;
  let recipientTokenAccount: PublicKey;

  before(async () => {
    mint = await createMint(provider.connection, (provider.wallet as any).payer, depositor, null, 9);
    recipient = Keypair.generate().publicKey;

    const userAta = await getOrCreateAssociatedTokenAccount(
      provider.connection, (provider.wallet as any).payer, mint, depositor
    );
    userTokenAccount = userAta.address;

    const recipientAta = await getOrCreateAssociatedTokenAccount(
      provider.connection, (provider.wallet as any).payer, mint, recipient
    );
    recipientTokenAccount = recipientAta.address;

    await mintTo(provider.connection, (provider.wallet as any).payer, mint, userTokenAccount, depositor, 10_000_000_000);

    [escrowPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("escrow"), depositor.toBuffer(), recipient.toBuffer()],
      program.programId
    );
    [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), escrowPda.toBuffer()],
      program.programId
    );
  });

  it("initializes an escrow", async () => {
    const expiry = new anchor.BN(Math.floor(Date.now() / 1000) + 86400);

    await program.methods
      .initEscrow(expiry)
      .accountsStrict({
        depositor,
        recipient,
        escrow: escrowPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const escrow = await program.account.escrow.fetch(escrowPda);
    assert.equal(escrow.depositor.toBase58(), depositor.toBase58());
    assert.equal(escrow.recipient.toBase58(), recipient.toBase58());
    assert.equal(escrow.state, { active: {} });
  });

  it("deposits into escrow", async () => {
    const amount = new anchor.BN(1_000_000_000);

    await program.methods
      .deposit(amount)
      .accountsStrict({
        depositor,
        escrow: escrowPda,
        mint,
        vault: vaultPda,
        userTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const escrow = await program.account.escrow.fetch(escrowPda);
    assert.equal(escrow.amount.toString(), amount.toString());
    assert.equal(escrow.mint.toBase58(), mint.toBase58());
  });

  it("settles escrow to recipient", async () => {
    const balanceBefore = await provider.connection.getTokenAccountBalance(recipientTokenAccount);

    await program.methods
      .settle()
      .accountsStrict({
        caller: depositor,
        escrow: escrowPda,
        mint,
        vault: vaultPda,
        recipientTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    const escrow = await program.account.escrow.fetch(escrowPda);
    assert.equal(escrow.state, { settled: {} });

    const balanceAfter = await provider.connection.getTokenAccountBalance(recipientTokenAccount);
    assert(balanceAfter.value.amount === "1000000000");
  });
});
