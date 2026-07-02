import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from '@solana/spl-token';
import { requestUsdtFaucet, getUsdtBalance } from '../src/lib/txlineProgram';

const USDT_MINT = new PublicKey('ELWTKspHKCnCfCiCiqYw1EDH77k8VCP74dK9qytG2Ujh');
const KEEPER_PUBKEY = new PublicKey('4mE8UiN1eyTPB2Gcw5R8XTHibpSD58fTwHpP2BypTHT2');

async function main() {
  const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
  const connection = new Connection(rpcUrl, 'confirmed');

  let keeperKp: Keypair;

  const secretEnv = process.env.PAYER_SECRET_KEY;
  if (secretEnv) {
    keeperKp = Keypair.fromSecretKey(new Uint8Array(JSON.parse(secretEnv)));
  } else {
    const fs = await import('fs');
    const home = process.env.HOME || '/root';
    const kpPath = `${home}/.config/solana/keeper-kp.json`;
    if (!fs.existsSync(kpPath)) {
      console.error('No PAYER_SECRET_KEY env var and no keeper-kp.json found');
      process.exit(1);
    }
    keeperKp = Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync(kpPath, 'utf-8'))));
  }

  console.log('Keeper pubkey:', keeperKp.publicKey.toBase58());

  const balance = await getUsdtBalance(connection, keeperKp.publicKey);
  console.log(`Current USDT balance: ${balance}`);

  const ata = getAssociatedTokenAddressSync(USDT_MINT, keeperKp.publicKey, false, TOKEN_PROGRAM_ID);
  const ataInfo = await connection.getAccountInfo(ata);
  console.log(`ATA exists: ${!!ataInfo}`);

  const wallet = {
    publicKey: keeperKp.publicKey,
    signTransaction: async (tx: any) => { tx.sign([keeperKp]); return tx; },
    signAllTransactions: async (txs: any[]) => { for (const tx of txs) tx.sign([keeperKp]); return txs; },
  };

  console.log('Calling USDT faucet...');
  const sig = await requestUsdtFaucet(connection, wallet);
  console.log('Faucet tx:', sig);

  const newBalance = await getUsdtBalance(connection, keeperKp.publicKey);
  console.log(`New USDT balance: ${newBalance}`);
}

main().catch(console.error);
