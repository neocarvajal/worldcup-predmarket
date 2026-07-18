# WC PredMarket — Technical Documentation

> Deep-dive into the architecture, smart contracts, settlement engine, and infrastructure.

---

## Table of Contents

1. [Smart Contract Architecture](#1-smart-contract-architecture)
2. [CPI Flow — TxLINE Integration](#2-cpi-flow--txline-integration)
3. [Settlement Engine](#3-settlement-engine)
4. [Keeper Auth Pipeline](#4-keeper-auth-pipeline)
5. [Database Schema](#5-database-schema)
6. [API Routes Reference](#6-api-routes-reference)
7. [Notification System](#7-notification-system)
8. [TxLINE Integration](#8-txline-integration)
9. [Security Model](#9-security-model)
10. [Deployment Architecture](#10-deployment-architecture)
11. [Program Addresses](#11-program-addresses)
12. [Environment Variables](#12-environment-variables)

---

## 1. Smart Contract Architecture

### Program Layout

The settlement program is written in **Anchor Framework** (Rust) and deployed on Solana Devnet.

```
Program ID: E4Y1BwM5BDXzTSkoACbwTT6Zg86wHETDWMNPLh4Hriu6
Source:     programs/settlement/src/
IDL:        src/idl/settlement.json
```

**Module structure:**

| File | Purpose |
|------|---------|
| `lib.rs` | Program entry point, declares 9 instructions |
| `state.rs` | `Escrow` and `UserProfile` account structs |
| `errors.rs` | 11 error codes |
| `cpi_txline.rs` | CPI helper to call TxLINE's `validateFixture` |
| `instructions/init_escrow.rs` | Create escrow PDA |
| `instructions/deposit.rs` | Fund escrow with USDT |
| `instructions/settle.rs` | Basic settle (alternative) |
| `instructions/settle_with_cpi.rs` | CPI-based settlement (primary path) |
| `instructions/claim.rs` | Winner claims from vault |
| `instructions/cancel.rs` | Depositor cancels active escrow |
| `instructions/init_profile.rs` | Create on-chain user profile |
| `instructions/update_profile.rs` | Update user profile |
| `instructions/set_txline_token.rs` | Store TxLINE API token on-chain |

### Account Structures

#### Escrow (17 fields)

```rust
pub struct Escrow {
    pub depositor: Pubkey,           // 32 bytes — who created the bet
    pub recipient: Pubkey,           // 32 bytes — liquidity counterparty
    pub nonce: u64,                  // 8 bytes — unique per (depositor, recipient)
    pub fixture_id: u64,             // 8 bytes — TxLINE fixture ID
    pub fixture_name: String,        // max 64 bytes — e.g. "Argentina vs Brazil"
    pub selection: u8,               // 1 byte — 0=Home, 1=Draw, 2=Away, 3=Over, 4=Under, 5=BTTS Yes, 6=BTTS No
    pub label: String,               // max 32 bytes — e.g. "Over 2.5"
    pub odds: u64,                   // 8 bytes — odds * 1000 (e.g. 2500 = 2.5x)
    pub mint: Pubkey,                // 32 bytes — USDT mint address
    pub vault: Pubkey,               // 32 bytes — token vault PDA
    pub amount: u64,                 // 8 bytes — stake amount (USDT, 6 decimals)
    pub expiry: i64,                 // 8 bytes — Unix timestamp
    pub depositor_won: bool,         // 1 byte — set by settle instruction
    pub state: EscrowState,          // 1 byte — 0=Active, 1=Settled, 2=Cancelled
    pub bump: u8,                    // 1 byte — PDA bump
    pub vault_bump: u8,              // 1 byte — vault PDA bump
}
```

**Total size:** 219 bytes minimum.

#### UserProfile (5 fields)

```rust
pub struct UserProfile {
    pub authority: Pubkey,                  // Wallet that owns this profile
    pub txline_api_token: String,           // max 256 bytes
    pub image_uri: String,                  // max 256 bytes
    pub x_handle: String,                   // max 50 bytes
    pub notifications_enabled: bool,
}
```

### Instruction Reference

| Instruction | Accounts | Description |
|-------------|----------|-------------|
| `InitEscrow` | depositor, escrow, system_program | Creates escrow PDA with seeds `["escrow", depositor, recipient, nonce_le]` |
| `Deposit` | depositor, escrow, vault, mint, token_program | Transfers USDT into vault PDA with seeds `["vault", escrow]` |
| `SettleWithCpi` | caller, escrow, vault, depositor_ata, recipient_ata, caller_ata, mint, token_program, txline_program, ten_daily_fixtures_roots | CPI-validates result + transfers funds |
| `Claim` | claimant, escrow, vault, token_program | Winner withdraws from vault |
| `Cancel` | depositor, escrow, vault, token_program | Depositor retrieves funds before settlement |
| `InitProfile` | authority, profile, system_program | Creates profile PDA with seeds `["profile", authority]` |
| `UpdateProfile` | authority, profile | Updates existing profile |
| `SetTxlineToken` | authority, profile | Stores encrypted TxLINE API token |

### PDA Seeds

```
Escrow PDA:  ["escrow", depositor_pubkey, recipient_pubkey, nonce_le_bytes]
Vault PDA:   ["vault", escrow_pubkey]
Profile PDA: ["profile", authority_pubkey]
```

---

## 2. CPI Flow — TxLINE Integration

### Overview

Settlement does **not** rely on an external oracle API. Instead, it calls the TxLINE Solana program via CPI to verify match results against on-chain Merkle roots.

### CPI Call Chain

```
User/keeper → settle_with_cpi (Settlement program)
                ↓
            validate_fixture_cpi (via CPI → TxLINE program @ 6pW64gN...)
                ↓
            TxLINE program verifies fixture + score data against:
              - ten_daily_fixtures_roots PDA (Merkle root stored on-chain by TxLINE)
              - sub_tree_proof (proves fixture belongs to batch)
              - main_tree_proof (proves batch root is in the daily root)
```

### Data Structures Passed to CPI

```rust
// Fixture — the score + match metadata
struct Fixture {
    ts: i64,
    start_time: i64,
    competition: String,
    competition_id: i32,
    fixture_group_id: i32,
    participant1_id: i32,
    participant1: String,        // e.g. "Argentina"
    participant2_id: i32,
    participant2: String,        // e.g. "Brazil"
    fixture_id: i64,
    participant1_is_home: bool,
}

// FixtureBatchSummary — batch-level Merkle root metadata
struct FixtureBatchSummary {
    fixture_id: i64,
    competition_id: i32,
    competition: String,
    update_stats: FixtureUpdateStats { update_count, min_timestamp, max_timestamp },
    update_sub_tree_root: [u8; 32],
}

// Merkle proof node
struct ProofNode {
    hash: [u8; 32],
    is_right_sibling: bool,
}
```

### CPI Discriminator

The TxLINE `validateFixture` instruction is identified by the discriminator `[231, 129, 218, 86, 223, 114, 21, 126]`.

### What Gets Verified

1. The **fixture exists** in TxLINE's on-chain data tree
2. The **scores** (`score1`, `score2`) match what TxLINE recorded
3. The **match status** (finished/completed) is valid
4. The data is provably from TxLINE's oracle (Merkle proof against TxLINE's on-chain root)

If the CPI fails, the entire settlement transaction reverts — no funds move without verified data.

---

## 3. Settlement Engine

### Location: `src/lib/keeper.ts`

The keeper bot is a **Node.js module** that runs in Vercel serverless functions (via API route) and is triggered by cron or live page events.

### Active Escrow Interface

```typescript
interface ActiveEscrow {
  pubkey: PublicKey;
  depositor: PublicKey;
  recipient: PublicKey;
  nonce: bigint;
  fixtureId: number;
  fixtureName: string;
  selection: number;    // 0=Home, 1=Draw, 2=Away, 3=Over, 4=Under, 5=BTTS Yes, 6=BTTS No
  label: string;
  mint: PublicKey;
  amount: bigint;
  odds: number;         // odds * 1000
}
```

### Escrow Decoding

The keeper uses **manual Borsh deserialization** (not Anchor's BorshCoder) because `getProgramAccounts` returns raw buffers. The decoder reads:

1. **8-byte discriminator** — must match `[31, 213, 123, 187, 186, 22, 218, 155]`
2. **32-byte depositor** pubkey
3. **32-byte recipient** pubkey
4. **8-byte nonce** (u64 LE)
5. **8-byte fixture_id** (u64 LE)
6. **Borsh string** fixture_name (4-byte LE length prefix + UTF-8)
7. **1-byte selection** (u8)
8. **Borsh string** label
9. **8-byte odds** (u64 LE)
10. **32-byte mint** pubkey
11. **32-byte vault** (skipped during decode)
12. **8-byte amount** (u64 LE)
13. **8-byte expiry** (i64 LE, skipped)
14. **1-byte depositor_won** (bool, skipped)
15. **1-byte state** (only Active = 0 passes the filter)
16. **1-byte bump** (skipped)
17. **1-byte vault_bump** (skipped)

**Filter:** `state === 0` (Active) — returns `null` otherwise.

### settleActiveEscrows() Flow

```
1. fetchActiveEscrows(connection)
   → connection.getProgramAccounts(SETTLEMENT_PROGRAM_ID)
   → memcmp filter: discriminator at offset 0
   → decodeEscrow() on each account

2. Optional: filter by fixtureId (fixtureFilter param)

3. Sort by amount ascending (maximize settlements with limited keeper balance)

4. For each escrow:
   a. GET /api/scores/snapshot/{fixtureId}
   b. Check StatusId in [5, 10, 13, 100] OR action === 'game_finalised'
   c. Heuristic: if StatusId >= 4 and earliest message > 4h old → force settle
   d. GET /api/fixtures/validation?fixtureId=X
      → returns: snapshot, summary, subTreeProof[], mainTreeProof[]
   e. Build SettleWithCpi instruction with all params
   f. Derive ten_daily_fixtures_roots PDA from fixture_epoch_day
   g. Create depositor + recipient ATAs if missing
   h. Check caller (keeper) has enough USDT for profit payout
   i. Send VersionedTransaction (400K CU budget, max 5 retries)
   j. Re-read escrow from chain → read depositorWon field
   k. Dispatch push notification based on result
```

### Settlement Result

```typescript
interface SettlementResult {
  escrowPubkey: string;
  fixtureId: number;
  fixtureName: string;
  selection: number;
  status: 'settled' | 'skipped' | 'error';
  depositorWon?: boolean;
  txSig?: string;
  error?: string;
}
```

### settleSingleEscrow()

Same logic as `settleActiveEscrows()` but operates on a single escrow identified by its `PublicKey`. Used by the portfolio auto-settle path.

### Score Parsing (parseSnapshot)

The `parseSnapshot` function extracts final scores from the TxLINE snapshot response. It tracks **per-participant** `bestSeq1`/`bestSeq2` to avoid losing one team's score when both teams' goals arrive in a single message.

---

## 4. Keeper Auth Pipeline

### Location: `src/lib/keeper-auth.ts`

The keeper **auto-manages** its TxLINE JWT and API token — no manual setup required beyond funding the keeper wallet.

### ensureApiToken() Flow

```
1. POST /auth/guest/start → get guest JWT (30-day expiry)

2. Check process.env.TXLINE_API_TOKEN
   → If set, return immediately (production env var)

3. Load from Supabase user_api_tokens table
   → SELECT * FROM user_api_tokens WHERE wallet = keeper_pubkey

4. If no token found (fallback bootstrap — only runs if steps 2 & 3 fail):
   a. Sign & send on-chain subscribe instruction to TxLINE program (free tier)
   b. Sign message: nacl.sign.detached(txSig + "::" + jwt, keeper_secret)
   c. POST /api/token/activate with { txSig, walletSignature, leagues: [] }
   d. Save token to Supabase user_api_tokens table

5. Return { jwt, apiToken }
```

### Token Persistence Priority

In practice, steps 1 (env var) or 2 (Supabase) always cover the keeper — step 3 (on-chain subscribe) has never needed to run in production.

```
1. Environment variable (TXLINE_API_TOKEN) ← production path
2. Supabase user_api_tokens table (keyed by keeper wallet pubkey)
3. On-chain TxLINE subscription (last resort — would require TXL tokens, never used in practice)
```

---

## 5. Database Schema

### Table: `user_api_tokens`

```sql
CREATE TABLE public.user_api_tokens (
  wallet      TEXT PRIMARY KEY,       -- Solana wallet pubkey
  jwt         TEXT NOT NULL,          -- TxLINE guest JWT
  api_token   TEXT NOT NULL,          -- TxLINE API token
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: open to anon (insert, update, select)
```

Stores TxLINE credentials per wallet so the keeper (and users) don't need to re-activate on every cold start.

### Table: `push_subscriptions`

```sql
CREATE TABLE public.push_subscriptions (
  id          BIGSERIAL PRIMARY KEY,
  wallet      TEXT,                    -- Solana wallet pubkey (nullable for guest)
  endpoint    TEXT NOT NULL UNIQUE,    -- Web Push endpoint URL
  p256dh      TEXT NOT NULL,           -- Push encryption key
  auth        TEXT NOT NULL,           -- Push auth secret
  locale      TEXT DEFAULT 'es',       -- EN/ES for notification language
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes: wallet, locale
-- RLS: open to anon (insert, select, delete)
```

The `locale` column was added in migration `20260715000001` and must still be applied manually via Supabase dashboard SQL editor.

---

## 6. API Routes Reference

All API routes are under `src/app/api/`.

### Keeper Routes

| Route | Method | Auth | Params | Description |
|-------|--------|------|--------|-------------|
| `/api/keeper/settle` | POST | `KEEPER_SECRET` bearer or `x-vercel-cron: 1` | `?fixtureId=X`, `?escrow=X`, `?force=1` | Settle all or specific escrows. Main settlement endpoint. |
| `/api/keeper/settle` | GET | `x-vercel-cron: 1` | — | GET variant for Vercel Cron (cron can't POST) |
| `/api/keeper/trigger-settle` | POST | In-memory rate limiter (1/min per fixture) | `?fixtureId=X` | Called by live page when match finishes. Lightweight. |
| `/api/keeper/fixture-status` | GET | None | `?fixtureId=X` | Returns `{finished, statusId, score1, score2, startTime}`. Used by Portfolio page. |

### TxLINE Proxy

| Route | Method | Description |
|-------|--------|-------------|
| `/api/txline/auth/[...path]` | GET/POST | Proxies to `TXLINE_AUTH_URL` (JWT endpoints) |
| `/api/txline/api/[...path]` | GET/POST | Proxies to `TXLINE_API_URL`, injects `X-Api-Token` header |

The proxy prevents browser-side exposure of API tokens.

### Push Notification Routes

| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| `/api/push/subscribe` | POST | None | Stores browser push subscription in Supabase. Body: `{endpoint, keys: {p256dh, auth}, wallet}` |
| `/api/push/send` | POST | None | Sends push notification to stored subscriptions. Used internally by settlement. |
| `/api/push/check` | GET | None | Returns `{configured: bool}` — checks VAPID setup AND validates subscription exists in Supabase. |

### User Token Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/user/token` | GET | Read user's stored TxLINE token by `?wallet=X` |
| `/api/user/token` | POST | Save user's TxLINE token `{wallet, jwt, apiToken}` |
| `/api/user/token` | DELETE | Delete user's stored token by `?wallet=X` |

### Debug Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/debug/events` | GET | Returns recent debug event logs (if enabled in keeper) |

---

## 7. Notification System

### Architecture

Two independent notification channels, both triggered by the same events:

```
Match finished / Settled
       │
       ├──► In-app notification (localStorage)
       │      └── Bell icon → dropdown with badge
       │
       └──► Push notification (Web Push API)
              └── Service Worker → system notification
```

### In-App Notifications

- **Storage:** localStorage, keyed by wallet pubkey, max 50 entries
- **Schema:** `{ id, type, title, body, fixtureId, read, timestamp, data? }`
- **Types:** `settled`, `won`, `lost`, `info`
- **Context:** `NotificationContext` — provides `addNotification()`, `markAsRead()`, `clearAll()`, `unreadCount`
- **Display:** Bell icon in NavBar with unread badge count, dropdown list with message text

### Push Notifications

- **Library:** `web-push` (Node.js) with VAPID keys
- **Service Worker:** `public/sw.js` — handles `push` event, shows system notification, handles `notificationclick` to focus/open app
- **Subscription:** Stored in Supabase `push_subscriptions` table
- **Sending:** `src/lib/webPush.ts` — `sendPush()` and `sendPushToAll()` helpers
- **TTL:** 86400 seconds (24 hours)
- **Expired sub cleanup:** On 410/404 response, subscription is flagged for deletion

### Locale-Aware Messages

**Location:** `src/lib/locale.ts`

```typescript
type Locale = 'en' | 'es';

const dict = {
  match_finished: { en: "🏁 Match Finished", es: "🏁 Partido Finalizado" },
  match_started:  { en: "⚽ Match Started",  es: "⚽ Partido Iniciado" },
  you_won:        { en: "🏆 You Won!",      es: "🏆 ¡Ganaste!" },
  you_lost:       { en: "😔 You Lost",       es: "😔 Perdiste" },
  payment_sent:   { en: "Payment sent to your wallet", es: "Pago enviado a tu wallet" },
  better_luck:    { en: "Better luck next time",       es: "Mejor suerte la próxima vez" },
};
```

- **Client-side:** `detectLocale()` reads `navigator.language`
- **Server-side:** Reads `locale` from `push_subscriptions` row (falls back to `'es'`)
- Settlement notifications group subscriptions by locale before sending

### Stale Subscription Detection

The `check()` effect in `usePushNotifications` verifies that a subscription exists in both the browser AND Supabase:
1. Browser has `PushManager` subscription → good
2. Calls `GET /api/push/check` → validates Supabase record exists
3. If Supabase record missing → unsubscribes browser subscription

---

## 8. TxLINE Integration

### Overview

TxLINE provides sports data (fixtures, odds, scores) via:
- **Off-chain:** REST API + SSE stream
- **On-chain:** Solana Anchor program with Merkle-rooted data verification

### JWT Lifecycle

```
1. POST /auth/guest/start → anonymous JWT (30-day expiry)
2. JWT is cached in-memory (TxLineClient.jwt) and in localStorage
3. On 401 response from any API call → auto-refresh JWT + retry
4. Server-side keeper uses guest JWT (generated fresh each invocation)
```

### API Token Activation

```
1. User connects wallet
2. Guest JWT obtained
3. Subscribe instruction sent to TxLINE program (free tier)
4. User signs message: txSig + "::" + jwt with their wallet
5. POST /api/token/activate with { txSig, walletSignature, leagues }
6. API token returned → cached in localStorage + Supabase
```

Only needed once per wallet. The token persists in localStorage across sessions.

### Client Architecture

**Class:** `TxLineClient` (singleton in `src/lib/txlineSkill.ts`)

```
Constructor → restoreFromEnv() reads NEXT_PUBLIC_TXLINE_API_TOKEN
  ↓
restoreForWallet(wallet) → localStorage → Supabase → env fallback
  ↓
request(path) → adds Authorization + X-Api-Token headers
  ↓
requestWithRetry(path) → on 401 → refresh JWT → retry once
```

**Proxying:** In browser, all requests go through `/api/txline/[...path]` to prevent credential exposure. Server-side calls go directly to `TXLINE_API_URL`.

### Endpoints Used

| Endpoint | Used By | Purpose |
|----------|---------|---------|
| `GET /api/fixtures/snapshot` | Markets, Live | All fixtures with StatusId |
| `GET /api/odds/snapshot/{fixtureId}` | Market detail, LiveOddsContext | Current odds |
| `GET /api/scores/snapshot/{fixtureId}` | Keeper, Live page, fixture-status | Final/current scores |
| `GET /api/scores/historical/{fixtureId}` | Live page | Full score history |
| `GET /api/fixtures/validation?fixtureId=X` | Keeper | Merkle proofs for settlement |
| `GET /api/scores/stream` | Live page | SSE real-time scores |
| `POST /auth/guest/start` | Keeper, client | Guest JWT |
| `POST /api/token/activate` | Keeper, client | Activate API token |

### SSE Streaming

The live page connects to TxLINE's Server-Sent Events endpoint (`/api/scores/stream`) for real-time score updates. The stream is consumed via `ReadableStream<Uint8Array>` and parsed for fixture ID extraction, which is then used to selectively refresh scores for visible matches.

---

## 9. Security Model

### Trust Assumptions

| Component | Trust Level | Rationale |
|-----------|-------------|-----------|
| TxLINE Oracle Program | **Minimized** | On-chain Merkle roots — data provable, not oracle-dependent |
| Settlement Program | **Minimized** | Open-source Anchor program, deterministic settlement logic |
| Keeper Bot | **Low** | Keeper can only trigger settlement, not alter results. Profit paid from keeper's own ATA — if keeper doesn't settle, user can trigger from Portfolio |
| Supabase | **Low** | Only stores push subscriptions and API tokens (not funds). Tokens can be rotated |
| Vercel | **Low** | Serverless functions, no persistent state. API keys are env vars |

### CPI Safety

The `settle_with_cpi` instruction validates:
- `ten_daily_fixtures_roots` PDA is derived correctly from `fixture_epoch_day`
- The CPI call goes to the known TxLINE program ID (`6pW64gN...`)
- Merkle proofs are verified by TxLINE's program, not by the settlement program

If the TxLINE CPI fails (invalid proof, wrong data), the entire transaction reverts. No funds move without verified results.

### Keeper Economics

- **Profit model:** The keeper pays winning profits from its own ATA, not from the escrow vault
- **Profit formula:** `profit = (amount * odds / 1000) - amount`
- **Why this works:** The keeper earns from the spread (odds edge). If odds are slightly in the house's favor, the keeper is profitable over time
- **Safety:** The keeper checks its USDT balance before sending. If insufficient, the escrow is skipped and retried later

### Rate Limiting

| Endpoint | Limit | Implementation |
|----------|-------|----------------|
| `/api/keeper/trigger-settle` | 1 req/min per fixtureId | In-memory `Map<fixtureId, timestamp>` |
| TxLINE API calls | Unbounded (via proxy) | Relies on TxLINE server-side rate limits |
| Settlement execution | Per-tx Solana fees | No artificial limit, bounded by keeper balance |

### Escrow Vault Security

- Vault PDA seeds: `["vault", escrow_pubkey]` — only the settlement program can sign for this PDA
- Funds can only move via:
  - `deposit` (add funds)
  - `settle` / `settle_with_cpi` (release to winner)
  - `claim` (winner withdrawal)
  - `cancel` (depositor retrieval before settlement)
- No admin keys. No upgrade authority that can drain vaults.

---

## 10. Deployment Architecture

### Infrastructure

```
┌──────────────────────────────────────────────────────────┐
│                       Vercel                              │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐ │
│  │ Next.js App  │  │ API Routes   │  │ Cron (Pro only)  │ │
│  │ (SSR + SPA)  │  │ /api/keeper  │  │ */5 * * * *     │ │
│  │              │  │ /api/txline  │  │ (← fallback)     │ │
│  └─────────────┘  │ /api/push    │  └──────────────────┘ │
│                    │ /api/user    │                        │
│                    └──────────────┘                        │
└──────────────────────────┬───────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
┌──────────────────┐ ┌──────────┐ ┌──────────────┐
│  Solana Devnet   │ │  TxLINE  │ │  Supabase    │
│  Settlement Pgm  │ │  Oracle  │ │  Postgres    │
│  TxLINE Pgm      │ │  REST    │ │  + pg_cron   │
│  USDT Token      │ │  + SSE   │ │  + Edge Fn   │
└──────────────────┘ └──────────┘ └──────────────┘
```

### Settlement Scheduling (3 tiers)

| Tier | Trigger | Latency | Reliability |
|------|---------|---------|-------------|
| **1 — pg_cron** | Supabase pg_cron → Edge Function → Vercel, every 5 min | ~5 min | High (Postgres-backed) |
| **2 — Live trigger** | Live page polls scores (15s), fires on StatusId change | Seconds | Medium (requires user on page) |
| **3 — Portfolio auto-settle** | Portfolio page polls fixture-status (30s), fires on finish | ~30s | Medium (requires user on page) |

### pg_cron Setup

```sql
SELECT cron.schedule(
  'keeper-settlement',             -- job name
  '*/5 * * * *',                   -- every 5 minutes
  $$SELECT net.http_post(
    url:='https://PROJECT.supabase.co/functions/v1/keeper',
    headers:='{"Content-Type":"application/json"}'::jsonb
  )$$
);
```

### Supabase Edge Function

Location: `supabase/functions/keeper/` (13 lines)

Acts as a thin proxy: pg_cron → Edge Function → `POST /api/keeper/settle` on Vercel. Avoids exposing the Vercel URL directly in pg_cron config.

---

## 11. Program Addresses

### Settlement Program (Anchor)

| Item | Devnet |
|------|--------|
| Program ID | `E4Y1BwM5BDXzTSkoACbwTT6Zg86wHETDWMNPLh4Hriu6` |
| IDL | `src/idl/settlement.json` |
| Source | `programs/settlement/` |

### TxLINE Oracle

| Item | Devnet |
|------|--------|
| Program ID | `6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J` |

### Tokens

| Token | Devnet Mint | Decimals |
|-------|-------------|----------|
| USDT | `ELWTKspHKCnCfCiCiqYw1EDH77k8VCP74dK9qytG2Ujh` | 6 |

### Keeper

| Item | Value |
|------|-------|
| Pubkey | `4mE8UiN1eyTPB2Gcw5R8XTHibpSD58fTwHpP2BypTHT2` |
| Keypair file | `~/.config/solana/keeper-kp.json` |
| Devnet balance | ~2 SOL |

---

## 12. Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SOLANA_RPC` | Yes | Solana RPC endpoint (Devnet) |
| `NEXT_PUBLIC_TXLINE_API_URL` | Yes | TxLINE API base URL |
| `NEXT_PUBLIC_TXLINE_AUTH_URL` | Yes | TxLINE auth base URL |
| `TXLINE_API_TOKEN` | No | TxLINE API token (auto-generated if empty) |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `PAYER_SECRET_KEY` | Yes* | Keeper keypair (JSON array of 64 numbers) — required for keeper |
| `KEEPER_SECRET` | No | Bearer token for manual keeper trigger auth |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | No | VAPID public key for Web Push |
| `VAPID_PRIVATE_KEY` | No | VAPID private key for Web Push |
| `VAPID_SUBJECT` | No | VAPID subject (mailto: URI) |

*Required only if the keeper/settlement system is deployed.

### .env.example reference

```
NEXT_PUBLIC_SOLANA_RPC=https://api.devnet.solana.com
NEXT_PUBLIC_TXLINE_API_URL=https://api.dev.txodds.com
NEXT_PUBLIC_TXLINE_AUTH_URL=https://auth.dev.txodds.com
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
PAYER_SECRET_KEY=[1,2,3,...]
KEEPER_SECRET=my-secret
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BB...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:admin@example.com
```
