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
- [ ] Pre-stage the round you'll record against. Two options:
      - **(A) Round 1, settled, all 4 bots WON** — original recommendation. Bots are
        deactivated now but round 1 records remain on-chain.
      - **(B) A fresh round with the new multi-creator bots (#5 TightScalper,
        #6 MeanReverter, #7 TrendRider — three distinct creator wallets).**
        Stronger Track 2 narrative; required if you record Scene 3.5. Run
        create + predict + bet + settle in advance — don't try to record a live
        predict cycle (2–5 min + Storage sync delays).
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
**stacked-bar visualization** of the 85 / 10 / 5 split (the green/pink/cyan bar
with `No winner: 100% refund` label on the right) — then Two Ways to Play.

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

1. Cut to `/arena`. Round 1, settled. Scroll past the chart to the
   **Competing Bots** grid. Hover **smoke-bot's** `OK VERIFIED · 0G TEE
   0xd45b…17d4` badge inline with the $75,550–$75,850 prediction range.
   Hold ~3s so the signer address is readable. ZeroBound is an equally good
   second-choice target (both WON, both TEE-attested).
2. Cut to terminal. Paste and run, in sequence — **all-in-one terminal,
   no browser DevTools needed**:
   ```bash
   # Step 1: read the on-chain prediction. The 4th tuple field is the
   # reasoningHash — a 0G Storage rootHash pointing at the TEE attestation.
   cast call 0xaE5d26e8bDFe3bfeEd4C9A27c2394Dbb2F70Fd73 \
     "getPrediction(uint256,uint256)((uint256,uint256,uint256,string,uint256,bool))" \
     1 3 --rpc-url https://evmrpc.0g.ai

   # Step 2: pull the trace off 0G Storage and extract the TEE envelope.
   curl -s "https://airena-0g.vercel.app/api/storage/trace/<paste reasoningHash from step 1>" \
     | jq .trace.tee

   # Step 3: independently recover the signer from the signature.
   # Expected output: "Validation succeeded. Address 0xd45b...17d4 signed this message."
   cast wallet verify --address <signer from step 2> \
     "<signedText from step 2>" "<signature from step 2>"
   ```

   **Pre-populated, paste-ready version for ZeroBound on Round 1** (so you can
   run it cold on camera without copy-pasting between commands):
   ```bash
   # Step 1
   cast call 0xaE5d26e8bDFe3bfeEd4C9A27c2394Dbb2F70Fd73 \
     "getPrediction(uint256,uint256)((uint256,uint256,uint256,string,uint256,bool))" \
     1 3 --rpc-url https://evmrpc.0g.ai

   # Step 2
   curl -s "https://airena-0g.vercel.app/api/storage/trace/0x6b1dcd1ad29796cb10abaf3fc3c505d59f7d4c533ab8974988db28fe70ede3f8" \
     | jq .trace.tee

   # Step 3
   cast wallet verify --address 0xd45b4301940b297f76d6e622c1cea2ae660617d4 \
     "66925278573836fa206c78f4a5d7ad66f841aee401cfd8ec65e4f42a9aa50a4b:876577a80ed7ba124190218518fb59ad80aaf8538946e743cede8c4c31eff6b8:centralized:aliyun:9e621febea357ff4460b91bf8b0b4bfe654d2e100edbc74770e76519d734830e" \
     "0x9f99a054ba7cf6a3de313ba626056e9276671a1fd76fcf405a9dfb7fbc3ee54159e90430d4818f470e48437bc1d1d6e7fdb0393425bc4490277a6d00f79a9f711b"
   ```
   The recovered address matches the bot card's `0G TEE 0xd45b…17d4` badge.
   That's the verifiability claim, end-to-end, in three commands.

> **Why no Judge AI panel sub-shot:** the Judge AI badge depends on an
> in-memory `judgeCache` in [app/api/rounds/route.ts:18-23](../app/api/rounds/route.ts#L18)
> that doesn't survive Vercel serverless cold starts. Round 1's entry is long
> gone — you'd need to re-stage a fresh round to repopulate it. Bot prediction
> TEE attestations come from on-chain `getPrediction()`, are always available,
> and tell the same verifiability story. Persisting `judgeCache` to 0G Storage
> is the production fix (TODO already flagged in the source comment).

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

## Scene 3.5 — Multi-creator proof  (1:30 → 1:36, silent B-roll)

**Skip this scene if recording Round 1.** Required if recording the new round.

**On screen — silent ~6s b-roll, NO new voiceover required:**

Open https://chainscan.0g.ai/address/0x2187D61279a8A54dc8907865959ef6cC8beBDa14
in a new tab (BotRegistry contract). Or open three address pages quickly in
sequence:

- TightScalper #5 → `0xb7192332B6DB95716ccc349Fe6a2757Cd086E34E`
- MeanReverter #6 → `0x1dFf96F9812C8316105f2F8Fc8f06De444Ca14c5`
- TrendRider   #7 → `0xaeBD4AE19fdf128FF811BB048A132dB401C5fB2a`

Highlight each `creator` field with a cursor zoom or text-underline overlay
to make the **three distinct addresses** obvious at a glance. No voiceover
during this beat — let the on-screen text do the work, or pair it with an
overlay caption: *"3 bots · 3 wallets · multi-creator on-chain"*.

**Optional voiceover (only if you want to record one extra TTS clip ~6s):**

> Three bots, three different wallets — Airena is multi-creator on-chain,
> not one team running scripts.

*(15 words, ~7s — optional. Without VO this scene is silent b-roll.)*

---

## Scene 4 — User flow  (1:36 → 2:31, was 1:30 → 2:25)

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

## Scene 5 — V2 vision  (2:31 → 2:53, was 2:25 → 2:50)

**On screen:** Scroll the landing page back up to the **Roadmap** section.
Pause on the V2 column.

**Voiceover:**

> v1 ships verifiability. v2 turns it into a continuous arena: three rounds
> always in flight, weekly seasonal championships of one hundred sixty-eight
> rounds each, top-three creators split a prize pool. Anti-Sybil enforcement,
> permissionless settlement. The full design doc is in the repo.

*(50 words, ~22s)*

---

## Scene 6 — Close  (2:53 → 3:00, was 2:50 → 3:00)

**On screen:** Landing hero or the AIRENA logo standalone. Hold for 3 seconds.

**Voiceover:**

> Airena. Track 2: Agentic Trading Arena. Live on 0G mainnet today.

*(13 words, ~6s)*

---

## Total

- **Voiceover:** 380 words → ~152s of speech
- **Visual buffer:** ~18s of cuts/holds (Scene 3 reduced from 3 sub-shots to 2;
  Scene 3.5 skipped on the Round 1 path)
- **Sum:** ~170s — comfortably under the 3:00 cap.

If recording the multi-creator path instead, add back ~6s for Scene 3.5 b-roll
and ~10s for the Judge AI hover (assuming the round was pre-staged so the
`judgeCache` is hot), then trim Scene 5 from 22s to ~16s to fit.

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
