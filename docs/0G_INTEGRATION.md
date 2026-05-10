# How Airena Uses 0G

A technical walkthrough of the four 0G touchpoints that make AI prediction
results independently verifiable. This is the document a judge or auditor
would skim to answer: *"is the AI inference actually trustworthy, or are
they just claiming it is?"*

The short answer: every prediction is signed by a TEE, the signer is
registered on-chain, and anyone with a terminal can recover the signature
from public data and confirm the chain of trust.

---

## Architecture at a glance

```
            ┌───────────────────┐
            │   /api/rounds     │  predict endpoint, server-signed
            │   (Vercel Node)   │
            └──┬─────────┬──────┘
               │         │
               │         │ runJudgeInference, runBotInference
               │         ▼
               │  ┌─────────────────────────┐
               │  │ 0G Compute              │  Intel TDX TEE via DStack
               │  │  - Judge AI (Qwen-2.5)  │  signed responses
               │  │  - Bot inferences       │  signer recoverable
               │  └─────────────┬───────────┘
               │                │ TEE attestation envelope
               │                ▼
               │       ┌─────────────────────┐
               │       │ 0G Storage          │  immutable blobs
               │       │  - bot prompts      │  rootHash on-chain
               │       │  - judge traces     │  full trace off-chain
               │       │  - reasoning traces │
               │       └─────────────┬───────┘
               │                     │ rootHash returned
               ▼                     ▼
        ┌──────────────────────────────────┐
        │ 0G Chain                         │
        │  - BettingPool                   │  predictions, scoring,
        │  - BotRegistry                   │  payouts, rev-share
        │  - TEE signer registered         │
        └──────────────────────────────────┘
```

Three 0G components, all wired into the same verifiability claim:
**Compute attests, Storage commits, Chain settles.**

---

## 0G Compute — TEE-attested AI inference

This is the load-bearing piece. AI inference happens inside a 0G Compute
TEE (Intel TDX via DStack), and every response carries a cryptographic
attestation we can verify after the fact.

### The integration surface

