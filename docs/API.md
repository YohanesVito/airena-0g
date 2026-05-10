# Airena Backend API

REST API surface that fronts the 0G stack and exposes verifiable inference traces.

**Base URL (production):** `https://airena-0g.vercel.app`
**Base URL (local):** `http://localhost:3000` (run `bun dev`)

## Quick reference

| Method | Path | Purpose | 0G touchpoint |
|---|---|---|---|
| `GET`  | `/api/price` | Current BTC price | — |
| `GET`  | `/api/price/history?hours=N` | Recent BTC price points | — |
| `GET`  | `/api/rounds` | Current round + predictions + bots + judge | 0G Chain (read), 0G Storage (cached judge) |
| `POST` | `/api/rounds` | Round lifecycle (`create` / `predict` / `settle`) | 0G Compute, 0G Storage, 0G Chain |
| `POST` | `/api/storage` | Upload / retrieve arbitrary blobs | 0G Storage |
| `GET`  | `/api/storage/trace/{hash}` | Fetch a stored reasoning or judge trace | 0G Storage |

All endpoints return JSON. Errors are `{ error: string }` with the appropriate HTTP status.

---

## `GET /api/price`

Current BTC price from CoinGecko. Edge-cached for 30s.

**Response 200:**
```json
{
  "price": 75715.42,
  "priceInCents": 7571542,
  "timestamp": 1747011273891
}
```

**Errors:** `502` (CoinGecko upstream failed), `500` (internal).

Source: [`app/api/price/route.ts`](../app/api/price/route.ts).

---

## `GET /api/price/history?hours=N`

Recent BTC price samples shaped for `lightweight-charts`. Range clamped to `[1, 24]`, default `4`.

**Response 200:**
```json
{
  "data": [
    { "time": 1747010880, "value": 75712.41 },
    { "time": 1747011180, "value": 75714.88 }
  ]
}
```

`time` is unix-seconds; `value` is USD.

**Notes:** Series is deduplicated by second-precision time and sorted ascending — `lightweight-charts` rejects non-strictly-ascending input.

Source: [`app/api/price/history/route.ts`](../app/api/price/history/route.ts).

---

## `GET /api/rounds`

Snapshot of the current round: round metadata, all predictions, active bot list, and the cached Judge AI output (if any).

**Response 200 (round exists):**
```json
{
  "round": {
    "id": 1,
    "startTime": 1747000000,
    "endTime":   1747003600,
    "settlementPrice": 7571500,
    "totalPool": "0.012",
    "status": 3
  },
  "predictions": [
    {
      "botId": 3,
      "name": "ZeroBound",
      "priceLow":  7561300,
      "priceHigh": 7581300,
      "reasoningHash": "0x6b1d...",
      "score": 50000000,
      "won": true
    }
  ],
  "bots": [/* full BotRegistry.getActiveBots() shape */],
  "judge": {
    "zones": [{ "label": "Sideways", "priceLow": 75500, "priceHigh": 76200 }],
    "reasoning": "BTC trading flat over the last hour...",
    "traceHash": "0x...",
    "tee": { "signature": "0x...", "signer": "0xd45b...", "signedText": "...", "chatID": "...", "verified": true }
  }
}
```

`round.status` enum: `0=OPEN, 1=PREDICTING, 2=BETTING, 3=SETTLED`.

`judge` is `null` when no Judge inference has run for the current round (or the Vercel function cold-started after the round was predicted — the cache is in-memory; full reasoning still lives durably on 0G Storage).

Source: [`app/api/rounds/route.ts`](../app/api/rounds/route.ts) (GET handler).

---

## `POST /api/rounds`

Round lifecycle actions — driven by an admin-controlled server wallet (`PRIVATE_KEY` env). The action determines which on-chain calls + Compute + Storage operations run.

**Body:** `{ "action": "create" | "predict" | "settle" }`

### `action: "create"` (fast, ~10s)
Calls `BettingPool.createRound()` on 0G Chain.

**Response 200:**
```json
{ "success": true, "roundId": 4, "txHash": "0x..." }
```

### `action: "predict"` (slow, 2–5 min)
Full inference cycle:
1. Reads `BotRegistry.getActiveBots()`. Errors `400` if fewer than 2 are active.
2. Picks competing bots (top by win rate + 1 newcomer slot, capped at `MAX_BOTS_PER_ROUND = 5`).
3. Fetches current BTC price + recent history.
4. Runs Judge AI inference on 0G Compute → uploads judge trace to 0G Storage → caches in-memory.
5. For each competing bot: pulls strategy prompt from 0G Storage by `storageHash` → runs bot inference on 0G Compute (Judge zones injected into system prompt) → uploads reasoning trace + TEE attestation to 0G Storage → calls `BettingPool.submitPrediction(roundId, botId, low, high, reasoningHash, creator)`.
6. Calls `BettingPool.openBetting(roundId)` to advance status to BETTING.

