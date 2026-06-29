import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

const TXLINE_API = Deno.env.get("TXLINE_API_URL") || "https://txline-dev.txodds.com";
const TXLINE_JWT = Deno.env.get("TXLINE_JWT") || "";
const TXLINE_API_TOKEN = Deno.env.get("TXLINE_API_TOKEN") || "";
const SETTLEMENT_PROGRAM_ID = Deno.env.get("SETTLEMENT_PROGRAM_ID") || "";

interface ScoreEvent {
  FixtureId: number;
  Status?: string;
  Score1?: number;
  Score2?: number;
  Minute?: number;
  Participant1?: string;
  Participant2?: string;
}

async function checkTxLineScores(): Promise<ScoreEvent[]> {
  const url = `${TXLINE_API}/api/scores/stream`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${TXLINE_JWT}`,
      "X-Api-Token": TXLINE_API_TOKEN,
      Accept: "text/event-stream",
      "Cache-Control": "no-cache",
    },
  });
  if (!response.ok) {
    throw new Error(`TxLINE API error: ${response.status}`);
  }
  const text = await response.text();
  const lines = text.split("\n").filter((l) => l.startsWith("data: "));
  const events: ScoreEvent[] = [];
  for (const line of lines) {
    try {
      const data = JSON.parse(line.slice(6));
      events.push(data);
    } catch {
      // skip malformed
    }
  }
  return events;
}

function isFinal(status?: string): boolean {
  if (!status) return false;
  const s = status.toLowerCase();
  return s === "final" || s === "finished" || s === "complete" || s === "settled";
}

export default {
  fetch: withSupabase({ auth: ["publishable", "secret"] }, async (req, ctx) => {
    try {
      const events = await checkTxLineScores();
      const finalized = events.filter((e) => isFinal(e.Status));

      if (finalized.length === 0) {
        return Response.json({
          ok: true,
          checked: events.length,
          finalized: 0,
          message: "No finalized matches found",
        });
      }

      const results = [];
      for (const event of finalized) {
        results.push({
          fixtureId: event.FixtureId,
          score: `${event.Score1 ?? 0}-${event.Score2 ?? 0}`,
          status: event.Status,
        });
      }

      if (SETTLEMENT_PROGRAM_ID) {
        try {
          const solanaResponse = await processSettlement(results);
          return Response.json({
            ok: true,
            checked: events.length,
            finalized: results.length,
            settlements: solanaResponse,
          });
        } catch (settleError) {
          return Response.json({
            ok: false,
            checked: events.length,
            finalized: results.length,
            error: `Settlement failed: ${settleError.message}`,
            matches: results,
          });
        }
      }

      return Response.json({
        ok: true,
        checked: events.length,
        finalized: results.length,
        matches: results,
        note: "Settlement program not configured",
      });
    } catch (err) {
      console.error("Keeper error:", err);
      return Response.json({ ok: false, error: err.message }, { status: 500 });
    }
  }),
};

async function processSettlement(matches: { fixtureId: number; score: string; status?: string }[]) {
  const { Keypair, Connection, PublicKey, Transaction, TransactionInstruction } = await import("npm:@solana/web3.js@^1");
  const connection = new Connection(
    Deno.env.get("SOLANA_RPC_URL") || "https://api.devnet.solana.com",
    "confirmed",
  );

  const secretKey = Deno.env.get("PAYER_SECRET_KEY");
  if (!secretKey) throw new Error("PAYER_SECRET_KEY not configured");

  const payer = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(secretKey)),
  );
  const programId = new PublicKey(SETTLEMENT_PROGRAM_ID);
  const results = [];

  for (const match of matches) {
    try {
      const [escrowPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("escrow"), payer.publicKey.toBuffer(), Buffer.from(match.fixtureId.toString())],
        programId,
      );

      const tx = new Transaction();
      const instruction = new TransactionInstruction({
        programId,
        keys: [
          { pubkey: payer.publicKey, isSigner: true, isWritable: true },
          { pubkey: escrowPda, isSigner: false, isWritable: true },
        ],
        data: Buffer.from([107, 197, 232, 90, 191, 136, 105, 185]),
      });
      tx.add(instruction);
      tx.feePayer = payer.publicKey;

      const { blockhash } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.sign(payer);

      const sig = await connection.sendRawTransaction(tx.serialize());
      await connection.confirmTransaction(sig, "confirmed");

      results.push({
        fixtureId: match.fixtureId,
        txSig: sig,
        status: "settled",
      });
    } catch (err) {
      results.push({
        fixtureId: match.fixtureId,
        error: err.message,
        status: "failed",
      });
    }
  }

  return results;
}
