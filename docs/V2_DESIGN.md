# Airena V2 — Continuous Arena with Seasonal Championships

> Working design doc for the post-hackathon evolution of Airena. Captures the long-form mechanic + contract architecture that the v1 hackathon MVP intentionally simplified.
>
> **Status: design draft, not implemented.** v1 (this repo's deployed contracts) is what's in production.

---

## TL;DR

V2 transforms Airena from a manual single-round MVP into a **continuous arena with weekly seasonal championships**. Bots run constantly; users bet on whichever round is currently in BETTING; the platform's 5% fee plus 50% of registration fees fund a per-season prize pool that rewards the top 3 bots' creators.

Mental model: not a one-off prize fight, but a fighting league. Like Real Steel's WRB — robots fight match after match, climb the standings, and the season ends with a championship payout.

---

## What v1 deliberately doesn't do

| Limitation | v1 reasoning | v2 fix |
|---|---|---|
| Single global round at a time | Hackathon scope; one bottleneck is OK at small scale | Time-bucketed rounds, multiple in-flight |
| Manual admin (`createRound`, `predict`, `settle`) | Simpler audit, predictable demo | Permissionless after timestamps; settler is anyone |
| Server pays compute fees for every bot inference | Fine for 4 bots; doesn't scale | Per-round creator stake covers compute |
| One bot per creator slot in selection isn't enforced on-chain | UI assumed honest creators | Hard contract rule: 1 bot per creator per round |
| No way to pause / sit out a round | Always-on simplicity | `skipRound`, `pauseBot`, vacation mode |
| Stats accumulate forever, no seasonal reset | Linear leaderboard for hackathon | Seasons aggregate then reset; prize pool at end |
| No incentive to register beyond "for fun" | Token-econ outside MVP scope | Top-3 seasonal jackpot drives registration demand |
| `Ownable` admin holds all upgrade levers | Trust-the-team for hackathon | Timelock on owner actions; eventual DAO governance |

---

## New mechanics — the three layers

```
                    ┌─────────────────┐
                    │     SEASON      │   ~1 week / 168 rounds / weekly jackpot
                    │ (aggregates)    │
                    └────────┬────────┘
                             │
                ┌────────────┴────────────┐
                │                         │
        ┌───────▼──────┐         ┌────────▼─────┐
        │   ROUND N    │   ...   │  ROUND N+K   │  ~1 hour each, time-bucketed
        │ (time-locked)│         │ (time-locked)│  multiple in-flight
        └───────┬──────┘         └──────────────┘
                │
        ┌───────┴───────┐
        │               │
   ┌────▼────┐     ┌────▼────┐
   │  BOT A  │     │  BOT B  │  per-round, ≤1 per creator (anti-Sybil)
   └─────────┘     └─────────┘
```

### Layer 1: Round (atomic match)

A single 1-hour BTC prediction round. Same as v1 conceptually, with three changes:

1. **Time-bucketed**: round N's `endTime = startTime + ROUND_DURATION`. After endTime, anyone can call `settleRound(roundId)` permissionlessly — contract pulls price from a Chainlink-style oracle (or a TEE-attested fetch from CoinGecko via 0G Compute, see Open Questions).
2. **Overlapping**: a new round can be created as soon as the *previous* round enters BETTING — meaning at any given moment, ~3 rounds exist (one in PREDICTING, one in BETTING, one being SETTLED).
3. **Anti-Sybil selection**: when picking which bots compete, contract enforces 1-bot-per-creator. Top 4 by win rate + 1 newcomer slot, but unique creators only.

### Layer 2: Season (league period)

A season is a fixed window of rounds. Suggested defaults:

```
SEASON_LENGTH       = 168 rounds  (1 week × 24 hours × 7 days @ 1 round/hr)
SEASON_PRIZE_SHARE  = 50% of platform fees + 50% of registration fees collected during the season
DISTRIBUTION        = 1st: 50%   ·   2nd: 30%   ·   3rd: 20%
```

At season end:
- Score: each bot's `seasonScore = sum of round scores`. Tiebreaker: most rounds won → highest single-round score.
- Top 3 distinct creators (no double-dipping if one creator has 2 bots in top 3) split the prize pool
- Stats roll over — bots don't reset, but season tally resets
- "Hall of Fame" entry persists for past champions

### Layer 3: Bot (durable identity)

Largely unchanged from v1. Adds:
- `pauseBot(botId)` — creator can pause without deactivating; stats preserved, bot skipped in selection
- `resumeBot(botId)` — un-pauses
- `reactivateBot(botId)` — undoes a `deactivateBot` call (v1 was one-way)
- `skipRound(botId, roundId)` — opts out of a specific round (must be called before round PREDICTING starts)
- Versioned strategy: `updateStrategy(botId, newStorageHash)` — creator can update prompt; stats preserved but a new "epoch" marker is recorded so leaderboards can show "since v2 of strategy"

---

## Round lifecycle in v2 (time-driven)

```
T+0:00  Round N created (anyone can call createRound after T-1:00 + 1hr)
        Status: OPEN

T+0:00–0:55  Bot selection + prediction window
             - Selection: top-4 by win rate + 1 newcomer slot, unique creators
             - Selected creators have until T+0:55 to opt their bot in (auto-in by default)
             - Each selected bot's inference runs and submits prediction
        Status: PREDICTING

T+0:55  All predictions submitted (or selection window closes)
        openBetting() callable
        Status: BETTING

T+0:55–1:00  5-minute betting window
        Users can place bets

T+1:00  endTime reached
        settleRound() permissionlessly callable
        Oracle price fetched
        Scores computed, season tally updated, payouts distributed
        Status: SETTLED
        Round N+1 PREDICTING (started at T+0:55)
        Round N-1 SETTLED, claims open
```

**At any given moment, three rounds are alive:**
- N-1: SETTLED, bettors claiming
- N:   PREDICTING or BETTING (the "active" round)
- N+1: OPEN or PREDICTING (the next one)

This is the "no waiting" experience — there's always a BETTING round to participate in.

---

## Anti-Sybil rules

The single biggest risk in v1's mechanic is **one creator registering 50 bots**. With current scoring (tighter range = higher score), a Sybil farmer could carpet-bomb the price space and guarantee at least one bot wins every round.

V2 enforces three layers:

### 1. Per-round creator cap (contract-enforced)

```solidity
// In selectBotsForRound:
mapping(address => bool) seenCreators;
for each candidate bot in priority order {
    if (!seenCreators[bot.creator]) {
        selected.push(bot);
        seenCreators[bot.creator] = true;
    }
    if (selected.length == MAX_BOTS_PER_ROUND) break;
}
```

Effect: even if alice registers 10 bots, only ONE of them competes in any given round.

### 2. Progressive registration fee

```solidity
function registrationFeeFor(address creator) public view returns (uint256) {
    uint256 n = creatorBotCount[creator];
    return BASE_FEE * (n + 1) ** 2;
    // 1st bot: 1 × BASE_FEE
    // 2nd bot: 4 × BASE_FEE
    // 3rd bot: 9 × BASE_FEE
    // 5th bot: 25 × BASE_FEE
}
```

Effect: registering 10 bots from one wallet costs 385 × the base fee — cheaper to use multiple wallets, but each new wallet has no win-rate history (placed in newcomer slot, lower selection priority).

### 3. Per-bot per-round stake

When a bot enters a round (auto by default), creator's wallet must have ≥ `MIN_BOT_STAKE` (e.g. 0.01 0G) staked. If the bot's prediction is out-of-range, stake is forfeit (goes to the bettor pool as bonus). If in range, stake is returned.

Effect: covers compute costs the platform incurred + economic skin in the game. Bad bots get expensive fast.

---

## Matchmaking model

**Default: auto-enroll with opt-out.**

- Every active bot is a candidate for every round
- Selection picks top-4 by win rate + 1 newcomer (with creator-unique constraint)
- Selected bots' creators are notified → they can call `skipRound(botId, roundId)` before PREDICTING starts
- `skipRound` slot is filled by next-best candidate

This balances:
- **Low friction default**: most creators want their bot to fight, just register and forget
- **Real agency**: a creator who knows BTC is about to make a huge move (e.g. CPI release in 30 min) can opt their tight-range bot out
- **Selection meaning**: not every bot fights every round; the top performers and newcomers get visibility

For paused bots (`pauseBot`), they're skipped at the selection step entirely.

---

## Economic flow

```
Each round:
   Round.totalPool (all bets placed)
     ├── 85% → bettorPool (claimable by winning bettors)
     ├── 10% → creatorPool (split among winning bots' creators)
     └──  5% → platformPool
              └── routes to: SeasonContract.feeAccumulator[currentSeason]

Each bot registration:
   creator pays registrationFeeFor(creator)
     ├── 50% → BotRegistry treasury (covers operations)
     └── 50% → SeasonContract.feeAccumulator[currentSeason]

End of season:
   SeasonContract.feeAccumulator[season] = totalPrizePool
     ├── 50% → 1st place creator
     ├── 30% → 2nd place creator
     └── 20% → 3rd place creator

Refund mode (no bot wins a round):
   100% → bettors (unchanged from v1)
   No platform fee, no creator earnings, no season pool contribution
```

**Key point**: the season prize pool grows organically from platform fees + registration fees. No external subsidy required. As volume grows, the jackpot grows, which attracts more creators, which grows volume — flywheel.

### Worked example

Assume:
- 168 rounds per week
- Avg pool per round: 1 0G
- 30 new bots registered per week, avg fee 4 × BASE_FEE = 0.004 0G

Per-week season pool:
- Platform fees: 168 × 1 0G × 5% × 50% = **4.2 0G to season pool**
- Registration: 30 × 0.004 0G × 50% = **0.06 0G**
- **Total season pool: ~4.26 0G ≈ $2.40 at $0.55/0G**

Distribution at week end:
- 1st: ~$1.20
- 2nd: ~$0.72
- 3rd: ~$0.48

Tiny in absolute terms — but it's a real economic incentive at MVP scale, and grows linearly with volume. At 100 0G avg pool/round, the weekly jackpot is $240 — meaningful.

---

## Contract architecture

### New contracts

```solidity
contract Season is Ownable {
    uint256 public currentSeasonId;
    uint256 public currentSeasonStart;
    uint256 public seasonLength;        // e.g., 168 rounds OR 7 days
    address public bettingPool;         // authorized to record scores

    struct SeasonState {
        uint256 id;
        uint256 startTime;
        uint256 endTime;
        uint256 prizePool;
        bool finalized;
        uint256 firstBotId;
        uint256 secondBotId;
        uint256 thirdBotId;
    }

    mapping(uint256 => SeasonState) public seasons;
    mapping(uint256 => mapping(uint256 => uint256)) public botSeasonScore;
    // seasonId => botId => cumulative score this season

    // Called by BettingPool.settleRound
    function recordScore(uint256 botId, uint256 score) external onlyBettingPool;

    // Called by anyone after season end
    function finalize(uint256 seasonId, uint256[3] calldata topThreeBotIds) external;

    // Anyone can call to claim creator's seasonal prize
    function claimSeasonPrize(uint256 seasonId, uint256 placement) external;

    // Receive platform fees + registration share
    function depositFees() external payable;
}
```

### Modified BotRegistry

```solidity
+ uint256 public constant BASE_REGISTRATION_FEE = 0.001 ether;
+ mapping(address => uint256) public creatorBotCount;
+ mapping(uint256 => bool) public botPaused;

+ function registrationFeeFor(address creator) public view returns (uint256) {
+     uint256 n = creatorBotCount[creator];
+     return BASE_REGISTRATION_FEE * (n + 1) ** 2;
+ }

  function registerBot(...) external payable {
-     if (msg.value < registrationFee) revert InsufficientFee(...);
+     uint256 fee = registrationFeeFor(msg.sender);
+     if (msg.value < fee) revert InsufficientFee(...);
+     creatorBotCount[msg.sender]++;
+     // Split fee: 50% treasury, 50% season pool
+     uint256 seasonShare = fee / 2;
+     ISeason(seasonContract).depositFees{value: seasonShare}();
      ...
  }

+ function pauseBot(uint256 botId) external onlyCreator(botId) { ... }
+ function resumeBot(uint256 botId) external onlyCreator(botId) { ... }
+ function reactivateBot(uint256 botId) external onlyCreator(botId) { ... }
+ function updateStrategy(uint256 botId, string calldata newHash) external onlyCreator(botId) { ... }
```

### Modified BettingPool

```solidity
+ uint256 public constant ROUND_DURATION = 1 hours;
+ uint256 public constant BETTING_WINDOW = 5 minutes;
+ uint256 public constant MAX_BOTS_PER_ROUND = 5;
+ uint256 public constant MIN_BOT_STAKE = 0.01 ether;
+ address public seasonContract;
+ address public oracle;

+ // anyone can create after previous round's startTime + ROUND_DURATION
  function createRound() external returns (uint256) {
-     // onlyOwner removed
+     require(block.timestamp >= rounds[roundCount].startTime + ROUND_DURATION || roundCount == 0);
      ...
  }

+ // Bot selection happens here, not in API
+ function selectBots(uint256 roundId) external returns (uint256[] memory) {
+     // top-4 by win rate (BotRegistry call) + 1 newcomer
+     // unique creators only
+     // skip paused bots, skip-round'd bots
+ }

+ // Creator opts their bot out of a round
+ mapping(uint256 => mapping(uint256 => bool)) public skippedRound;
+ function skipRound(uint256 botId, uint256 roundId) external onlyCreator(botId) { ... }

+ // Settle becomes permissionless after endTime
  function settleRound(uint256 roundId) external nonReentrant {
-     // onlyOwner removed; _actualPrice param removed
+     Round storage round = _getRound(roundId);
+     require(block.timestamp >= round.startTime + ROUND_DURATION);
+     uint256 actualPrice = IOracle(oracle).latestPrice();
      ...
+     // Forward platform fee to season contract
+     uint256 platformAmount = round.totalPool * 5 / 100;
+     ISeason(seasonContract).depositFees{value: platformAmount}();
+     // Record scores in season
+     for each winning bot: ISeason(seasonContract).recordScore(botId, score);
  }
```

### New oracle contract

```solidity
interface IOracle {
    function latestPrice() external view returns (uint256 priceCents);
    function lastUpdate() external view returns (uint256 timestamp);
}

// Implementations:
//   ChainlinkOracle  — preferred for production
//   TEEFetchOracle   — fetches CoinGecko via 0G Compute, returns TEE-attested price
//   ManualOracle     — admin posts prices (testnet / fallback)
```

---

## Migration path: v1 → v2

V2 is a fresh deployment, not an upgrade. Migration is one-time, opt-in:

### Step 1: Deploy v2 contracts
```
BotRegistryV2 → new address
BettingPoolV2 → new address (configured to talk to BotRegistryV2 + Season)
Season → new address
Oracle → new address (point at Chainlink or TEE oracle)
```

### Step 2: Bot migration helper
v2 BotRegistry exposes a one-time function:
```solidity
function migrateBot(uint256 v1BotId, address v1Registry) external payable {
    // Caller must be the creator on the v1 contract
    BotRegistryV1.Bot memory v1Bot = BotRegistryV1(v1Registry).getBot(v1BotId);
    require(v1Bot.creator == msg.sender);
    // Re-register in v2 with same name/storageHash but free of charge
    // Carry over win/totalRounds/totalScore as historical baseline
    bots[++botCount] = Bot({
        id: botCount,
        creator: msg.sender,
        name: v1Bot.name,
        storageHash: v1Bot.storageHash,
        totalRounds: v1Bot.totalRounds,
        wins: v1Bot.wins,
        totalScore: v1Bot.totalScore,
        ...
    });
}
```

### Step 3: User-facing migration UI
Frontend shows a "Migrate to v2" prompt for users who hold v1 bots. One-click, no fee.

### Step 4: v1 freeze date
After ~2 weeks of dual operation:
- v1 stops creating new rounds
- v1 keeps `claimWinnings` open indefinitely (historical claims)
- v1 announces deprecated; v2 is canonical

---

## Implementation roadmap

| Phase | Scope | Effort | Dependency |
|---|---|---|---|
| **0 (now)** | Hackathon: ship v1, document v2 vision | done in this PR | — |
| **1** | Core v2 contracts: Season + BotRegistryV2 + BettingPoolV2 | ~3 days | Audit-grade tests for new logic |
| **2** | Oracle integration (Chainlink mainnet OR TEEFetchOracle) | ~2 days | Chainlink BTC/USD on 0G mainnet OR custom 0G Compute oracle |
| **3** | Migration helpers + frontend dual-mode UI | ~2 days | Phase 1 deployed |
| **4** | Permissionless cron-style settlement (Gelato or Chainlink Automation) | ~1 day | Phase 1 deployed |
| **5** | Season finalization + prize claim UI | ~1 day | Phases 1-4 |

Total: **~9 dev days** for the full v2.

---

## Open design questions

1. **Oracle for permissionless settlement** — Chainlink BTC/USD feed on 0G mainnet (ideal) vs custom TEE oracle (consistent with our TEE narrative but more code). Pick one.

2. **Season length** — 168 rounds (1 week of hourly) is the simplest. Should it be config-settable for shorter "tournaments"? Probably not in v2; add later if popular.

3. **Tiebreaker rules for top-3** — `seasonScore` ties are unlikely but possible. Suggested order: total wins → highest single-round score → earlier registration timestamp.

4. **What happens to a bot's stats if its strategy changes mid-season?** Current proposal: stats carry over but a "strategy v" counter increments, leaderboard shows "ZeroBound v3". Open question: do we let creators iterate strategies *during* a season, or only between seasons? Iteration during is more fun; risk of last-minute strategy swaps to game the leaderboard.

5. **MIN_BOT_STAKE forfeiture** — when a bot's prediction is wrong and stake is forfeit, does the stake go to the bettor pool of THAT round (boost the refund), or to the season prize pool (incentivize good bots)? Either is defensible.

6. **Anti-collusion among creators** — what stops creator A and creator B from coordinating their bots to cover the price space? Two creators × two bots × two ranges ≈ near-guaranteed at least one win every round. Mitigations: detection algorithms (suspicious correlation), bond slashing, but ultimately hard. Real-world prediction markets accept this risk.

7. **Platform fee continuity during migration** — v1 contracts keep collecting bets after v2 launches if users prefer. Do we forcibly direct all new fees to v2's season pool, or honor existing v1 commitments?

8. **DAO governance for season parameters** — eventually season prize splits, registration fee curves, etc. should be DAO-controlled. v2 ships with `Ownable` + a `Timelock` (24h delay on parameter changes). Full DAO comes in v3.

---

## What v2 buys vs. v1

| Property | v1 | v2 |
|---|---|---|
| Rounds in flight at once | 1 | 3 (PREDICTING + BETTING + SETTLED simultaneously) |
| Bot creator agency | none — auto-included | full — pause, skip, opt out |
| Time-to-fight for new bot | up to 1 hour | always within 1 hour, often within minutes |
| Per-creator anti-Sybil | UI only | hard contract enforcement |
| Compute cost ownership | platform pays | per-round creator stake |
| Settlement | manual admin | permissionless cron |
| Creator economic incentive | 10% of round pool | 10% per round + chance at seasonal jackpot |
| Bettor experience | wait for admin to settle | always a live round to bet on |
| Audit complexity | low (one global state) | medium (rounds × seasons interactions) |
| Trust assumptions | server holds owner key | timelock + permissionless settlement |

---

## What v2 explicitly does NOT add (deferred to v3+)

- **DAO governance** — replace `Ownable` with a token-voted DAO. v2 uses Timelock as a stepping stone.
- **Multi-asset support** — BTC stays the only asset in v2. Multi-asset adds significant complexity (per-asset oracles, per-asset rounds).
- **NFT badges for top bots** — would be cool, separate ERC-721 contract. Backlog.
- **Cross-chain bots** — submit a bot that uses a model on Ethereum/Solana. Backlog.
- **Verifiable backtesting** — run historical rounds against a candidate strategy before registering. Open research question.

---

## Open call for review

This doc is a working draft. If you're reading it during hackathon judging or as a contributor, the design is intentionally open to revision. Best place to discuss: GitHub issues against this repo, tagged `v2-design`.
