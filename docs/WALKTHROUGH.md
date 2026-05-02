# Pre-Demo Browser Walkthrough

A step-by-step verification of the live deploy at https://airena-0g.vercel.app before
recording the submission demo. Run through everything below, mark issues, fix or
note them, then record. **~10–15 minutes total.**

---

## 0. Pre-flight

- [ ] Wallet that has **MetaMask + Rabby** installed and unlocked.
- [ ] Wallet has at least **0.05 0G** on chain `16661` (mainnet) for any tx you
      plan to demo. If only verifying read-only paths, balance doesn't matter.
- [ ] Browser **DevTools Console open** (`Cmd+Opt+J`) for the entire walkthrough —
      hydration mismatches and uncaught wagmi errors are easy to miss otherwise.
- [ ] Hard refresh on every page (`Cmd+Shift+R`) so you don't catch a stale chunk
      from a previous deploy.
- [ ] Two windows: one with the **admin wallet** (`0x4Fb0CB55EcFDd9CDA56f88531A38157d2D83d70f`),
      one with a **regular wallet** for the bettor view. The dashboard and claim
      button reveal different UI per wallet.

---

## 1. Landing — `/`

Open https://airena-0g.vercel.app/ with **no wallet connected first**.

**Above the fold**

- [ ] Browser tab shows the bot-vs-bot favicon (cyan + pink with yellow lightning).
- [ ] Tab title reads `Airena — AI Agent Prediction Battle Arena`.
- [ ] Navbar: AIRENA wordmark + bot icon on the left, links `Arena · Build · Dashboard · Leaderboard`, Connect Wallet on the right.
- [ ] Hero badge: **LIVE ON 0G MAINNET** (green dot). If it still says GALILEO TESTNET, the deploy didn't pick up the latest commit — investigate.
- [ ] Hero buttons: `Create Bot` (cyan, primary) and `Enter Arena` (pink outline). No emojis on either.

**LiveStats strip** (just below hero)

- [ ] Counts animate up from 0. Should land on **non-zero values for active bots and rounds** (round 1 is settled, 4 bots active). If it shows 0/0, the wagmi reads aren't reaching mainnet — check `NEXT_PUBLIC_*` env vars.

**Live Battle Preview**

- [ ] Subtitle reads `Round #1 settled — see how each bot's range scored` (NOT the placeholder "Watch AI bots compete with real-time…").
- [ ] BTC chart renders without the "data must be asc ordered by time" assertion (was failing before commit `575bef3`).
- [ ] Three preview-bot cards show **real bot names** (smoke-bot / MomentumMax / etc.), real prediction ranges, and **WON** badges (green) — not the demo MomentumBot/SentinelAI/NeuralEdge fallback.

**How It Works** — four feature cards (Create / AI Predicts / Place Bets / Win & Earn). All four titles + descriptions visible, no emoji icons.

**Tokenomics & Economics**

- [ ] Three cards: 85% Bettors (green) / 10% Bot Creators (pink) / 5% Platform (cyan).
- [ ] Below them, the "How the pool gets funded" callout panel is visible with three columns (Bets fund the pool / No winner = full refund / Score = tightness).

**Two Ways to Play**

- [ ] Two side-by-side cards: `Path 01 — Build a Bot` (cyan border-left) and `Path 02 — Back a Bot` (pink border-left).
- [ ] Each card has DO / EARN / COMPETE-or-PROTECT / COST bullet rows and a CTA button.

**Powered by 0G** — three stack cards (Compute / Storage / Chain), no icon emojis.

**Roadmap**

- [ ] Three columns: SHIPPED · V1 (green) / NEXT · POLISH (cyan) / V2 · POST-HACKATHON (pink).
- [ ] Each lists 5 bullets.

**FAQ**

- [ ] Click each of the 9 questions one at a time. The cyan `+` rotates to `×` (45deg), the answer expands, and **only one is open at a time** (clicking another collapses the previous).
- [ ] Click the open one again — it collapses (no flash).

**CTA + footer**

- [ ] CTA buttons: `Deploy Your Bot` and `View Leaderboard`.
- [ ] Footer: AIRENA wordmark, `Built for the 0G Hackathon · Track 2: Agentic Trading Arena · Verifiable Finance`, Explorer link.
- [ ] **Footer Explorer link goes to `https://chainscan.0g.ai`** (mainnet), NOT `chainscan-galileo` (testnet).

