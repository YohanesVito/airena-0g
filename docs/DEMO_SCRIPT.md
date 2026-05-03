# Demo Video Script — 0G APAC Hackathon Submission

Designed against the [hackathon submission requirements](../hackathon-req.txt) §4 (Demo Video)
and the judging criteria. Three-minute hard cap. Must show core functionality,
the user flow, and how 0G is actually used (Track 2 emphasis: TEE-based execution
and Sealed Inference).

**Voiceover budget:** ~450 words at 150 wpm. Each scene below lists what to show
on screen, what to say, and the elapsed time so you can pace the recording.

---

## Pre-record setup (do once, 10 min)

- [ ] Run through [`docs/WALKTHROUGH.md`](WALKTHROUGH.md) end-to-end. Fix anything red.
- [ ] Connect the **admin wallet** in one browser profile, a **regular wallet** in another.
- [ ] Pre-stage the round: round 1 (settled, all 4 bots WON) is already perfect — use it.
      Don't try to record a live predict cycle (2–5 min + Storage sync delays).
- [ ] Open these tabs in advance:
  1. https://airena-0g.vercel.app/  (landing)
  2. https://airena-0g.vercel.app/arena  (round 1 settled view)
  3. https://airena-0g.vercel.app/creator  (admin wallet connected)
  4. A terminal window with the three TEE-verification commands ready to paste
     (from [README:316-336](../README.md#L316-L336))
- [ ] Close DevTools, hide bookmarks bar, set browser zoom to 100%.
- [ ] Use 1920×1080 recording. Loom or QuickTime both fine.
- [ ] Mic check: read the first scene aloud once before pressing record.

---

## Scene 1 — Hook  (0:00 → 0:15)

**On screen:** Landing page hero. Stay still on the `LIVE ON 0G MAINNET` badge
and the "Build AI Agents. Battle on Predictions. Earn on Reputation." headline.

**Voiceover:**

> Today's AI trading bot platforms ask you to trust a black-box server.
> Airena makes every layer independently verifiable on 0G mainnet — TEE-attested
> inference, prompts on storage, payouts on-chain.

*(36 words, ~15s)*

---

## Scene 2 — What it is + the economics  (0:15 → 0:40)

**On screen:** Scroll smoothly through Tokenomics & Economics — pause on the
85% / 10% / 5% cards — then Two Ways to Play.

**Voiceover:**

> AI bots compete to predict BTC's next-hour price range. Bettors back the bots
> they trust. Tighter range scores higher; winners split the pool eighty-five
> percent to bettors, ten percent to bot creators, five percent to the platform.
> If no bot's range hits the settlement price, every bet is refunded — no fees.

*(58 words, ~24s)*

---

## Scene 3 — The verifiability story (Track 2 anchor)  (0:40 → 1:30)

This is the most important scene. Track 2 explicitly calls out
"Sealed Inference and TEE-based execution" as the key innovation.

**On screen — sub-shots:**

1. Cut to `/arena`. Round 1, settled. Hover the **Judge AI panel's**
   `VERIFIED · 0G TEE 0xd45b…6617d4` badge — let the tooltip render
   (signer / chatID / signature preview).
2. Move down to one of the bot cards (ZeroBound or smoke-bot — both WON).
   Hover its TEE badge inline with the prediction range.
3. Cut to terminal. Paste and run, in sequence:
   ```bash
   POOL=0xaE5d26e8bDFe3bfeEd4C9A27c2394Dbb2F70Fd73
   RPC=https://evmrpc.0g.ai
   cast call $POOL "getPrediction(uint256,uint256)((uint256,uint256,uint256,string,uint256,bool))" 1 3 --rpc-url $RPC
   curl http://localhost:3000/api/storage/trace/<reasoningHash> | jq .trace.tee
   # then in browser console: viem.recoverAddress(hashMessage(signedText), signature)
   ```

**Voiceover:**

> Every prediction here ran inside a 0G Compute TEE — Intel TDX via DStack. The
> signing address is registered on-chain. Pick any prediction. Read its
> reasoningHash from BettingPool. Pull the trace from 0G Storage. Recover the
> signature with viem. The recovered address must match the contract's TEE
> signer. No privileged access required — every bet is backed by cryptography
> a judge can verify themselves. Three 0G components, all wired into the same
> verifiability claim: Compute attests, Storage commits, Chain settles.

*(108 words, ~48s)*

---

## Scene 4 — User flow  (1:30 → 2:25)

**On screen — sub-shots:**

1. **Create a bot** (~10s) — cut to `/create`. Don't actually deploy. Pan over the
   form: name field, strategy prompt, the "Privacy: full prompt never shown"
   info row. Cursor lands on the `Deploy Bot` button.
2. **Place a bet** (~15s) — switch back to `/arena`. Hover one bot card. Type a
   stake in the input — call out the **`→ 0.012 0G` projection** that appears
   live next to the pool size. Click the BET button if you have spare 0G;
   otherwise just leave the input populated.
3. **Settle + claim** (~10s) — narrate over the same arena view; show the
   `WON` badges and `Pool share: X%` lines on the winning bots.
4. **Creator dashboard** (~15s) — cut to `/creator`. Show the four stat cards
   (Active Bots / Rounds / Win Rate / Wins), the green Earnings card,
   the My Bots table with the **Avg Range column in dollars**, and scroll to
   the Bet History table.

**Voiceover:**

> The flow: write a strategy prompt, pay one-thousandth of a 0G to register.
> Your prompt is stored on 0G Storage — only the rootHash is on-chain, so your
> strategy stays private. When a round opens, the Judge AI proposes volatility
> zones, every active bot submits a range, and the BET button shows in real
> time how your stake grows the pool. When the round settles, the contract
> scores each bot on-chain — tighter range, bigger slice. Bot creators see
> their ten-percent rev-share accrue across rounds and withdraw whenever from
> the dashboard. Every bet you've ever placed is in your bet history.

*(115 words, ~50s)*

---

## Scene 5 — V2 vision  (2:25 → 2:50)

**On screen:** Scroll the landing page back up to the **Roadmap** section.
Pause on the V2 column.

**Voiceover:**

> v1 ships verifiability. v2 turns it into a continuous arena: three rounds
> always in flight, weekly seasonal championships of one hundred sixty-eight
> rounds each, top-three creators split a prize pool. Anti-Sybil enforcement,
> permissionless settlement. The full design doc is in the repo.

*(50 words, ~22s)*

---

## Scene 6 — Close  (2:50 → 3:00)

**On screen:** Landing hero or the AIRENA logo standalone. Hold for 3 seconds.

**Voiceover:**

> Airena. Track 2: Agentic Trading Arena. Live on 0G mainnet today.

*(13 words, ~6s)*

---

## Total

- **Voiceover:** 380 words → ~152s of speech
- **Visual buffer:** ~28s of scrolling/cuts/holds without speech
- **Sum:** ~180s, hard at 3:00

If you run long, cut from Scene 5 first (V2 vision). Verifiability (Scene 3)
and User Flow (Scene 4) are the load-bearing scenes for judging.

---

## Submission checklist (per hackathon-req.txt §1–7)

- [ ] §1 Project name + 30-word description + 0G components used
      (already in [README.md](../README.md) header)
- [ ] §2 Public GitHub repo with substantial commits during hackathon period
- [ ] §3 Mainnet contract addresses + Explorer links
      ([README.md:67-74](../README.md#L67))
- [ ] §4 Demo video ≤ 3 minutes, public link (YouTube or Loom)
- [ ] §5 README with overview, architecture, 0G modules, deploy steps,
      reviewer notes — all already in [README.md](../README.md)
- [ ] §6 Public X post (template below)
- [ ] §7 Optional bonus: pitch deck, frontend demo link, write-up

---

## X post template

Submit at least one public post on X before the May 16 deadline.

> Just shipped Airena to 0G mainnet — a verifiable AI prediction market where
> AI bots compete to forecast BTC's next-hour range, every inference is
> TEE-attested, and payouts settle on-chain.
>
> Built for Track 2: Agentic Trading Arena.
>
> Live: https://airena-0g.vercel.app
> Demo: <YouTube/Loom link>
>
> #0GHackathon #BuildOn0G
> @0G_labs @0g_CN @0g_Eco @HackQuest_

Attach: a screenshot of either the arena page (showing the `VERIFIED · 0G TEE`
badge) or the dashboard (showing the rev-share earnings + bet history).

A short clip of the BET button live-projection (`→ X 0G`) also works well
as media.

---

## Optional: 60-second cut for social

If you want a tighter version for X / LinkedIn that's not the full submission:

1. **0:00–0:10** — Hook + landing pan
2. **0:10–0:30** — TEE badge → terminal verification (compressed)
3. **0:30–0:50** — Bet flow + dashboard rev-share
4. **0:50–0:60** — Close + URL

Same scenes, cut Scene 2 (tokenomics) and Scene 5 (v2 vision) entirely.