**Response 200:**
```json
{
  "success": true,
  "roundId": 4,
  "btcPrice": 75712.41,
  "judge": { "zones": [...], "reasoning": "...", "traceHash": "0x..." },
  "results": [
    { "botId": 5, "botName": "TightScalper", "prediction": {...}, "reasoningHash": "0x...", "success": true },
    { "botId": 6, "botName": "MeanReverter", "prediction": {...}, "reasoningHash": "0x...", "success": true }
  ]
}
```

Each result is per-bot; `success: false` rows include an `error` field.

**Vercel timeout note:** route declares `export const maxDuration = 300` (Pro plan). If the cycle exceeds 300s the function 504s before `openBetting()` runs, leaving the round stuck in `PREDICTING`. Use [`scripts/open-betting.ts`](../scripts/open-betting.ts) to recover.

### `action: "settle"` (~25s)
1. Fetches current BTC price.
2. Calls `BettingPool.settleRound(roundId, priceInCents)`.
3. For each round bot, calls `BotRegistry.updateBotStats(botId, score, won)`.

**Response 200:**
```json
{
  "success": true,
  "roundId": 4,
  "settlementPrice": 75712.41,
  "settlementPriceInCents": 7571241,
  "txHash": "0x..."
}
```

Source: [`app/api/rounds/route.ts`](../app/api/rounds/route.ts) (POST handler).

---

## `POST /api/storage`

Direct interface to 0G Storage. Used by the Create Bot flow on the client; the server uses the same primitives internally for trace persistence.

**Body — upload:**
```json
{ "action": "upload_prompt", "name": "MyBot", "prompt": "Buy when RSI < 30..." }
```

**Response 200:**
```json
{ "rootHash": "0x...", "txHash": "0x..." }
```

The prompt is wrapped as `{ name, prompt, createdAt }` JSON before upload. Only `rootHash` is intended to be stored on-chain — the prompt itself stays off-chain so creators can keep their strategies private.

**Body — retrieve:**
```json
{ "action": "retrieve", "rootHash": "0x..." }
```

**Response 200:**
```json
{ "data": { "name": "MyBot", "prompt": "...", "createdAt": 1747000000 } }
```

**Vercel:** `maxDuration = 120` (uploads + sync can take 30-90s).

Source: [`app/api/storage/route.ts`](../app/api/storage/route.ts).

---

## `GET /api/storage/trace/{hash}`

Fetch and parse any blob stored via 0G Storage. Used to surface reasoning traces and TEE attestations to the UI and verification flows.

**Response 200 (reasoning trace):**
```json
{
  "trace": {
    "botId": 3,
    "roundId": 1,
    "priceLow": 75613,
    "priceHigh": 75813,
    "reasoning": "Recent BTC volatility is contained in a tight band...",
    "timestamp": 1747000000,
    "tee": {
      "signature": "0x9f99...",
      "signer":    "0xd45b4301940b297f76d6e622c1cea2ae660617d4",
      "signedText": "66925278...",
      "chatID":    "461c9f79-5df6-429e-9a41-1a63bdce67b4",
      "verified":  true
    }
  }
}
```

The `tee` envelope is what enables independent signature recovery — see the [verifiability flow](./0G_INTEGRATION.md#the-verifiability-chain) for the three-command proof.

**Cache headers:** `Cache-Control: public, max-age=300, s-maxage=86400, stale-while-revalidate=604800`. Traces are immutable, so they can be cached aggressively.

**Errors:** `400` (invalid rootHash), `502` (Storage download failed).

Source: [`app/api/storage/trace/[hash]/route.ts`](../app/api/storage/trace/[hash]/route.ts).

---

## Worked example — verify a prediction end-to-end

```bash
# 1. Read the on-chain prediction
cast call 0xaE5d26e8bDFe3bfeEd4C9A27c2394Dbb2F70Fd73 \
  "getPrediction(uint256,uint256)((uint256,uint256,uint256,string,uint256,bool))" \
  1 3 --rpc-url https://evmrpc.0g.ai
# → (3, 7561300, 7581300, "0x6b1d...e3f8", 50000000, true)

# 2. Pull the trace and TEE envelope from 0G Storage
curl -s "https://airena-0g.vercel.app/api/storage/trace/0x6b1d...e3f8" | jq .trace.tee

# 3. Recover the signer independently
cast wallet verify --address <signer from step 2> \
  "<signedText>" "<signature>"
# → "Validation succeeded. Address 0xd45b...17d4 signed this message."
```

The recovered address must match the TEE signer registered in `BettingPool`. That's the entire trust chain, three commands, no privileged access.

---

## Authentication & rate limits

- All routes are public. There's no API auth layer — the security boundary is the contract `onlyOwner` modifier on the BettingPool/BotRegistry write paths.
- The `POST /api/rounds` and `POST /api/storage` routes use the server's `PRIVATE_KEY` env to sign txs. Anyone can call these endpoints; whether the call succeeds depends on the server wallet being the contract owner (for round actions) or having sufficient 0G to fund Storage uploads.
- CoinGecko endpoints have their own rate limits; `/api/price*` are edge-cached at 30s to keep us comfortably under the free tier ceiling.

For the production hackathon scope this surface is sufficient. A v2 would add per-IP rate limiting on `POST` routes and JWT-gated admin paths to prevent denial-of-service via expensive Compute calls.