**Console check**

- [ ] No red errors. A `Hydration mismatch` warning means a deterministic-render bug — note the line and fix.

---

## 2. Arena — `/arena`

Same window, no wallet still connected.

- [ ] Header reads `Arena` (no swords emoji).
- [ ] Round #1 banner shows status `SETTLED` and the settlement BTC price.
- [ ] Judge AI panel renders three zone cards. The right side shows a **VERIFIED · 0G TEE 0xd45b…6617d4** badge (green). Hover reveals the tooltip.
- [ ] Four bot battle cards render: smoke-bot / MomentumMax / ZeroBound / WideNet. Each shows:
  - [ ] `WON` or `LOST` badge in the top right (all four were WON for round 1).
  - [ ] Predicted range (priceLow → priceHigh).
  - [ ] `Pool share: X%` line for winners (green).
  - [ ] **VERIFIED · 0G TEE** badge near the prediction range.
- [ ] **Claim button is NOT visible** since this wallet placed no bets — verifies commit `b58bea6` (eligibility gate).

**Now connect the admin wallet** (`0x4Fb0…d70f`) via the navbar Connect button.

- [ ] Wallet address shows in the navbar.
- [ ] **Admin row appears** on the arena page with three buttons: `1. New Round`, `2. Run Predictions`, `3. Settle`.
  - All three should be **disabled** since round 1 is settled.
- [ ] Claim card visibility — depends on whether the admin wallet placed bets:
  - If yes: button reads `Claim Winnings` or shows `Already Claimed` + `Claim recorded on-chain · this round is closed for 0x4Fb0…d70f`.
  - If no: card is hidden entirely.

**Console**

- [ ] No errors. The earlier `Assertion failed: data must be asc ordered by time` should NOT reappear.

---

## 3. Dashboard — `/creator`

- [ ] **Disconnected state**: "CONNECT WALLET TO VIEW DASHBOARD" message + RainbowKit Connect button. No emojis.

Connect the admin wallet.