We wrap the official `@0glabs/0g-serving-broker` SDK in a single function,
[`runZGInference()`](../lib/0g-compute.ts) ([lib/0g-compute.ts:77](../lib/0g-compute.ts#L77)).
It does four things:

1. Resolves the compute provider's endpoint + model via the broker.
2. Signs the request headers with our server wallet (so the broker can
   bill our prepaid compute account).
3. POSTs an OpenAI-compatible chat completion to the provider.
4. Captures the TEE attestation envelope by:
   - Reading the `ZG-Res-Key` response header (this is the chat ID the
     provider keys signatures by — **not** the OpenAI completion ID).
   - Calling `broker.inference.responseProcessor.processResponse()` to
     verify the response on-chain.
   - Fetching `/signature/{chatID}` from the provider to retrieve the
     `{ text, signature, signing_address }` triple.

The returned `TEEAttestation` shape:

```ts
interface TEEAttestation {
  signature:  string;  // hex-encoded ECDSA signature over `signedText`
  signer:     string;  // recovered TEE signing address
  signedText: string;  // exact bytes the provider signed (commitment)
  chatID:     string;  // ZG-Res-Key value, lookup key on the provider
  verified:   boolean; // result of broker.processResponse
}
```

The `signedText` is *not* the LLM's free-form output. It's a colon-
separated commitment over hashes of the request, response, and the
TDX measurement of the running enclave:

```
<request_hash>:<response_hash>:centralized:<backend_id>:<measurement_hash>
```

That commitment is what's signed by the TEE, and it's what we feed into
`cast wallet verify` to recover the signer.

### Two layers of inference, one verification primitive

Airena uses Compute twice per round:

1. **Judge AI** ([lib/0g-judge.ts](../lib/0g-judge.ts)) — runs once per
   round, proposes 3 candidate prediction zones from recent volatility.
   Frames the bots' decision space.
2. **Bot inference** ([lib/0g-compute.ts:166](../lib/0g-compute.ts#L166))
   — runs once per active bot, prompted with the bot's strategy + the
   Judge's zones. Outputs a structured `{priceLow, priceHigh, reasoning}`.

Both calls go through the same `runZGInference()` and produce the same
attestation envelope, so the verifiability claim composes cleanly. Two
layers of TEE-signed inference, one recovery procedure.

### What the TEE protects against

| Attack | How verification catches it |
|---|---|
| Operator silently swaps the AI model | Signed `signedText` includes the model commitment + TDX measurement. Recovery yields a different signer if the enclave changed. |
| Operator post-edits a prediction before submitting | Reasoning trace's TEE signature wouldn't match the on-chain prediction. Anyone who pulls the trace and recovers the signer can detect the mismatch. |
| Operator front-runs by seeing predictions before bots commit | Inference happens inside the TEE; the operator only sees the signed output, not the model's internal state. |
| Operator fakes "verified" badges in the UI | The badge is decorative. The actual proof is in the signed envelope on Storage; UI claims don't matter. |

---

## 0G Storage — durable, immutable trace persistence

Storage anchors three classes of artifacts:

### 1. Bot strategy prompts

When a creator registers a bot:
1. Their prompt is wrapped as `{ name, prompt, createdAt }` JSON.
2. Uploaded to 0G Storage via [`storeBotPrompt()`](../lib/0g-storage.ts#L75).
3. The returned `rootHash` is stored on-chain in `BotRegistry`.

The full prompt **never appears on-chain.** Only the rootHash does. This
is privacy-preserving: a creator's edge (their strategy text) stays
off-chain and can only be retrieved by someone who already knows the
rootHash. The /create UI reinforces this with a "Privacy: full prompt
never shown" notice next to the input.

### 2. Reasoning traces (per prediction)

Every bot inference produces a reasoning trace:

```ts
interface ReasoningTraceData {
  botId: number;
  roundId: number;
  priceLow: number;
  priceHigh: number;
  reasoning: string;
  timestamp: number;
  tee?: TEEAttestation;   // captured from 0G Compute, persisted alongside
}
```

The trace is uploaded via [`storeReasoningTrace()`](../lib/0g-storage.ts#L87)
and its rootHash is passed into `BettingPool.submitPrediction()` as the
`reasoningHash` field. This ties each on-chain prediction to a Storage
blob containing:
- The natural-language reasoning the bot produced
- The TEE attestation envelope (so the verifiability badge can be
  reconstructed for any past round, not just live ones)

The hash on-chain is what makes the trace tamper-evident: change the
trace bytes, the hash no longer matches.

### 3. Judge traces

The Judge AI produces zones + reasoning + a TEE envelope, persisted via
[`storeJudgeTrace()`](../lib/0g-storage.ts#L98). The judge's rootHash
is held in an in-memory cache keyed by roundId
([`app/api/rounds/route.ts:23`](../app/api/rounds/route.ts#L23))
rather than on-chain — for the v1 hackathon scope we only needed the
rootHash for live UI rendering, and the cache reset on cold-start is
acceptable. Persisting the judge mapping on-chain is a low-cost v2
improvement that would make the Judge VERIFIED badge survive cold
starts.

### Why immutable storage matters

Once a rootHash is committed to a contract, the corresponding bytes are
fixed forever. Storage's content-addressing means:

- A judge can pull any historical trace and replay verification
- Disputes become checkable: "show me the bytes that hash to X"
- The platform can't quietly "patch" past predictions to look better

`/api/storage/trace/{hash}` exposes this as a one-shot HTTP endpoint
with aggressive caching (`s-maxage=86400`) since the bytes never change.

---

## 0G Chain — settlement, scoring, payouts

Two contracts deployed to 0G mainnet:

| Contract | Address | Role |
|---|---|---|
| BettingPool | [`0xaE5d26e8bDFe3bfeEd4C9A27c2394Dbb2F70Fd73`](https://chainscan.0g.ai/address/0xaE5d26e8bDFe3bfeEd4C9A27c2394Dbb2F70Fd73) | round lifecycle, predictions, bets, scoring, payouts |
| BotRegistry | [`0x2187D61279a8A54dc8907865959ef6cC8beBDa14`](https://chainscan.0g.ai/address/0x2187D61279a8A54dc8907865959ef6cC8beBDa14) | bot creation, prompt rootHashes, win/loss stats |

### Round lifecycle

```
createRound()        → status: OPEN
                       (admin opens a new round)
        ↓
submitPrediction()   → status: OPEN → PREDICTING
                       (called once per bot; transitions on first call)
        ↓
openBetting()        → status: PREDICTING → BETTING
                       (called after all predictions; opens placeBet)
        ↓
placeBet()           → bettors stake on bots
        ↓
settleRound(price)   → status: BETTING → SETTLED
                       (scores all predictions, distributes payouts)
```

There's no time-based auto-transition — every state change is an admin
call. This is intentional for the hackathon scope (predictable demo
flow) but trivially upgradeable to time-gated transitions in v2.

### Scoring

A bot's `score` is `0` if its range doesn't contain the settlement price,
else `1e12 / (priceHigh - priceLow)`. Tighter ranges that contain the
actual price score higher. See [`BettingPool.sol:settleRound`](../airena-contracts-0g/src/BettingPool.sol)
for the exact arithmetic.

### Payouts (85 / 10 / 5)

When a round settles with at least one winning bot:
- **85%** to bettors who staked on winning bots, weighted by their stake
  share of each winner's pool and the winner's score share of the round
- **10%** to the winning bots' creators (proportional to their score
  shares)
- **5%** to a platform fee address

When **no** bot's range hits the settlement price, the contract auto-
refunds 100% of every bet — no fees collected, no edge-case losses.

### TEE signer is on-chain

The address that signs TEE attestations
(`0xd45b4301940b297f76d6e622c1cea2ae660617d4`) is registered in
BettingPool. That's what makes verification *meaningful*: without an
on-chain anchor, "the signer is X" is just an unattested claim.

---

## The verifiability chain

The end-to-end proof, the way a judge would walk it. Three commands,
public data only, no privileged access.

### Step 1 — read the on-chain prediction

```bash
cast call 0xaE5d26e8bDFe3bfeEd4C9A27c2394Dbb2F70Fd73 \
  "getPrediction(uint256,uint256)((uint256,uint256,uint256,string,uint256,bool))" \
  1 3 --rpc-url https://evmrpc.0g.ai
```

Returns the prediction tuple. The 4th field is the reasoningHash — a
0G Storage rootHash pointing to the TEE attestation.

### Step 2 — pull the trace from 0G Storage

```bash
curl -s "https://airena-0g.vercel.app/api/storage/trace/<reasoningHash>" \
  | jq .trace.tee
```

Returns the TEE attestation envelope:

```json
{
  "signature":  "0x9f99...",
  "signer":     "0xd45b...",
  "signedText": "...",
  "chatID":     "...",
  "verified":   true
}
```

### Step 3 — recover the signer independently

```bash
cast wallet verify --address <signer> "<signedText>" "<signature>"
# → "Validation succeeded. Address 0xd45b...17d4 signed this message."
```

The recovered address must equal the signer field — and the signer field
must equal the TEE signer address registered in BettingPool. If both
match, the prediction provably came from the TEE. If either fails, the
chain is broken and the operator can't claim "trust us."

This is the core innovation Track 2 explicitly calls for ("Sealed
Inference and TEE-based execution to ensure execution privacy and
mitigate front-running"). The bot card's `OK VERIFIED · 0G TEE` badge
is a UI shorthand for this exact procedure — clicking it copies the
signer address so a skeptic can run step 3 in seconds.

---

## File map for source-divers

| What | Where |
|---|---|
| 0G Compute integration (Judge + bot inference, TEE capture) | [`lib/0g-compute.ts`](../lib/0g-compute.ts) |
| Judge AI prompt + parsing + retry logic | [`lib/0g-judge.ts`](../lib/0g-judge.ts) |
| 0G Storage upload/retrieve helpers | [`lib/0g-storage.ts`](../lib/0g-storage.ts) |
| Contract addresses + ABIs | [`lib/contracts.ts`](../lib/contracts.ts) |
| Round lifecycle API (predict / settle / create) | [`app/api/rounds/route.ts`](../app/api/rounds/route.ts) |
| Trace retrieval endpoint | [`app/api/storage/trace/[hash]/route.ts`](../app/api/storage/trace/[hash]/route.ts) |
| TEE badge UI (click-to-copy signer) | [`components/ArenaClient.tsx`](../components/ArenaClient.tsx) `function TEEBadge` |
| BettingPool smart contract | [`airena-contracts-0g/src/BettingPool.sol`](../airena-contracts-0g/src/BettingPool.sol) |
| BotRegistry smart contract | [`airena-contracts-0g/src/BotRegistry.sol`](../airena-contracts-0g/src/BotRegistry.sol) |

---

## Known limitations + v2 directions

Honest assessment for reviewers:

- **JudgeCache is in-memory.** Rounds settled before a Vercel cold-start
  lose the Judge VERIFIED badge in the UI. The full reasoning lives
  durably on Storage; only the rootHash mapping is volatile. Fix:
  persist `judgeCache` to 0G Storage as a roundId → rootHash index.
- **No time-gated round transitions.** Currently every status change is
  an admin call. Easy to add `block.timestamp` checks.
- **No per-IP rate limit on POST /api/rounds.** An attacker spamming
  `predict` would burn through our prepaid Compute balance but couldn't
  exfiltrate anything. v2: rate limit + admin auth on the POST routes.
- **5-bot cap per round** (`MAX_BOTS_PER_ROUND` in
  [route.ts:28](../app/api/rounds/route.ts#L28)). Past that, ranking by
  win rate + 1 newcomer slot. Trades expressiveness for predictable
  predict latency. v2: tiered competition + sharded rounds.

The verifiability claim itself is self-contained and doesn't depend on
any of these — they're operational ergonomics, not trust-model issues.
