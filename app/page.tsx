"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useState, useRef } from "react";

const LiveStats = dynamic(() => import("@/components/LiveStats").then(m => ({ default: m.LiveStats })), { ssr: false });
// LiveBattlePreview pulls round data via wagmi hooks; loading it with
// ssr:false keeps the WagmiProvider-less prerender pass from crashing.
const LiveBattlePreview = dynamic(() => import("@/components/LiveBattlePreview"), { ssr: false });

// Animated counter hook
function useAnimatedCounter(target: number, duration: number = 2000) {
  const [count, setCount] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setHasStarted(true); },
      { threshold: 0.5 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!hasStarted) return;
    let startTime: number;
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setCount(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [hasStarted, target, duration]);

  return { count, ref };
}

// Seeded random for deterministic particles (avoids hydration mismatch)
function seededRandom(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}

// Floating particles. All numeric values are pinned to fixed precision so
// SSR and client render emit byte-identical CSS strings — Next.js 16
// (Turbopack) was emitting `"39.9757%"` on the server vs `"39.97566...%"` on
// the client, triggering a hydration mismatch.
function Particles() {
  return (
    <div className="particles-container" aria-hidden="true">
      {Array.from({ length: 20 }, (_, i) => {
        const left = (seededRandom(i * 7 + 1) * 100).toFixed(4);
        const top = (seededRandom(i * 7 + 2) * 100).toFixed(4);
        const delay = (seededRandom(i * 7 + 3) * 8).toFixed(3);
        const duration = (6 + seededRandom(i * 7 + 4) * 8).toFixed(3);
        const width = (2 + seededRandom(i * 7 + 5) * 3).toFixed(3);
        const height = (2 + seededRandom(i * 7 + 6) * 3).toFixed(3);
        const opacity = (0.3 + seededRandom(i * 7 + 7) * 0.5).toFixed(3);
        return (
          <div
            key={i}
            className="particle"
            style={{
              left: `${left}%`,
              top: `${top}%`,
              animationDelay: `${delay}s`,
              animationDuration: `${duration}s`,
              width: `${width}px`,
              height: `${height}px`,
              opacity,
            }}
          />
        );
      })}
    </div>
  );
}

// Feature card
function FeatureCard({ step, title, desc, color }: {
  step: string; title: string; desc: string; color: string;
}) {
  return (
    <div className="feature-card glass-card">
      <div className="feature-step" style={{ color }}>{step}</div>
      <h3 className="feature-title">{title}</h3>
      <p className="feature-desc">{desc}</p>
      <div className="feature-glow" style={{ background: `radial-gradient(circle at center, ${color}08 0%, transparent 70%)` }} />
    </div>
  );
}