- [ ] Subtitle: `0x4Fb0…d70f · 4 bots registered`.
- [ ] Stats grid: `4 / 4 / 100% / 4` (Active / Rounds Fought / Avg Win Rate / Wins Total).
- [ ] **Claimable Earnings**: green number ending in `0G` (rounded to 4 decimals — should look like `0.0001 0G`, NOT `0.00009999999999999998 0G`).
- [ ] Withdraw button reads `Withdraw 0.0001 0G` (or the current amount). Disabled if balance is 0.
- [ ] **My Bots table** rows: `#1 smoke-bot / #2 MomentumMax / #3 ZeroBound / #4 WideNet` (or whatever's actually on chain). Status, Rounds, Wins, Win Rate columns populated.
- [ ] **Avg Range column shows USD values** like `$300`, `$2,400`, `$200`, `$1,500` — NOT raw 8-digit scores like `33,333,333`. Hover the column header for the tooltip.
- [ ] Storage column shows `0x` prefix + first 10 hex chars + `…`.

**Bet History section** (below My Bots)

- [ ] Heading: `Bet History — last N rounds` (where N = min(roundCount, 10)).
- [ ] If admin wallet placed any bets: stats grid (count / total staked / claimed) + table with round/bot/stake/claim badge.
- [ ] If admin wallet placed NO bets: "NO BETS PLACED" empty state.

**Disconnect the wallet** (RainbowKit menu → Disconnect):

- [ ] UI reverts to the disconnected state cleanly. No flash of stale data.

---

## 4. Build — `/create`

- [ ] Disconnected: form is interactive but the bottom shows the Connect Wallet prompt instead of a submit button.
- [ ] Connect wallet. Submit button now reads `Deploy Bot`.
- [ ] Type a 1-character name. Word counter at bottom should read `1 / 500 words`.
- [ ] Try submitting with empty prompt — button stays disabled.
- [ ] Type 510+ words in the prompt — counter turns pink and the button stays disabled.
- [ ] **DO NOT actually deploy a bot** unless you have spare 0G and want to. Registration costs 0.001 0G and adds permanent on-chain state.

---

## 5. Leaderboard — `/leaderboard`

- [ ] Header: `Leaderboard`.
- [ ] Table renders with 7 columns. Sorted by win rate desc, then total score.
- [ ] Top 3 rows show colored ranks (cyan / pink / green text).
- [ ] Status badges read `Active` / `Inactive` (no robot emoji in the empty state — though it shouldn't trigger since 4 bots exist).
- [ ] **Avg Range column shows USD values** like `$300` / `$200` (matching the Creator dashboard) — NOT raw 8-digit scores. Hover the column header for the tooltip.

---

## 6. Cross-cutting

**Mobile / responsive**

- [ ] DevTools → Toggle device mode → iPhone 14. Landing page should still flow (single column on smaller breakpoints). Navbar links may collapse.
- [ ] Arena bot cards stack into a single column. Battle preview chart resizes.

**OG / social card**

- [ ] Open https://www.opengraph.xyz/url/https%3A%2F%2Fairena-0g.vercel.app or paste the URL into Slack/Discord. Should render the AIRENA wordmark + battle bots image (1200×1200 PNG). If Slack shows the URL as a plain link, the OG image isn't reachable — verify `/og-image.png` returns 200.

**Wallet flows**

- [ ] Connect → disconnect → reconnect with a different wallet. Dashboard data should re-fetch for the new address (RainbowKit + wagmi handle this).
- [ ] Network switch: if your wallet is on a different chain, the navbar should prompt to switch to chain 16661.

**Browser console at the end**

- [ ] No red errors anywhere across all five pages. Yellow warnings about React 18 strict-mode double-renders are fine; hydration mismatch warnings are not.

---

## 7. Demo recording shot list (3 min)

Once the walkthrough is clean, this is the order to record:

1. **0:00–0:20** — Landing page hero. Highlight the LIVE ON 0G MAINNET badge.
   Scroll briskly past the LiveStats and Live Battle Preview to show real round
   data with WON badges.
2. **0:20–0:40** — Tokenomics + Two Ways to Play. Pause on the 85/10/5 split.
3. **0:40–1:00** — FAQ. Open the "How does the pool get funded?" item and
   "How do I know the AI inference is real?" item. Read the answers aloud.
4. **1:00–1:50** — Arena round 1. Hover the Judge AI's `VERIFIED · 0G TEE` badge to
   show the tooltip. Pick one bot card, hover its TEE badge. Highlight WON status
   and pool share %. **This is the verifiability story** — give it the most time.
5. **1:50–2:30** — Manual TEE verification. In a side terminal, run the three
   commands from the README's Reviewer notes: `cast call getPrediction` →
   `curl /api/storage/trace/<hash>` → `viem.recoverAddress`. Show the recovered
   address matches `0xd45b…d4`.
6. **2:30–2:55** — Creator dashboard. Connect admin wallet. Show stats grid,
   earnings, my bots table with **Avg Range in dollars**, and bet history.
7. **2:55–3:00** — Cut to the README's Live state table or the V2 design doc
   to signal the post-hackathon plan. End on the AIRENA logo.

**Pre-stage tips:**

- Don't record live predict cycles — 0G Storage testnet sync delays can hit
  5–15 min ([README:439](../README.md#L439)). Use round 1 (already settled) as the demo round.
- Have the wallet pre-funded so MetaMask popups don't break the flow.
- Pre-open the terminal commands in a second window so step 5 is fast.

---

## 8. What NOT to do during the walkthrough

These spend real 0G or change permanent on-chain state:

- Don't click `Deploy Bot` on `/create` (costs 0.001 0G, registers forever).
- Don't click `BET` on a bot card (locks 0G into the round pool).
- Don't click any of the three admin actions (`New Round`, `Run Predictions`,
  `Settle`) unless you're deliberately demoing the full lifecycle. **Run
  Predictions takes 2–5 min and consumes 0G Compute credits.**
- Don't click `Withdraw` on the dashboard if you want the earnings to remain
  claimable for a video later.
- Don't push code or change env vars mid-walkthrough — Vercel will rebuild
  and your tabs may load mid-deploy.

---

## 9. After the walkthrough

If everything is green:

1. Record the demo (use the shot list above).
2. Update [README.md:404](../README.md#L404) row "Public Vercel deploy" — already checked off.
3. Submit to the 0G hackathon portal with: live URL, demo video, GitHub repo,
   and the contracts table from the README.

If something is broken: capture the console output + a screenshot, fix in code,
let Vercel redeploy, then re-run the affected section of the walkthrough only.
