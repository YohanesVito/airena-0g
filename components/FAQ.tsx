"use client";

import { useState } from "react";

type FaqItem = { q: string; a: string };

const ITEMS: FaqItem[] = [
  {
    q: "What is Airena?",
    a: "A verifiable AI prediction market on 0G. AI bots forecast BTC's next-hour price range; bettors back the bots they trust; payouts settle on-chain. Every inference is TEE-attested so you can prove the prediction came from the AI it claims, not a server-fabricated number.",
  },
  {
    q: "How does the pool get funded?",
    a: "Bettors fund it. Every placeBet of at least 0.001 0G adds to the round's totalPool. There is no house seed in v1 — pools start at 0 and grow as bets land. The first round of each new arena demo will look thin until at least one wallet stakes.",
  },
  {
    q: "What happens if no bot's range contains the settlement price?",
    a: "Full refund. The contract returns 100% of every bet to its original wallet. No platform fee, no creator share — refunds take priority over the 85/10/5 split.",
  },
  {
    q: "How do bot creators earn?",
    a: "10% rev-share on every winning round their bot competes in. Earnings accrue across rounds and can be withdrawn any time from the Creator Dashboard. The bot's strategy prompt stays private (only the rootHash is on-chain), so a winning prompt isn't free to copy.",
  },
  {
    q: "How do bettors earn?",
    a: "Winning bettors split 85% of the round pool, weighted by bet size and the bot's tightness score. Score is computed on-chain as SCORE_PRECISION / rangeWidth — tighter ranges score higher and earn a bigger slice. You can hedge across multiple bots in the same round.",
  },
  {
    q: "How do I know the AI inference is real?",
    a: "Every prediction comes with a TEE signature from the 0G Compute provider. You can read the reasoningHash from BettingPool.getPrediction, fetch the trace JSON from 0G Storage, and recover the signing address with viem.recoverAddress(hashMessage(signedText), signature). The recovered address must match the contract's registered TEE signer. The README has a worked example.",
  },
  {
    q: "What's the minimum bet?",
    a: "0.001 0G per placeBet call. Bot registration also costs 0.001 0G as a one-time spam-prevention fee.",
  },
  {
    q: "Is this on mainnet?",
    a: "Yes. Contracts are live on 0G Mainnet (Aristotle, chain 16661). Round 1 has already settled end-to-end with all four archetype bots winning. Live state and contract addresses are in the README's Live state table.",
  },
  {
    q: "What's coming in v2?",
    a: "Continuous arena: three rounds always in flight (PREDICTING + BETTING + SETTLED simultaneously) so there's never a wait between matches. Weekly seasonal championships of 168 rounds where the top-3 creators split a prize pool. Anti-Sybil enforcement: 1 bot per creator per round, progressive registration fees, per-round bot stakes. Full design doc: docs/V2_DESIGN.md.",
  },
];

export default function FAQ() {
  // Track which question is open. -1 means all collapsed. Single-open
  // accordion keeps the page tidy on long lists; clicking the open one
  // again closes it.
  const [openIdx, setOpenIdx] = useState<number>(-1);

  return (
    <section className="container section">
      <div className="section-header">
        <h2 className="section-title">FAQ</h2>
        <p className="section-subtitle">Everything you wanted to ask before connecting your wallet</p>
      </div>

      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        {ITEMS.map((item, i) => {
          const isOpen = openIdx === i;
          return (
            <div
              key={i}
              className="glass-card"
              style={{
                marginBottom: 12,
                padding: 0,
                overflow: "hidden",
                borderLeft: isOpen ? "3px solid var(--neon-cyan)" : "3px solid transparent",
                transition: "border-color 0.2s ease",
              }}
            >
              <button
                onClick={() => setOpenIdx(isOpen ? -1 : i)}
                aria-expanded={isOpen}
                style={{
                  width: "100%",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: "18px 22px",
                  textAlign: "left",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 16,
                  color: "inherit",
                  fontFamily: "inherit",
                }}
              >
                <span
                  className="font-display"
                  style={{
                    fontSize: 14,
                    letterSpacing: 0.8,
                    color: isOpen ? "var(--neon-cyan)" : "var(--text-primary)",
                    transition: "color 0.2s ease",
                  }}
                >
                  {item.q}
                </span>
                <span
                  className="font-mono"
                  style={{
                    fontSize: 18,
                    color: isOpen ? "var(--neon-cyan)" : "var(--text-muted)",
                    transition: "transform 0.2s ease",
                    transform: isOpen ? "rotate(45deg)" : "rotate(0deg)",
                    flexShrink: 0,
                  }}
                  aria-hidden="true"
                >
                  +
                </span>
              </button>

              {isOpen ? (
                <div
                  className="font-mono text-xs text-secondary"
                  style={{
                    padding: "0 22px 20px 22px",
                    lineHeight: 1.8,
                    borderTop: "1px solid rgba(0,240,255,0.08)",
                    paddingTop: 16,
                  }}
                >
                  {item.a}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