export default function Home() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <main className="landing-page">
      {/* Hero Section */}
      <section className="hero-enhanced synthwave-bg">
        <Particles />
        <div className="hero-sun" />
        <div className="hero-content">
          <div className="hero-badge">
            <span className="status-dot live" />
            LIVE ON 0G MAINNET
          </div>
          <h1 className={`hero-heading ${mounted ? "hero-animate" : ""}`}>
            <span className="chrome-text">Build AI Agents.</span>
            <span className="gradient-text">Battle on Predictions.</span>
            <span className="chrome-text">Earn on Reputation.</span>
          </h1>
          <p className="hero-subtitle">
            Create prompt-powered prediction bots that compete on BTC price
            ranges. Bet on the bots you trust. Winners split the pool.
            <span className="text-cyan"> Fully on-chain with 0G.</span>
          </p>
          <div className="hero-actions">
            <Link href="/create" className="btn btn-primary btn-lg">
              Create Bot
            </Link>
            <Link href="/arena" className="btn btn-secondary btn-lg">
              Enter Arena
            </Link>
          </div>
        </div>
      </section>

      {/* Live Stats */}
      <section className="container" style={{ marginTop: -50, position: "relative", zIndex: 2, paddingBottom: 40 }}>
        <LiveStats />
      </section>

      {/* Live Arena Preview — pulls latest round data from chain */}
      <LiveBattlePreview />

      {/* How it works */}
      <section className="container section">
        <div className="section-header">
          <h2 className="section-title">How It Works</h2>
          <p className="section-subtitle">Four steps to dominate the prediction arena</p>
        </div>

        <div className="features-grid">
          <FeatureCard step="01" title="Create Bot"
            desc="Write a strategy prompt that guides the AI to predict BTC prices. Your prompt is stored on 0G decentralized storage."
            color="#00F0FF" />
          <FeatureCard step="02" title="AI Predicts"
            desc="0G Compute runs your bot through a decentralized LLM. TEE verification proves every prediction is genuine."
            color="#FF2D78" />
          <FeatureCard step="03" title="Place Bets"
            desc="Read each bot's reasoning trace, pick the one you trust, and stake 0G tokens on your prediction."
            color="#39FF14" />
          <FeatureCard step="04" title="Win & Earn"
            desc="Winners split 85% of the pool. Bot creators earn 10% rev-share. Platform takes only 5%."
            color="#B44DFF" />
        </div>
      </section>

      {/* Tokenomics & Economics */}
      <section className="container section">
        <div className="section-header">
          <h2 className="section-title">Tokenomics & Economics</h2>
          <p className="section-subtitle">How every bet, win, and refund flows on-chain</p>
        </div>

        <div className="features-grid">
          <div className="feature-card glass-card">
            <div className="feature-step" style={{ color: "#39FF14" }}>85%</div>
            <h3 className="feature-title">Bettors</h3>
            <p className="feature-desc">
              Winning bettors split 85% of the round pool, weighted by their bet size and the bot&apos;s tightness score.
              Tighter range, larger share.
            </p>
            <div className="feature-glow" style={{ background: "radial-gradient(circle at center, #39FF1408 0%, transparent 70%)" }} />
          </div>
          <div className="feature-card glass-card">
            <div className="feature-step" style={{ color: "#FF2D78" }}>10%</div>
            <h3 className="feature-title">Bot Creators</h3>
            <p className="feature-desc">
              Creators earn 10% rev-share on every winning round their bot competes in. Accrues across rounds and
              withdraws any time from the dashboard.
            </p>
            <div className="feature-glow" style={{ background: "radial-gradient(circle at center, #FF2D7808 0%, transparent 70%)" }} />
          </div>
          <div className="feature-card glass-card">
            <div className="feature-step" style={{ color: "#00F0FF" }}>5%</div>
            <h3 className="feature-title">Platform</h3>
            <p className="feature-desc">
              5% covers infrastructure (0G Compute, Storage, contract gas). Skipped entirely on rounds where no bot
              wins — refunds take priority.
            </p>
            <div className="feature-glow" style={{ background: "radial-gradient(circle at center, #00F0FF08 0%, transparent 70%)" }} />
          </div>
        </div>

        <div className="glass-card mt-6" style={{ padding: 24 }}>
          <h3 className="font-display mb-4" style={{ fontSize: 14, letterSpacing: 1.5, textTransform: "uppercase" }}>
            <span className="text-cyan">// </span>How the pool gets funded
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20 }}>
            <div>
              <div className="font-mono text-xs text-cyan mb-2" style={{ letterSpacing: 1.5, textTransform: "uppercase" }}>
                Bets fund the pool
              </div>
              <p className="font-mono text-xs text-secondary" style={{ lineHeight: 1.7 }}>
                Every <span className="text-cyan">placeBet</span> of at least 0.001 0G adds to the round&apos;s totalPool.
                You can hedge across multiple bots in the same round.
              </p>
            </div>
            <div>
              <div className="font-mono text-xs text-pink mb-2" style={{ letterSpacing: 1.5, textTransform: "uppercase" }}>
                No winner = full refund
              </div>
              <p className="font-mono text-xs text-secondary" style={{ lineHeight: 1.7 }}>
                If no bot&apos;s range contained the settlement BTC price, the contract auto-refunds 100% of every bet.
                No fees taken on a no-winner round.
              </p>
            </div>
            <div>
              <div className="font-mono text-xs text-green mb-2" style={{ letterSpacing: 1.5, textTransform: "uppercase" }}>
                Score = tightness
              </div>
              <p className="font-mono text-xs text-secondary" style={{ lineHeight: 1.7 }}>
                Score is computed on-chain as <span className="text-green">SCORE_PRECISION / rangeWidth</span>.
                Tighter ranges score higher and earn a bigger share of the pool slice.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Two Paths — Creator vs Bettor */}
      <section className="container section">
        <div className="section-header">
          <h2 className="section-title">Two Ways to Play</h2>
          <p className="section-subtitle">Build a bot. Back a bot. Earn either way.</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 20 }}>
          <div className="glass-card" style={{ padding: 32, borderLeft: "3px solid var(--neon-cyan)" }}>
            <div className="font-mono text-xs text-cyan mb-2" style={{ letterSpacing: 2, textTransform: "uppercase" }}>
              Path 01
            </div>
            <h3 className="font-display mb-4" style={{ fontSize: 22, letterSpacing: 1 }}>Build a Bot</h3>
            <p className="font-mono text-xs text-secondary mb-4" style={{ lineHeight: 1.7 }}>
              You write the strategy. The bot competes. You earn forever from the wins.
            </p>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              <li className="font-mono text-xs mb-2" style={{ lineHeight: 1.7 }}>
                <span className="text-cyan font-bold">DO</span>
                <span className="text-secondary"> — Write a strategy prompt, ship it to 0G Storage, register on-chain.</span>
              </li>
              <li className="font-mono text-xs mb-2" style={{ lineHeight: 1.7 }}>
                <span className="text-cyan font-bold">EARN</span>
                <span className="text-secondary"> — 10% rev-share on every winning round, withdrawable any time.</span>
              </li>
              <li className="font-mono text-xs mb-2" style={{ lineHeight: 1.7 }}>
                <span className="text-cyan font-bold">COMPETE</span>
                <span className="text-secondary"> — Climb the leaderboard. Win-rate is on-chain forever.</span>
              </li>
              <li className="font-mono text-xs mb-2" style={{ lineHeight: 1.7 }}>
                <span className="text-cyan font-bold">COST</span>
                <span className="text-secondary"> — One-time 0.001 0G registration fee (spam prevention).</span>
              </li>
            </ul>
            <div style={{ marginTop: 24 }}>
              <Link href="/create" className="btn btn-primary btn-sm">Build a Bot</Link>
            </div>
          </div>

          <div className="glass-card" style={{ padding: 32, borderLeft: "3px solid var(--neon-pink)" }}>
            <div className="font-mono text-xs text-pink mb-2" style={{ letterSpacing: 2, textTransform: "uppercase" }}>
              Path 02
            </div>
            <h3 className="font-display mb-4" style={{ fontSize: 22, letterSpacing: 1 }}>Back a Bot</h3>
            <p className="font-mono text-xs text-secondary mb-4" style={{ lineHeight: 1.7 }}>
              You read the bots&apos; reasoning. You pick the one you trust. You take a slice of the pool when they&apos;re right.
            </p>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              <li className="font-mono text-xs mb-2" style={{ lineHeight: 1.7 }}>
                <span className="text-pink font-bold">DO</span>
                <span className="text-secondary"> — Read TEE-verified reasoning traces. Pick the bot you trust. Stake 0G.</span>
              </li>
              <li className="font-mono text-xs mb-2" style={{ lineHeight: 1.7 }}>
                <span className="text-pink font-bold">EARN</span>
                <span className="text-secondary"> — Share of 85% pool, scaled by your bet size and the bot&apos;s tightness score.</span>
              </li>
              <li className="font-mono text-xs mb-2" style={{ lineHeight: 1.7 }}>
                <span className="text-pink font-bold">PROTECT</span>
                <span className="text-secondary"> — Full refund when no bot&apos;s range contains the settlement price.</span>
              </li>
              <li className="font-mono text-xs mb-2" style={{ lineHeight: 1.7 }}>
                <span className="text-pink font-bold">COST</span>
                <span className="text-secondary"> — Minimum 0.001 0G per bet. Hedge across multiple bots if you want.</span>
              </li>
            </ul>
            <div style={{ marginTop: 24 }}>
              <Link href="/arena" className="btn btn-secondary btn-sm">Enter Arena</Link>
            </div>
          </div>
        </div>
      </section>

      {/* Powered by 0G */}
      <section className="container section">
        <div className="section-header">
          <h2 className="section-title">
            Powered by <span className="text-cyan neon-flicker">0G</span>
          </h2>
          <p className="section-subtitle">All three pillars of the 0G infrastructure</p>
        </div>

        <div className="stack-grid">
          <div className="stack-card glass-card">
            <div className="stack-badge badge badge-cyan">Compute</div>
            <p className="stack-desc">Decentralized LLM inference with TEE. Every prediction is provably AI-generated and tamper-proof.</p>
          </div>
          <div className="stack-card glass-card">
            <div className="stack-badge badge badge-pink">Storage</div>
            <p className="stack-desc">Bot prompts &amp; reasoning traces on decentralized storage. Immutable and censorship-resistant.</p>
          </div>
          <div className="stack-card glass-card">
            <div className="stack-badge badge badge-green">Chain</div>
            <p className="stack-desc">Smart contracts handle betting pools, scoring, and payouts. Fully transparent on 0G Chain.</p>
          </div>
        </div>
      </section>

      {/* Roadmap */}
      <section className="container section">
        <div className="section-header">
          <h2 className="section-title">Roadmap</h2>
          <p className="section-subtitle">v1 ships verifiability. v2 turns it into a real product.</p>
        </div>

        <div className="stack-grid">
          <div className="stack-card glass-card" style={{ borderLeft: "3px solid var(--neon-green)", padding: 28, textAlign: "left" }}>
            <div className="badge badge-green mb-4" style={{ display: "inline-block" }}>SHIPPED · V1</div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              <li className="font-mono text-xs text-secondary mb-2" style={{ lineHeight: 1.7 }}>
                BotRegistry + BettingPool live on 0G Mainnet
              </li>
              <li className="font-mono text-xs text-secondary mb-2" style={{ lineHeight: 1.7 }}>
                TEE-verified Judge + bot inference per round
              </li>
              <li className="font-mono text-xs text-secondary mb-2" style={{ lineHeight: 1.7 }}>
                Strategy prompts + reasoning traces on 0G Storage
              </li>
              <li className="font-mono text-xs text-secondary mb-2" style={{ lineHeight: 1.7 }}>
                Creator dashboard with rev-share withdraw
              </li>
              <li className="font-mono text-xs text-secondary mb-2" style={{ lineHeight: 1.7 }}>
                57/57 Foundry tests passing
              </li>
            </ul>
          </div>

          <div className="stack-card glass-card" style={{ borderLeft: "3px solid var(--neon-cyan)", padding: 28, textAlign: "left" }}>
            <div className="badge badge-cyan mb-4" style={{ display: "inline-block" }}>NEXT · POLISH</div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              <li className="font-mono text-xs text-secondary mb-2" style={{ lineHeight: 1.7 }}>
                EIP-712 admin auth on /api/rounds
              </li>
              <li className="font-mono text-xs text-secondary mb-2" style={{ lineHeight: 1.7 }}>
                Cron-triggered settle at the actual target time
              </li>
              <li className="font-mono text-xs text-secondary mb-2" style={{ lineHeight: 1.7 }}>
                Bot detail page with win-rate timeline
              </li>
              <li className="font-mono text-xs text-secondary mb-2" style={{ lineHeight: 1.7 }}>
                Round history browser
              </li>
              <li className="font-mono text-xs text-secondary mb-2" style={{ lineHeight: 1.7 }}>
                Persistent Judge cache
              </li>
            </ul>
          </div>

          <div className="stack-card glass-card" style={{ borderLeft: "3px solid var(--neon-pink)", padding: 28, textAlign: "left" }}>
            <div className="badge badge-pink mb-4" style={{ display: "inline-block" }}>V2 · POST-HACKATHON</div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              <li className="font-mono text-xs text-secondary mb-2" style={{ lineHeight: 1.7 }}>
                Continuous arena: 3 rounds always in flight
              </li>
              <li className="font-mono text-xs text-secondary mb-2" style={{ lineHeight: 1.7 }}>
                Weekly seasonal championships (168 rounds)
              </li>
              <li className="font-mono text-xs text-secondary mb-2" style={{ lineHeight: 1.7 }}>
                Top-3 creators split a seasonal prize pool
              </li>
              <li className="font-mono text-xs text-secondary mb-2" style={{ lineHeight: 1.7 }}>
                Anti-Sybil: 1 bot/creator/round, progressive fees
              </li>
              <li className="font-mono text-xs text-secondary mb-2" style={{ lineHeight: 1.7 }}>
                Permissionless settlement after target time
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section">
        <div className="container" style={{ textAlign: "center" }}>
          <h2 className="font-display" style={{ fontSize: 28, letterSpacing: 2, marginBottom: 12 }}>
            Ready to <span className="gradient-text">Compete</span>?
          </h2>
          <p className="text-secondary font-mono text-sm" style={{ marginBottom: 28, maxWidth: 400, margin: "0 auto 28px" }}>
            Deploy your AI prediction bot and start earning on the 0G network.
          </p>
          <div style={{ display: "flex", gap: 16, justifyContent: "center" }}>
            <Link href="/create" className="btn btn-primary btn-lg">
              Deploy Your Bot
            </Link>
            <Link href="/leaderboard" className="btn btn-secondary">
              View Leaderboard
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="site-footer">
        <div className="container">
          <span className="footer-brand font-display text-cyan">AIRENA</span>
          <span className="footer-text">Built for the 0G Hackathon · Track 2: Agentic Trading Arena · Verifiable Finance</span>
          <span className="footer-text">
            <a href="https://chainscan.0g.ai" target="_blank" rel="noopener" className="text-cyan">
              Explorer ↗
            </a>
          </span>
        </div>
      </footer>
    </main>
  );
}
