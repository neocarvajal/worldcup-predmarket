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

### Betting
- **3 market types**: 1×2 (home/draw/away), Over/Under (multiple lines), Both Teams To Score (BTTS)
- **USDT escrows**: funds locked in Anchor program escrows via `InitEscrow` + `Deposit`
- **Live odds**: real-time odds updates every 15s with directional arrows (up/down + percentage)
- **Odds suspension**: auto-suspended during stoppage time, extra time, recent goals, and halftime
- **Bet slip**: quick amount selectors [10, 20, 50, 100], total odds, potential payout display

### Settlement
- **Auto-settlement**: keeper bot settles winning bets every 5 minutes (pg_cron → Edge Function → Vercel)
- **Live trigger**: when a match finishes on the Live page, settlement fires within seconds
- **Portfolio auto-settle**: background polling every 30s detects finished fixtures and settles immediately
- **On-chain verification**: TxLINE oracle provides Merkle proofs for match results via CPI
- **Claim / Cancel**: users can claim winnings or cancel active escrows

### Live scores
- **Real-time scores**: polls every 15s for World Cup fixtures
- **Event timeline**: goals, penalties, own goals, yellow/red cards, VAR decisions, annulled goals
- **Player names**: full match history (Ts=0 endpoint) with cached player name resolution
- **Auto-trigger**: finished matches (StatusId 5/10/13) trigger settlement automatically

### Notifications
- **In-app notifications**: bell icon with badge, dropdown with mark-all-read/clear-all, max 50 stored
- **Push notifications (optional)**: Web Push API via Service Worker, Supabase subscription storage
- **Match Watcher**: background context tracks user's active escrows, sends alerts on match start/finish
- **Settlement alerts**: push notification sent with win (🎆) or loss (😔) result

### Wallet & Profile
- **Multi-wallet**: Phantom, Backpack, Solflare, Solana Mobile Wallet — all via wallet-standard
- **On-chain profile**: image URI and X (Twitter) handle stored on Settlement program
- **Profile image upload**: local image stored as data URL in localStorage
- **Stats dashboard**: SOL balance, total predictions, won count, earnings
- **TxLINE activation**: one-click free Tier 1 subscription, status indicator
- **Push toggle**: enable/disable browser push notifications

### Faucet
- **USDT faucet**: claim 100 USDT on Devnet every 8 hours
- **Auto ATA creation**: creates Associated Token Account if missing
- **Cooldown tracking**: countdown timer with 8h format, error handling for `RateLimitExceeded`

### Portfolio
- **Active/History tabs**: pending vs settled escrows
- **Per-bet detail**: fixture name, selection, amount, odds, status badge, potential payout
- **Share on X (Twitter)**: for won bets, opens Twitter intent with pre-filled summary
- **Manual settlement action**: one-click settle from portfolio when match is finished

