import { Connection, Keypair } from '@solana/web3.js';
import { ensureApiToken } from '../src/lib/keeper-auth';
import * as fs from 'fs';

async function main() {
  const secret = JSON.parse(fs.readFileSync(process.env.KEYPAIR_PATH || '/root/.config/solana/keeper-kp.json', 'utf-8'));
  const keeper = Keypair.fromSecretKey(new Uint8Array(secret));

  const connection = new Connection(
    process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
    'confirmed',
  );

  const txlineBase = process.env.TXLINE_API_URL || 'https://txline-dev.txodds.com';

  console.log('Wallet:', keeper.publicKey.toBase58());
  console.log('Getting API token...');

  const { jwt, apiToken } = await ensureApiToken(keeper, connection, txlineBase);

  console.log('JWT:', jwt);
  console.log('API Token:', apiToken);
}

main().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
