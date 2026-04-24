# Joining 0G hackathon

**Created:** 4/24/2026 14:07:43  
**Updated:** 4/24/2026 20:09:02  
**Exported:** 4/24/2026 20:30:31  
**Link:** [https://claude.ai/chat/c2d8974f-02a8-4a6c-aba7-576ae446b3f5](https://claude.ai/chat/c2d8974f-02a8-4a6c-aba7-576ae446b3f5)  

## Prompt:
4/24/2026, 2:07:43 PM

> File: 

i want to join 0G hackathon

this is the hackathon requirements.

i also provide 0G docs https://build.0g.ai



## Response:
4/24/2026, 2:08:07 PM

````plaintext
Web Fetch: Fetched: 0G Builder Hub
````

````plaintext
Web Fetch: Fetched: 0G Storage | 0G Builder Hub
````

````plaintext
Web Fetch: Fetched: 0G Compute | 0G Builder Hub
````

Great, I've read through both the hackathon requirements and the 0G docs. Before I help you plan your project and approach, let me ask a few things to point you in the right direction:

````plaintext
Tool: Generating ask_user_input_v0...
````

I found a few options — which would you like?



## Prompt:
4/24/2026, 2:08:57 PM

Q: Which track interests you most?
A: Track 3: Agentic Economy (payments, marketplaces, DAOs)

Q: Do you already have a project idea?
A: I have a rough concept



## Response:
4/24/2026, 2:09:01 PM

Great! Tell me about your rough concept — what's the idea you have in mind?

Even a few sentences is enough to get started. I can help you shape it into a solid project, map it to the right 0G components, and plan out what you need to build before the May 16 deadline.



## Prompt:
4/24/2026, 2:11:07 PM

so, the idea is:

right now im on ideathon for ai x web3 agentic hackathon. ive been thinking about ai agent prediction arena. where user can have 1 bot..the bot will battle with other bot..they are battling about prize prediction for a specific crypto; eg btc. bot can only pick one side from 2 or 3 options user can tuning or specifically "make their agent smarter, using prompt or algorithm with limitations, eg: 500 words". the model business is taking fee for each predictions made. what do you think?

this is the weakness If users lose → they quit → revenue dies If users win → you need liquidity or counterparty. what about a battle of a bot that user can bet on? bot is created by user. user will regist the bot as participant.. we will talk about the calculation payment..but we think about the game itself. so the top leaderboard basically a good fine tuned agent...they have a good winning rate, good decision, good prediction and analysis..Then we don't stop here. but the bot who have good reputation can be sell in the bot market.



## Response:
4/24/2026, 2:11:20 PM

This is a really solid concept! Let me reflect back what I'm hearing and sharpen it:

**The Core Loop:**
1. Users create & register an AI prediction bot (customized via prompt/algorithm, ~500 word limit)
2. Bots compete in prediction arenas (BTC price goes Up/Down/Sideways, etc.)
3. Other users **bet on bots** — not the price directly
4. Bots accumulate a reputation score (win rate, accuracy, consistency)
5. Top bots can be **listed and sold** in a Bot Marketplace

This is actually a much stronger model than your original because:
- **You're not the counterparty** — bettors bet against each other on which bot wins
- **Revenue = platform fees** on bets + marketplace sales + bot registration
- **Network effects** — good bot creators attract bettors, bettors attract more creators

---

Now let me ask the key question before we go deeper:

````plaintext
Tool: Generating ask_user_input_v0...
````





## Prompt:
4/24/2026, 2:11:50 PM

Q: For the bot battles — how should the prediction work?
A: Bots predict a price range (e.g. BTC between $X–$Y)

Q: For the Bot Marketplace — what should buyers get?
A: Buy the bot's prompt/strategy (own it forever)



## Response:
4/24/2026, 2:12:09 PM

Love these choices. Price range prediction is more skill-based (harder to game than just Up/Down), and permanent ownership of a bot's strategy is clean and creates real value.

Here's the refined concept:

---

**🤖 PredictArena — AI Bot Prediction & Marketplace on 0G**

**The Game:**
- Users create a bot by writing a prediction strategy (prompt + optional logic, ~500 word limit)
- Each round: bots predict a BTC price range for a fixed window (e.g. "BTC will be between $103,000–$105,000 in 24h")
- Accuracy is scored by how tight & correct the range is — tighter correct range = higher score
- Other users bet on which bot will be most accurate that round
- Bets go into a pool, winners split minus platform fee

**Reputation System:**
- Bots accumulate score over rounds: accuracy, consistency, win streak
- Public leaderboard — top bots become trusted, attract more bettors

**Bot Marketplace:**
- Bot creator can list their bot's prompt/strategy as an NFT
- Buyer permanently owns the strategy, can deploy it as their own bot
- Platform takes a % of the sale

---

Now the critical part — **how this maps to 0G** (which determines if you win):

| Feature | 0G Component |
|---|---|
| Bot strategy storage (prompts) | **0G Storage** — decentralized, tamper-proof |
| AI inference (bot making predictions) | **0G Compute** — decentralized LLM calls |
| Bot identity + NFT ownership | **Agentic ID (ERC-7857)** on 0G Chain |
| On-chain betting pool & fees | **0G Chain** (EVM-compatible smart contracts) |
| Leaderboard & reputation | **0G Storage** (Key-Value layer for live state) |

This hits **Track 3 perfectly** — it's an AI-driven marketplace with micropayments, Agent-as-a-Service, and on-chain economic rails. It also touches Track 1 (agentic infrastructure) which judges love.

---

Before I help you plan the build timeline and architecture, one more thing:

````plaintext
Tool: Generating ask_user_input_v0...
````





## Prompt:
4/24/2026, 2:13:00 PM

Q: How many people are on your team?
A: Solo builder

Q: What's your primary stack?
A: next js, solidity, vercel, supabase/convex



## Response:
4/24/2026, 2:13:19 PM

Perfect stack for this — Next.js + Solidity is exactly right for a dApp like this. Solo builder means we need to be **ruthlessly scoped** to hit the May 16 deadline (~3 weeks left).

Here's my honest scoping advice:

---

**🎯 MVP Scope (what you MUST build to win)**

Cut everything that isn't core to the judging criteria. Judges care about 0G integration depth, working demo, and clear value prop.

**Must Have:**
- Bot registration (user writes prompt strategy, stored on **0G Storage**)
- Bot identity as on-chain entity using **Agentic ID (ERC-7857)** on 0G Chain
- Prediction round: bot calls **0G Compute** (LLM) → outputs a price range
- Price settlement using a public oracle (Chainlink or Pyth)
- Simple betting pool smart contract on **0G Chain**
- Leaderboard (bot reputation score, stored in 0G Storage KV layer)
- Bot Marketplace: list/buy bot strategy as NFT on 0G Chain

**Cut for now (post-hackathon):**
- Complex tokenomics
- Multiple crypto pairs (just BTC for MVP)
- Mobile UI
- Copy-trade feature

---

**🗓️ 3-Week Build Plan (Solo)**

**Week 1 — Core infra (now → May 2)**
- Set up 0G testnet wallet, fund via faucet
- Deploy basic smart contracts: BettingPool, BotRegistry, BotMarketplace
- Integrate 0G Storage SDK — save/retrieve bot prompts
- Integrate 0G Compute SDK — wire up LLM inference call from a bot

**Week 2 — Game logic + UI (May 3–10)**
- Prediction round logic: trigger bot → get range → store result
- Oracle integration for BTC price settlement
- Next.js frontend: create bot page, arena page, leaderboard
- Wallet connect (wagmi + RainbowKit or ConnectKit)

**Week 3 — Polish + Submission (May 11–16)**
- Bot Marketplace page (list, buy, transfer ownership)
- End-to-end demo flow working cleanly
- README + architecture diagram
- 3-min demo video
- X post with #0GHackathon #BuildOn0G
- Submit on HackQuest before May 16 23:59 UTC+8

---

**⚠️ Key Risk to Watch**

Supabase/Convex — you probably won't need them. 0G Storage replaces your DB for bot prompts and leaderboard state. Keep your stack lean: **Next.js + Solidity + 0G SDK only**. Less moving parts = fewer things to break in a demo.

---

Want me to now generate:
1. **The smart contract architecture** (which contracts, what they do)
2. **The full project folder structure** for your Next.js app
3. **A starter README** you can submit

Which should we tackle first?



## Prompt:
4/24/2026, 2:16:54 PM

> File: 

yesterday i brainstorm with ai, the respond was very critical..here the view respond:

This idea isn’t bad—but your current framing is weak, crowded, and dangerously close to “another gimmicky crypto game” that nobody sticks with.
Let’s cut through it.
The uncomfortable truth
You’re not building an AI product. You’re building a prediction market with a thin AI skin.
And prediction markets already exist:

* Polymarket
* Augur
So your real question is: Why would anyone use your version instead of those?
Right now, your answer is:
“Because agents battle each other.”
That’s not a reason. That’s a feature.
Where your thinking is weak
1. You’re overestimating “AI agents” as value
Let’s be blunt: Most users don’t care about tuning prompts or building agents.
They care about:

* making money
* or entertainment
Your system currently sits awkwardly in the middle:

* Too complex for casual users
* Too shallow for serious traders
That’s a dead zone.
2. “Prediction game” without edge = gambling clone
If your agents:

* don’t have real edge
* don’t access unique data
* don’t outperform humans
Then this becomes:
a glorified coin flip with extra steps
And users churn FAST in that category.
3. Your monetization is fragile
“Fee per prediction” sounds clean, but think deeper:

* If users lose → they quit → revenue dies
* If users win → you need liquidity or counterparty
You’re basically reinventing:

* betting markets
* or PvP wagering systems
Without solving liquidity, this collapses.
Where this actually becomes interesting
You’re sitting on something better—but you’re not leaning into it.
The real opportunity:
Turn this into a competitive AI meta-game, not a prediction tool
Shift from:
“predict BTC price”
To:
“build the best decision-making agent under constraints”
Now you’re playing in the territory of:

* strategy
* optimization
* meta-learning
* competition
Think:

* Auto Chess
* meets
* Football Manager
* but for AI agents
What you’re missing (critical)
1. You need asymmetry (edge)
Right now every bot is the same.
That’s boring.
You need:

* Different data access tiers
* Different “agent archetypes”
* Constraints that force tradeoffs
Example:

* Bot A: fast, reactive (uses short-term signals)
* Bot B: slow, macro thinker
* Bot C: risk-seeking
Now it’s strategy—not guessing.
2. You need spectators, not just players
If only builders care → you’re niche.
But if people can:

* watch battles
* bet on bots
* follow top agents
Now you have: content + virality
3. You need progression
Why would anyone keep playing?
Add:

* rankings
* leagues
* seasons
* agent evolution
Without this, it’s one-and-done.
Brutal risk check
Be honest with yourself:

* Do you actually have a way to make agents outperform randomness?
* Do you have liquidity for rewards?
* Do you have a reason this isn’t just gambling with extra UI?
If the answer is no → you’re building a short-lived hackathon demo.
What I would do instead (clear plan)
Phase 1 — Narrow the core loop
Forget Web3 for a second.
Build:

* 1 asset (BTC)
* 1 timeframe (e.g., 1h up/down)
* 1v1 agent battle
Focus on: Is this fun or insightful at all?
Phase 2 — Make agents meaningfully different
Introduce:

* limited memory
* different data inputs
* prompt constraints
Force users to think:
“How do I build a better decision system?”
Phase 3 — Add competitive layer

* leaderboard
* win rate
* streaks
Now it becomes addictive.
Phase 4 — THEN add money layer
Only after:

* retention exists
* strategies emerge
Add:

* staking
* fees
* rewards
Final reality check
Right now, your idea is:
60% hype, 40% structure
To make it real:

* flip that ratio
Otherwise you’ll end up with:

* a flashy demo
* zero retention
* no real users after the hackathon
If you want, I can help you:

* design the exact game loop
* define agent constraints
* or craft a pitch that actually wins the hackathon
But don’t keep polishing the current version—it’s not sharp enough yet.



## Response:
4/24/2026, 2:17:14 PM

This is genuinely good critical feedback. The AI that wrote this is right about several things — but it's also pushing you toward an **even smaller** demo than you need for this hackathon.

Let me give you my honest reconciliation:

---

**What the criticism gets RIGHT:**
- Betting on bots doesn't fix churn, it shifts it
- Selling bot strategies as static NFTs is risky (past performance ≠ future)
- You need a core loop that's valuable *before* money is involved
- Reasoning transparency (WHY a bot wins) is what separates this from gambling

**What the criticism gets WRONG for YOUR context:**
- "Kill betting entirely" is bad hackathon advice — judges for Track 3 (Agentic Economy) *want* to see economic rails
- "Just build Up/Down prediction" undersells 0G integration and won't win $45k
- The marketplace idea isn't dead — it just needs to be **leasing/rev-share**, not permanent sale

---

**The pivot I'd recommend:**

Instead of "buy a bot forever," flip it to:

> **Creators earn ongoing rev-share** every time someone bets on their bot

Now:
- Creator stays incentivized to keep improving the bot
- No "rugged by stale strategy" problem
- Platform takes a cut of every bet → sustainable revenue
- Good bots compound reputation + earnings over seasons

This kills every flaw the critic raised, *and* it's a stronger Web3 story because it's **programmable revenue sharing on-chain**.

---

**The sharpened one-liner for judges:**

> *"PredictArena is a competitive AI agent league where creators earn on-chain revenue share every time someone bets on their bot's price range predictions — aligning incentives between builders, bettors, and the platform."*

That's not a casino. That's an **agentic economy with aligned incentives** — exactly Track 3.

---

**Revised MVP scope (still solo-buildable):**

| Layer | What it is | Keep? |
|---|---|---|
| Bot creation | Prompt-based strategy, stored on 0G Storage | ✅ Yes |
| Prediction arena | BTC price range, 1 round at a time | ✅ Yes |
| Betting on bots | Users stake on which bot wins the round | ✅ Yes (core) |
| Rev-share for creators | Smart contract auto-splits bet fees to bot owner | ✅ Yes (replaces NFT sale) |
| Reasoning trace | Bot shows WHY it predicted that range | ✅ Add this — it's the differentiator |
| Bot leaderboard | Win rate, accuracy, earnings | ✅ Yes |
| Bot Marketplace (NFT sale) | Permanent purchase | ❌ Cut |
| Seasons / evolution | Meta-game layers | ❌ Post-hackathon |

---

The reasoning trace is the key insight from the critique. When your bot makes a prediction, **0G Compute returns not just the range, but the reasoning** — and you store that on 0G Storage. Bettors can read it before placing their bet. Now it's informed speculation, not blind gambling. That's the differentiator no competitor has.

---

Want to lock this as the final concept and move into architecture? I can lay out the smart contracts, the 0G integration points, and the folder structure so you can start coding today.



## Prompt:
4/24/2026, 2:18:24 PM

help me research, are there similar project?



## Response:
4/24/2026, 2:19:00 PM

````plaintext
Web Search: AI agent prediction battle arena crypto Web3 2024 2025
````

> **AI Agents to Dominate 2025: Bold Predictions from Web3 Leaders - Brave New Coin** [bravenewcoin.com](https://bravenewcoin.com/insights/ai-agents-to-dominate-2025-bold-predictions-from-web3-leaders)
>
> **2025 will be the year of AI agents, Web3 execs say** [cointelegraph.com](https://cointelegraph.com/news/2025-ai-agent-growth-web3-execs-say)
>
> **Onchain AI Agents Will Be Web3 Entrepreneurs' Best Friend** [onchain.org](https://onchain.org/research/web3-predictions-for-2025/chapter/2/)
>
> **Is a $5 trillion AI-driven agent economy crypto’s next big frontier? Hong Kong Web3 Festival experts point to McKinsey data | | CryptoRank.io** [cryptorank.io](https://cryptorank.io/news/feed/f1745-ai-agent-crypto-next-frontier-web3-mckinsey)
>
> **Neuron price today, NRN to USD live price, marketcap and chart | CoinMarketCap** [coinmarketcap.com](https://coinmarketcap.com/currencies/ai-arena/)
>
> **The Rise of AI Agents: Shaping the Future of Web3 in 2025** [cryptoninjas.net](https://www.cryptoninjas.net/news/the-rise-of-ai-agents-shaping-the-future-of-web3/)
>
> **2025 Will Be the Year That AI Agents Transform Crypto** [coindesk.com](https://www.coindesk.com/opinion/2024/12/24/2025-will-be-the-year-that-ai-agents-transform-crypto)
>
> **Crypto AI Agent Tokens: A Comprehensive 2024–2025 Overview | by balaji bal | Medium** [medium.com](https://medium.com/@balajibal/crypto-ai-agent-tokens-a-comprehensive-2024-2025-overview-d60c631698a0)
>
> **AI in Web3: Key Headlines and 2025 Outlook | by SubQuery Network | Medium** [medium.com](https://subquery.medium.com/ai-in-web3-key-headlines-and-2025-outlook-bd88f622d937)
>
> **Top AI Agent Crypto Coins Set to Explode in 2026 - 101 Blockchains** [101blockchains.com](https://101blockchains.com/top-ai-agent-crypto-coins/)
>
````plaintext
Web Search: AI Arena NRN agent battle crypto prediction leaderboard
````

> **Neuron price today, NRN to USD live price, marketcap and chart | CoinMarketCap** [coinmarketcap.com](https://coinmarketcap.com/currencies/ai-arena/)
>
> **AI Arena Crypto Game | Play & Earn AI Arena | GAMES.GG** [games.gg](https://games.gg/ai-arena/)
>
> **Arena Leaderboard | Compare & Benchmark the Best Frontier AI Models** [arena.ai](https://arena.ai/leaderboard)
>
> **Neuron Price | NRN Price Today, Live Chart, USD converter, Market Capitalization | CryptoRank.io** [cryptorank.io](https://cryptorank.io/price/ai-arena)
>
> **Arena AI: The Official AI Ranking & LLM Leaderboard** [arena.ai](https://arena.ai/)
>
> **AI Model Leaderboard Arena: The $1.7B Startup Defining AI’s Ultimate Judges | artificial intelligence Technology | CryptoRank.io** [cryptorank.io](https://cryptorank.io/news/feed/638ec-ai-model-leaderboard-arena-judges)
>
> **Economy Overview** [aiarena.io](https://docs.aiarena.io/economic-system/201-economy-design)
>
> **Trading Arena - AI-Powered Trading Competition** [llm-stats.com](https://llm-stats.com/arenas/trading-arena)
>
> **GitHub - pvp-AI/arena: AI Combat Arena - Train autonomous AI agents and compete in blockchain-verified battles. Prediction markets, ranked PvP, and training data generation. · GitHub** [github.com](https://github.com/pvp-AI/arena)
>
> **Alpha Arena | AI Trading Benchmark** [nof1.ai](https://nof1.ai/leaderboard)
>
````plaintext
Web Search: crypto price prediction bot competition betting on agents Web3 platform 2025
````

> **Prediction Markets Are Turning Into a Bot Playground** [financemagnates.com](https://www.financemagnates.com/trending/prediction-markets-are-turning-into-a-bot-playground/)
>
> **MASTERBOT Price Prediction 2025–2030: Can BOT Be the Next AI Crypto Giant?** [bitrue.com](https://www.bitrue.com/blog/masterbot-price-prediction-2025-2030)
>
> **MasterBOT Price Analysis 2025: BOT Outlook & Risks** [phemex.com](https://phemex.com/blogs/masterbot-bot-price-prediction-2025-2030)
>
> **What Are the Top 5 Decentralized Prediction Markets of 2026?(Full Guide)** [bingx.com](https://bingx.com/en/learn/article/what-are-the-top-decentralized-prediction-markets)
>
> **Best Crypto Prediction Markets in 2025 | Trust Wallet** [trustwallet.com](https://trustwallet.com/blog/web3/best-crypto-prediction-markets-in-2025)
>
> **List of 12 Web3 prediction markets (2026) | Alchemy** [alchemy.com](https://www.alchemy.com/dapps/best/web3-prediction-markets)
>
> **Web3 Prediction Markets in 2026: The Rise of Information Finance | by Crypto Threads | Jan, 2026 | Medium** [medium.com](https://cryptothreads25.medium.com/web3-prediction-markets-in-2026-the-rise-of-information-finance-deab90b9b184)
>
> **Prediction Markets in Crypto: The Ultimate Guide to Decentralized Forecasting 2026** [dappradar.com](https://dappradar.com/blog/prediction-markets-crypto-guide)
>
> **Top 10 Crypto Prediction Marketplaces in 2026 | BlockchainX** [blockchainx.tech](https://www.blockchainx.tech/top-crypto-prediction-marketplaces/)
>
````plaintext
Web Search: llm-stats trading arena AI models compete price prediction leaderboard
````

> **Trading Arena - AI-Powered Trading Competition** [llm-stats.com](https://llm-stats.com/arenas/trading-arena)
>
> **AI Leaderboard 2026 - Compare Top AI Models & Rankings** [llm-stats.com](https://llm-stats.com)
>
> **LLM Leaderboard 2026 — Compare Top AI Models - Vellum** [vellum.ai](https://www.vellum.ai/llm-leaderboard)
>
> **Finance Arena - LLM Leaderboard** [financearena.ai](https://www.financearena.ai/)
>
> **LLM Leaderboard - Comparison of over 100 AI models from OpenAI, Google, DeepSeek & others** [artificialanalysis.ai](https://artificialanalysis.ai/leaderboards/models)
>
> **LLM Leaderboard 2026 | Best AI Models, Benchmarks & Pricing** [lmmarketcap.com](https://lmmarketcap.com/)
>
> **LLM Leaderboard 2026 - Compare Rankings and Best LLMs** [llm-stats.com](https://llm-stats.com/leaderboards/llm-leaderboard)
>
> **AI Trends 2026 – LLM Statistics & Industry Insights** [llm-stats.com](https://llm-stats.com/ai-trends)
>
> **Best LLM Leaderboard 2026 | AI Model Rankings, Benchmarks & Pricing | Onyx AI** [onyx.app](https://onyx.app/llm-leaderboard)
>
Good research done. Here's a clean competitive landscape map for you:

---

## 🗺️ Competitive Landscape: What Already Exists

### 1. **AI Arena (NRN)** — *Closest to your concept*
AI Arena is a platform fighter game where players design, train, and battle AI characters in a competitive PvP arena, striving to climb a global leaderboard. NRN (Neuron) is the in-game utility token that coordinates incentives — rewards are calculated and dispersed at the end of each weekly Round.

**How it differs from you:** Their bots fight in a *game* (combat). Your bots fight with *financial predictions*. Totally different domain and audience. Not a direct competitor.

---

### 2. **llm-stats.com Trading Arena** — *Conceptually similar, but Web2*
This platform shows AI models competing in real-time stock trading with a starting capital of $100,000, with a leaderboard, recent trades, and positions — but it's just a read-only spectator product.

**How it differs from you:** No user-created bots, no betting, no on-chain economy. Pure observation tool. You're building the *participatory + economic* version of this.

---

### 3. **MasterBOT** — *Closest economic model*
MasterBOT runs three AI strategies competing in daily obstacle challenges, and players bet on which AI model performs best in a prediction market, winning $BOT tokens.

**How it differs from you:** Their bots are *fixed system-created* AIs (Sprinter, Marathoner, Inventor). Yours lets *users create and customize* their own bots. That's the key differentiator — **user-generated agents**.

---

### 4. **Polymarket / Kalshi / Prediction Markets** — *Indirect competitor*
Autonomous AI systems now contribute over 30% of total prediction market volume, with tools letting AI agents scan news and execute trades without humans.

**How it differs from you:** These are markets for *humans* to bet on real events. Bots are just participants. You're building a market where **bots are the product** — the thing people bet *on*, not the bettor.

---

### 5. **pvp-AI/arena on GitHub** — *Early-stage open source clone*
pvpAI is a competitive turn-based combat game where you create, train, and battle AI-controlled agents using natural language rules — with Elo-based matchmaking, seasonal rewards, and battle replays.

**How it differs from you:** No blockchain, no financial predictions, no economic layer. It's a game, not a financial arena.

---

## ✅ The Verdict: Your Gap is Real

Here's what **doesn't exist yet**:

| Feature | Existing products |
|---|---|
| User-created AI bots | ❌ None in finance/prediction |
| Bots battle on crypto price ranges | ❌ Nobody |
| Bet on *which bot wins* (not the price) | ❌ Nobody |
| Bot reputation + on-chain rev-share for creators | ❌ Nobody |
| Built on decentralized infra (0G) | ❌ Nobody |

The closest thing — MasterBOT — uses fixed system bots. The gap between "system bots" and "user-created, prompt-tuned, reputation-tracked bots with creator economy" is your entire moat.

---

## 🎯 How to Use This in Your Pitch

Your one-liner against competitors:

> *"Polymarket lets humans bet on events. AI Arena lets bots fight in games. PredictArena is the missing piece — a competitive arena where user-built AI agents battle on crypto predictions, and creators earn on-chain revenue from every bet placed on their bot."*

Judges love seeing that you've done competitive research. Want me to help format this into a pitch slide or move into the technical architecture next?



## Prompt:
4/24/2026, 2:30:04 PM

how to describe our project direct and clearly?



## Response:
4/24/2026, 2:30:08 PM

Let me help you sharpen the description. First, quick question:

````plaintext
Tool: Generating ask_user_input_v0...
````





## Prompt:
4/24/2026, 2:30:17 PM

Q: Who is this description primarily for?
A: Judges & hackathon submission



## Response:
4/24/2026, 2:30:35 PM

Here are the descriptions at every level you'll need for the submission:

---

## 1. One-Sentence (30 words max — required by hackathon)

> **PredictArena is an on-chain AI agent league where users build prompt-based prediction bots, compete on BTC price ranges, and earn revenue when others bet on their bot.**

*(29 words ✅)*

---

## 2. Short Summary (what it does, problem it solves, 0G components — required by hackathon)

> PredictArena is a competitive AI agent economy built on 0G. Users create prediction bots by writing a strategy prompt, then deploy them into live arena rounds where bots forecast BTC price ranges. Other users bet on which bot predicts most accurately. Winning creators earn on-chain revenue share — automatically split by smart contract every round.
>
> The problem it solves: prediction markets today are either human-only (Polymarket) or use fixed system bots (MasterBOT). No platform lets users *build* their own AI agents, compete them publicly, and earn from their reputation — until now.
>
> 0G components used: bot strategy prompts are stored on **0G Storage**, inference (bot reasoning + prediction output) runs on **0G Compute**, bot identity is registered as an **Agentic ID (ERC-7857)** on 0G Chain, and the betting pool + revenue share is settled via smart contracts on **0G Chain**.

---

## 3. Elevator Pitch (for live demo day / verbal presentation)

> *"Imagine Fantasy Football — but instead of players, you draft AI agents. Instead of sports stats, they predict crypto prices. And instead of just bragging rights, the best bot creators earn real money every time someone bets on their agent.*
>
> *That's PredictArena. You write a strategy prompt — 500 words, no code required. Your bot goes into the arena, makes BTC price range predictions, and builds a public reputation. The better your bot performs, the more people bet on it, the more you earn — automatically, on-chain, every round.*
>
> *It runs entirely on 0G: decentralized inference for the AI, decentralized storage for strategies and reasoning traces, and 0G Chain for settlement. No centralized server. No black box."*

---

## 4. Track 3 Framing (for judging criteria alignment)

> PredictArena is an **Agent-as-a-Service economy** — the bot creator is the service provider, bettors are the consumers, and the platform is the rails. Revenue flows automatically through smart contracts with no intermediary. It demonstrates micropayments, reputation-based markets, and programmable revenue sharing — the three core pillars of Track 3.

---

Pick whichever fits where you need it. The one-sentence and short summary go directly into HackQuest. Want me to now help you write the README or the architecture diagram?



## Prompt:
4/24/2026, 2:37:29 PM

which track i fit  more with my project?



## Response:
4/24/2026, 2:37:43 PM

Based on your project, here's an honest breakdown:

---

## Your Project vs Every Track

**Track 3: Agentic Economy & Autonomous Applications** — *Your primary home*

This is the strongest fit. Your project hits all three of Track 3's key directions directly:

- **AI Commerce & Social** → Bot marketplace, Agent-as-a-Service, reputation economy
- **Financial Rails** → On-chain revenue share, betting pool, automated fee splitting
- **Operational Tools** → Bot identity via Agentic ID, self-settling smart contracts

The track literally says *"Agent-as-a-Service platforms"* — that's your exact model.

---

**Track 1: Agentic Infrastructure & OpenClaw Lab** — *Strong secondary fit*

Your project also qualifies here because you're building agent frameworks with prompt constraints, using 0G Compute for inference, and 0G Storage for state/memory. If Track 3 feels crowded, this is your backup. But your economic layer is stronger than your infrastructure layer, so Track 3 is still primary.

---

**Track 2: Verifiable Finance** — *Weak fit*

This track wants TEE-based execution and sealed inference for trading privacy. Your bots are transparent by design (reasoning traces are public). Don't go here.

**Track 4: Web 4.0 Open Innovation** — *Wrong fit*

Designed for SocialFi, Gaming, DePIN teams that need decentralized storage at scale. Not your angle.

**Track 5: Privacy & Sovereign Infrastructure** — *Wrong fit*

You're building openness and transparency, not privacy rails.

---

## My Recommendation

**Submit to Track 3. Mention Track 1 overlap in your README.**

In your documentation, frame it like this:

> *"PredictArena is a Track 3 submission building the economic layer of the agentic economy — but it also contributes Track 1 infrastructure through its agent constraint system, 0G Compute inference pipeline, and 0G Storage state persistence layer."*

That way judges from both tracks notice your project, but you have a clear home. Double-track awareness often gets you extra attention during preliminary review.



## Prompt:
4/24/2026, 2:46:25 PM

how we will wrap this idea to implementation? how the UI would be? how the bot will battle?



## Response:
4/24/2026, 2:49:05 PM

Great questions. Let me break this down into 3 parts: the full user flow, the UI, and the battle mechanics.

---

````plaintext
Tool: read_me
````

Here's the full breakdown — user flow first, then the UI mockup, then the battle mechanics visualized.

---

## The Full User Flow

````plaintext
Tool: show_widget
````

---

## The UI — Page by Page

Here's what each screen looks like:

````plaintext
Tool: show_widget
````

---

## How the Battle Actually Works (Mechanics)

````plaintext
Tool: show_widget
````

---

Here's the summary of everything above:

**The flow in plain language:**
1. Creator writes a prompt strategy → deployed as a bot with an on-chain identity (Agentic ID)
2. Each round, 0G Compute runs the bot's LLM inference → outputs a BTC price range + reasoning
3. Bettors read the reasoning, pick which bot they trust, place bets
4. Round closes → oracle fetches real BTC price → smart contract scores every bot
5. Pool splits: winning bettors get paid, bot creator gets rev-share, platform takes a fee
6. Bot's reputation score updates on 0G Storage KV layer → repeat

**The scoring is the key differentiator:** tighter correct ranges score higher than wide correct ranges. This forces bot creators to actually think, not just guess $90k–$120k and always be "right." It rewards precision and strategy.

Ready to move into smart contract architecture or the folder structure next?



## Prompt:
4/24/2026, 3:03:27 PM

next questions:

1.  what is the bot looks like? it is like openclaw? or what?
2. what is the benefit from creating bot?



## Response:
4/24/2026, 3:04:50 PM

Great questions — let me answer both clearly.

---

## 1. What does the bot actually look like?

Your bot is **not** like OpenClaw (which is a full agent orchestration framework with tools, memory, and multi-step task execution). Your bot is much simpler and more constrained — intentionally.

Think of it like this:

````plaintext
Tool: show_widget
````

---

## 2. What's the benefit of creating a bot?

````plaintext
Tool: show_widget
````

---

**To summarize both answers directly:**

Your bot is just a **smart system prompt** — 500 words max, describing a prediction strategy. The platform injects live BTC data, sends it to 0G Compute, and the LLM outputs a range + reasoning. All bots use the same base model, so the competition is purely about **who writes the smarter strategy**. No code needed to create a bot. No tools, no memory, no complexity. Just thinking.

The benefit of creating a bot is **passive on-chain income that compounds with reputation**. You write the prompt once. Every round it runs automatically. Every bet placed on your bot earns you a rev-share cut — without you doing anything. The better your bot performs over time, the more people bet on it, the more you earn. Your bot becomes a **productive on-chain asset**.

Want to move to the smart contract architecture or start building now?



## Prompt:
4/24/2026, 8:05:48 PM

that means llm already provided at 0G? we just need to send prompt to their api? or what



## Response:
4/24/2026, 8:06:14 PM

Great question. Let me check the actual 0G Compute docs to give you an accurate answer.

````plaintext
Web Fetch: Failed to fetch: https://build.0g.ai/compute
````

````plaintext
Web Search: 0G compute network LLM inference API how to use 2025
````

> **Inference | 0G Documentation** [0g.ai](https://docs.0g.ai/developer-hub/building-on-0g/compute-network/inference)
>
> **Inference SDK - 0G Documentation - 0g AI** [0g.ai](https://docs.0g.ai/developer-hub/building-on-0g/compute-network/sdk)
>
> **Inference Provider | 0G Documentation** [0g.ai](https://docs.0g.ai/build-with-0g/compute-network/provider)
>
> **Practical Guide to LLM Inference in Production (2025) | Hivenet** [hivenet.com](https://compute.hivenet.com/post/llm-inference-production-guide)
>
> **2025 Guide to Choosing an LLM Inference Provider | GMI Cloud** [gmicloud.ai](https://www.gmicloud.ai/blog/choosing-a-low-latency-llm-inference-provider-2025)
>
> **Deploy an LLM inference service on OpenShift AI | Red Hat Developer** [redhat.com](https://developers.redhat.com/articles/2025/11/03/deploy-llm-inference-service-openshift-ai)
>
> **GitHub - 0gfoundation/awesome-0g: A curated showcase of 0G community and ecosystem projects. · GitHub** [github.com](https://github.com/0gfoundation/awesome-0g)
>
> **Inference.net | Full-Stack LLM Lifecycle Platform** [inference.net](https://inference.net/)
>
> **0G Introduces Sealed Inference: Cryptographically Private AI Where Every Response Is Verified Inside a Hardware Enclave** [globenewswire.com](https://www.globenewswire.com/news-release/2026/03/06/3250768/0/en/0G-Introduces-Sealed-Inference-Cryptographically-Private-AI-Where-Every-Response-Is-Verified-Inside-a-Hardware-Enclave.html)
>
> **LLM Inference Optimization: Cut Cost & Latency at Every Layer (2026) | Morph** [morphllm.com](https://www.morphllm.com/llm-inference-optimization)
>
Yes — and the docs confirm exactly how it works. Here's the clear answer:

---

## Yes, 0G already hosts LLMs. Here's exactly how you use them.

0G Compute Network provides decentralized AI inference services, supporting LLMs, text-to-image, and speech-to-text — accessible via Web UI, CLI, or SDK with **OpenAI compatibility**.

This means: **you don't host any model yourself.** You just call their API.

---

## Available models right now

Models available include Qwen3 VL 30B, and Qwen3.6-Plus — Alibaba's flagship LLM with hybrid attention and sparse MoE routing, optimized for agentic workflows and complex reasoning, with a 1M token context window. All testnet services feature TeeML verifiability.

For your project, **Qwen3.6-Plus or Qwen3 VL 30B** is the right pick — strong reasoning, great for structured outputs like price ranges.

---

## How you call it in code — it's just OpenAI SDK

You install `@0glabs/0g-serving-broker`, get service metadata (endpoint + model), generate auth headers, then call it exactly like OpenAI:

```typescript
// 1. Install
// pnpm add @0glabs/0g-serving-broker

// 2. Get endpoint + auth headers from 0G broker
const { endpoint, model } = await broker.inference.getServiceMetadata(providerAddress);
const headers = await broker.inference.getRequestHeaders(providerAddress, prompt);

// 3. Call exactly like OpenAI — nothing new to learn
const openai = new OpenAI({
  baseURL: endpoint,
  apiKey: "",           // empty string — 0G handles auth differently
  defaultHeaders: headers
});

const completion = await openai.chat.completions.create({
  messages: [
    { role: "system", content: botStrategyPrompt },  // ← your user's 500-word strategy
    { role: "user",   content: marketContextPrompt } // ← injected BTC data
  ],
  model: model,
});

const prediction = completion.choices[0].message.content;
```

---

## One important detail — headers are single-use

Headers are single-use — generate a fresh set for every request. Reusing headers will fail.

So in your arena, every time a bot runs per round, you generate fresh headers for that call. Simple to handle in your backend.

---

## Bonus: verifiable inference (huge for judges)

Every AI model response is cryptographically signed with the provider's enclave-born key before it reaches the user — proof that it was processed inside a real TEE, proof that no one tampered with execution, and proof that the response is authentic.

This means you can prove on-chain that **the bot's prediction was genuinely generated by the LLM** — not faked by your server. That's a massive trust and judging differentiator. You call one extra method:

```typescript
// Verify the response is genuine (TEE-signed)
const valid = await broker.inference.processResponse(
  providerAddress,
  content,
  chatID  // from ZG-Res-Key response header
);
```

---

## Summary — your integration flow

```
User writes prompt (500 words)
        ↓
Stored on 0G Storage
        ↓
Round starts → platform injects BTC market data
        ↓
Your backend: get headers → call 0G Compute (OpenAI SDK)
        ↓
Bot outputs: price range + reasoning
        ↓
Verify TEE signature (processResponse)
        ↓
Store output on 0G Storage → show to bettors
```

You're basically writing **one async function** that does this per bot per round. The hardest part is the broker setup and funding — the actual inference call is identical to calling OpenAI. Ready to move into the full smart contract + backend architecture?



## Prompt:
4/24/2026, 8:07:36 PM

i still not clear in the overall architect, tech stack, and how it works



## Response:
4/24/2026, 8:09:02 PM

Let me build you a full visual breakdown of everything.

````plaintext
Tool: read_me
````

Let me build this in layers — overview first, then each layer in detail.

````plaintext
Tool: show_widget
````

Now let's zoom into the most important flow — what happens when a round runs:

````plaintext
Tool: show_widget
````

And finally, the full tech stack at a glance:

````plaintext
Tool: show_widget
````







---
Powered by [Claude Exporter](https://www.ai-chat-exporter.net)