### Documentation
- **i18n docs page**: `/docs` with 14 sections, bilingual (EN/ES)
- **Covers**: what is, wallet, TxLINE activation, betting flow, betting modes, payout, settlement, live tracking, notifications, portfolio, profile, faucet, tech stack, security

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Frontend (Next.js)                 │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │ Markets  │  │ Portfolio│  │ Live Scores (SSE) │  │
│  │ 1X2/OU/  │  │ Active/  │  │ Event timeline,   │  │
│  │ BTTS     │  │ History  │  │ auto-settle       │  │
│  └────┬─────┘  └────┬─────┘  └────────┬──────────┘  │
│       │              │                 │              │
│  ┌────┴──────────────┴─────────────────┴──────────┐  │
│  │  Settlement SDK (Anchor CPI calls)              │  │
│  │  src/lib/settlement.ts                          │  │
│  └──────────────────────┬──────────────────────────┘  │
│                         │                              │
│  ┌──────────────────────┴──────────────────────────┐  │
│  │  TxLINE SDK (fixtures, odds, scores, auth)      │  │
│  │  src/lib/txlineSkill.ts                         │  │
│  └──────────────────────┬──────────────────────────┘  │
└─────────────────────────┼────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
┌─────────────────┐ ┌──────────┐ ┌──────────────┐
│  Settlement     │ │  TxLINE  │ │  Supabase    │
│  Program (Anchor)│ │  Oracle  │ │  (keeper DB, │
│  E4Y1BwM5BD...  │ │  6pW64gN │ │  push subs)  │
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
| Stablecoin | USDT (SPL Token, Devnet mint: `ELWTKsp...`) |
| Database | Supabase (keeper state, token persistence, push subscriptions) |
| Wallet | @solana/wallet-adapter (Phantom, Backpack, Solflare, Mobile) |
| Auth | Self-custodial — just connect your wallet |
| Keeper | Node.js (Vercel Cron + Supabase pg_cron + Edge Functions) |
| i18n | next-intl (English, Spanish) |
| Push | Web Push API + VAPID + Service Worker |

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
| `InitProfile` | Create an on-chain user profile (image_uri, x_handle) |
| `UpdateProfile` | Update an existing user profile |
| `Claim` | Claim winnings from a settled escrow |
| `Cancel` | Cancel an active escrow |

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
│   └── src/instructions/    # InitEscrow, Deposit, SettleWithCpi, SetTxlineToken, InitProfile, UpdateProfile
├── src/
│   ├── app/
│   │   ├── page.tsx                     # Landing page
│   │   ├── markets/page.tsx             # Match listings with odds
│   │   ├── market/[fixtureId]/page.tsx  # Match detail + 1X2/OU/BTTS tabs + bet slip
│   │   ├── live/page.tsx                # Real-time scores + event timeline
│   │   ├── portfolio/page.tsx           # User's bets, active/history, auto-settle
│   │   ├── profile/page.tsx             # Wallet profile, avatar, stats, push toggle
│   │   ├── faucet/page.tsx              # USDT faucet (Devnet)
│   │   ├── liquidity/page.tsx           # Mock liquidity pool UI
│   │   ├── docs/page.tsx                # User-facing documentation (14 sections, i18n)
│   │   └── api/
│   │       ├── keeper/                   # Settlement endpoints (settle, trigger-settle, fixture-status)
│   │       ├── txline/[...path]/         # TxLINE API proxy
│   │       ├── push/                     # Push notification subscribe/send
│   │       └── user/token/               # User API token CRUD
│   ├── lib/
│   │   ├── keeper.ts                    # Core keeper: fetch escrows, settle, CPI calls
│   │   ├── keeper-auth.ts               # Auto-manage TxLINE JWT + API token
│   │   ├── settlement.ts                # Anchor client: initEscrow, deposit, settleWithCpi, profile
│   │   ├── txlineSkill.ts               # TxLINE API client (fixtures, odds, scores, auth)
│   │   ├── persistence.ts               # localStorage helpers (profile images, notifications)
│   │   └── txlineProgram.ts             # Faucet request, USDT balance, cooldown check
│   ├── components/                      # UI components
│   │   ├── MarketCard.tsx               # Match card with live countdown and odds
│   │   ├── MarketDetail.tsx             # 1X2/OU/BTTS market tabs + odds display
│   │   ├── MarketList.tsx               # Match list grouped by date
│   │   ├── BetSlipDrawer.tsx            # Bet slip with amount, odds, payout
│   │   ├── PositionCard.tsx             # Escrow display (active/settled)
│   │   ├── LiveFeedItem.tsx             # Live match feed item
│   │   ├── SubscriptionBanner.tsx       # TxLINE activation flow
│   │   └── PushToggle.tsx               # Push notification toggle
│   ├── context/
│   │   ├── Providers.tsx                 # Wallet adapters, TxLINE, notifications
│   │   ├── TxLineContext.tsx            # TxLINE client + fixture subscriptions
│   │   ├── BetSlipContext.tsx           # Bet slip state management
│   │   ├── LiveOddsContext.tsx          # Live odds polling + suspension
│   │   ├── MatchWatcherContext.tsx      # Background escrow tracking + notifications
│   │   └── NotificationContext.tsx      # In-app notification storage
│   └── hooks/
│       ├── useAutoSubscribe.ts          # Auto TxLINE subscription on wallet connect
│       └── usePushNotifications.ts      # Push notification registration
├── messages/                            # i18n translations (en.json, es.json)
├── keys/                                # Keeper keypair
├── supabase/                            # Supabase migrations (pg_cron, pg_net, push_subscriptions)
├── scripts/                             # Anchor client generation, etc.
├── public/
│   ├── sw.js                            # Push notification Service Worker
│   └── images/                          # Background images for each page
├── SKILL.md                             # TxLINE oracle skill (for AI coding agents)
└── AGENTS.md                            # Project rules for AI coding agents
```

## Key Flows

### Betting

```
1. Browse /markets → pick a match
2. Select market type: 1×2, Over/Under, or BTTS
3. Select outcome (1 / X / 2 / Over / Under / BTTS Yes / BTTS No)
4. Enter USDT amount (quick selectors: 10, 20, 50, 100)
5. Wallet signs InitEscrow + Deposit in a single transaction
6. Escrow created on-chain, funds locked
7. Escrow state = Active, waiting for match to finish
```

### Auto-settlement

```
1. Match finishes (StatusId ∈ {5, 10, 13} or action === 'game_finalised')
2. Keeper (pg_cron every 5 min) picks it up
3. Fetches final scores from TxLINE /api/scores/snapshot/{fixtureId}
4. Gets Merkle proofs from TxLINE /api/fixtures/validation?fixtureId=X
5. Calls settleWithCpi on Settlement program
6. CPI validates fixture data via TxLINE program
7. If depositor won: escrow sends stake + profit to depositor (from keeper ATA)
8. If depositor lost: escrow sends stake to recipient (liquidity provider)
9. Re-reads escrow `depositorWon` and sends push notification
```

### Live trigger

The live scores page polls every 15s. When a fixture transitions to finished (StatusId 5/10/13), it immediately calls `POST /api/keeper/trigger-settle?fixtureId=X`, settling all active escrows for that fixture within seconds. Rate-limited to 1 request per minute per fixture.

### Portfolio auto-settle

The Portfolio page polls `/api/keeper/fixture-status?fixtureId=X` every 30s for each active escrow. When finished is detected, it calls `POST /api/keeper/settle?escrow=X&force=1` and displays a notification with the result.

### Keeper auth

JWT and API token are fully auto-managed:
- **JWT**: Generated on each request via `POST /auth/guest/start`
- **API token**: `keeper-auth.ts` checks env var → Supabase DB → on-chain subscribe + activate (tier 1 is free)
- Auto-subscribes on-chain via `keeper-auth.ts` when `TXLINE_API_TOKEN` is empty
- No manual token renewal needed

### Match Watcher

```
1. On app load, MatchWatcherContext fetches all active escrows for connected wallet
2. Resolves fixture IDs from escrow data
3. Polls fixture status every 15s
4. When match starts (StatusId >= 2): in-app + push notification
5. When match finishes (StatusId 5/10/13): in-app + push notification + auto-settlement
6. Tracks seen states in localStorage to avoid duplicate notifications
```

### Notification flows

```
In-app:
  Bell icon → dropdown with unread badge
  Max 50 stored in localStorage, sorted by timestamp
  Types: settled, won, lost, info
  Actions: mark all read, clear all, click to navigate

Push:
  Service Worker (sw.js) receives push events
  Subscription stored in Supabase push_subscriptions table
  Sent via POST /api/push/send (web-push library)
  Triggered by: match finish, settlement result, match start
```

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
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | VAPID public key for Web Push |
| `VAPID_PRIVATE_KEY` | VAPID private key for Web Push |
| `VAPID_SUBJECT` | VAPID subject (mailto:) |

## Links

- **Live app**: https://worldcup-hackathon.vercel.app
- **TxLINE docs**: https://txline-docs.txodds.com
- **Solana Devnet faucet**: https://faucet.solana.com
