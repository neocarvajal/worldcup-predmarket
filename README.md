<p align="center">
  <img src="./public/favicon.svg" width="80" height="80" alt="WC logo">
</p>

<h1 align="center">WorldCup PredMarket</h1>

<p align="center">
  <strong>Decentralized prediction market for the 2026 World Cup — built on Solana.</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#project-structure">Project Structure</a> •
  <a href="#key-flows">Key Flows</a>
</p>

---

## What is this?

WorldCup PredMarket lets you bet on 2026 World Cup match outcomes using USDT as collateral. Bets are locked in smart contract escrows and settled automatically using verifiable on-chain data from the **TxLINE oracle**. No KYC, no intermediaries — just connect your Solana wallet and predict.

Live at: **[worldcup-hackathon.vercel.app](https://worldcup-hackathon.vercel.app)** (Devnet)

## Features

- **Wallet-native** — any Solana wallet (Phantom, Backpack, Solflare), Devnet
- **Bet 1-X-2** — pick home, draw, or away for any World Cup match
- **USDT escrows** — funds locked in Anchor program escrows
- **Auto-settlement** — keeper bot settles winning bets every 5 minutes (or instantly via live page polling)
- **On-chain verification** — TxLINE oracle provides Merkle proofs for match results
- **Real-time scores** — live score streaming via SSE from TxLINE
- **Faucet** — get test USDT on Devnet directly from the app

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Frontend (Next.js)                 │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │ Markets  │  │ Portfolio│  │ Live Scores (SSE) │  │
│  └────┬─────┘  └────┬─────┘  └────────┬──────────┘  │
│       │              │                 │              │
│  ┌────┴──────────────┴─────────────────┴──────────┐  │
│  │  Settlement SDK (Anchor CPI calls)              │  │
│  │  src/lib/settlement.ts                          │  │
│  └──────────────────────┬──────────────────────────┘  │
└─────────────────────────┼────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
┌─────────────────┐ ┌──────────┐ ┌──────────────┐
│  Settlement     │ │  TxLINE  │ │  Supabase    │
│  Program (Anchor)│ │  Oracle  │ │  (keeper DB) │
│  E4Y1BwM5BD...  │ │  6pW64gN │ │              │
└────────┬────────┘ └────┬─────┘ └──────┬───────┘
         │               │               │
         ▼               ▼               ▼
┌───────────────────────────────────────────────┐
│              Solana Devnet RPC                  │
└───────────────────────────────────────────────┘
```

**Off-chain Keeper Bot:**
```
pg_cron (Supabase) → Edge Function → POST /api/keeper/settle → settleActiveEscrows()
   └─ Fetches active escrows → resolves fixtureId → checks StatusId →
      gets scores → gets Merkle proofs → calls settle_with_cpi
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (React), TypeScript, Tailwind CSS |
| Blockchain | Solana (Devnet) |
| Smart Contracts | Anchor Framework (Rust) |
| Oracle | TxLINE (on-chain verifiable sports data) |
| Stablecoin | USDT (SPL Token) |
| Database | Supabase (keeper state, token persistence) |
| Wallet | @solana/wallet-adapter (Phantom, Backpack, Solflare) |
| Auth | Self-custodial — just connect your wallet |
| Keeper | Node.js (on Vercel + Supabase pg_cron) |

## Program Addresses

### Settlement Program (Anchor)

| Item | Address |
|------|---------|
| Program ID | `E4Y1BwM5BDXzTSkoACbwTT6Zg86wHETDWMNPLh4Hriu6` |

**Instructions:**
| Instruction | Description |
|-------------|-------------|
| `InitEscrow` | Create a new prediction escrow (depositor, recipient, fixture, selection, odds) |
| `Deposit` | Fund an escrow with USDT |
| `SettleWithCpi` | Settle an escrow using verified TxLINE fixture data via CPI |
| `SetTxlineToken` | Store the TxLINE API token on-chain for the keeper |

### TxLINE Oracle

| Item | Address |
|------|---------|
| Program ID | `6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J` |
| TxL Token Mint | `4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG` |
| USDT Mint (Devnet) | `ELWTKspHKCnCfCiCiqYw1EDH77k8VCP74dK9qytG2Ujh` |

## Getting Started

### Prerequisites

- **Node.js** 18+ and **Bun** (`curl -fsSL https://bun.sh/install | bash`)
- A **Solana wallet** (Phantom, Backpack, or Solflare) on Devnet
- Some **Devnet SOL** (use [Solana Faucet](https://faucet.solana.com)) and **Devnet USDT** (get it in-app via `/faucet`)

### Install

```bash
git clone https://github.com/neocarvajal/worldcup-predmarket
cd worldcup-predmarket
bun install
```

### Run (development)

```bash
bun dev
```

Open [http://localhost:3000](http://localhost:3000).

### Build

```bash
bun run build
```

### Deploy

Deploy is automatic on push to `main` — Vercel Git Integration.

```bash
git push
```

## Project Structure

```
├── programs/settlement/     # Anchor program (Rust): escrows, settlement, TxLINE CPI
│   └── src/instructions/    # InitEscrow, Deposit, SettleWithCpi, SetTxlineToken
├── src/
│   ├── app/
│   │   ├── page.tsx         # Landing / markets list
│   │   ├── market/[id]/     # Single match detail + odds + betting
│   │   ├── portfolio/       # User's bets, win/loss status
│   │   ├── live/            # Real-time scores from TxLINE SSE
│   │   ├── faucet/          # USDT faucet (Devnet)
│   │   ├── docs/            # User-facing documentation
│   │   └── api/keeper/      # Keeper endpoints (settle, trigger-settle, fixture-status)
│   ├── lib/
│   │   ├── keeper.ts        # Core keeper logic: fetch escrows, settle
│   │   ├── keeper-auth.ts   # Auto-manage TxLINE JWT + API token
│   │   ├── settlement.ts    # Anchor client: initEscrow, deposit, settleWithCpi
│   │   └── txlineSkill.ts   # TxLINE API client (fixtures, odds, scores, auth)
│   ├── components/          # React components (BetSlipDrawer, MarketCard, etc.)
│   └── context/             # BetSlipContext, Providers
├── messages/                # i18n (en, es)
├── keys/                    # Keeper keypair
├── supabase/                # Supabase migrations
├── scripts/                 # Anchor client generation, etc.
├── SKILL.md                 # TxLINE oracle skill (for AI coding agents)
└── AGENTS.md                # Project rules for AI coding agents
```

## Key Flows

### Betting

```
1. Browse /markets → pick a match
2. Select outcome (1 / X / 2)
3. Enter USDT amount
4. Wallet signs InitEscrow + Deposit
5. Escrow created on-chain, funds locked
```

### Auto-settlement

```
1. Match finishes (StatusId ∈ {5, 10, 13})
2. Keeper (pg_cron every 5 min) picks it up
3. Fetches final scores from TxLINE
4. Gets Merkle proofs from TxLINE
5. Calls settleWithCpi on Settlement program
6. CPI validates fixture data via TxLINE program
7. If depositor won: escrow sends stake + profit to depositor
8. If depositor lost: escrow sends stake to recipient (liquidity provider)
```

### Live trigger

The live scores page polls every 15s. When a fixture transitions to finished, it immediately calls `POST /api/keeper/trigger-settle?fixtureId=X`, settling all active escrows for that fixture within seconds.

### Keeper auth

JWT and API token are fully auto-managed:
- **JWT**: Generated on each request via `POST /auth/guest/start`
- **API token**: `keeper-auth.ts` checks env var → Supabase DB → on-chain subscribe + activate (tier 1 is free)
- No manual token renewal needed

## Env Vars

See `.env.example` for the full list. Key ones to set on Vercel:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SOLANA_RPC` | Solana RPC endpoint |
| `NEXT_PUBLIC_TXLINE_API_URL` | TxLINE API base URL |
| `TXLINE_API_TOKEN` | TxLINE API token (auto-generated if empty) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `PAYER_SECRET_KEY` | Keeper keypair (JSON array of numbers) |
| `KEEPER_SECRET` | Bearer token for manual keeper triggers |

## Links

- **Live app**: https://worldcup-hackathon.vercel.app
- **TxLINE docs**: https://txline-docs.txodds.com
- **Solana Devnet faucet**: https://faucet.solana.com
