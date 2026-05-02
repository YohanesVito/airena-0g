"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useState, useRef, useMemo } from "react";
import {
  useRoundCount,
  useRound,
  useRoundBots,
  useRoundPredictions,
} from "@/hooks/useContracts";

const LiveStats = dynamic(() => import("@/components/LiveStats").then(m => ({ default: m.LiveStats })), { ssr: false });
const BtcChart = dynamic(() => import("@/components/BtcChart"), { ssr: false });

const BOT_COLORS = ["#00F0FF", "#FF2D78", "#39FF14", "#B44DFF", "#FF6B2B"];

type PreviewPrediction = {
  botId: number;
  name: string;
  priceLow: number;
  priceHigh: number;
  color: string;
  won?: boolean;
};

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

  // Static demo predictions used as a fallback before any real round has been
  // created on-chain. Once a round exists we replace these with the latest
  // bots' actual predictions read from BettingPool.
  const demoPredictions: PreviewPrediction[] = [
    { botId: 1, name: "MomentumBot", priceLow: 94200, priceHigh: 94800, color: BOT_COLORS[0] },
    { botId: 2, name: "SentinelAI", priceLow: 94000, priceHigh: 95200, color: BOT_COLORS[1] },
    { botId: 3, name: "NeuralEdge", priceLow: 94400, priceHigh: 94600, color: BOT_COLORS[2] },
  ];

  // Read the latest round from chain. We surface its bots' actual
  // predictions so the landing page advertises real activity instead of
  // hardcoded placeholders.
  const { data: roundCountRaw } = useRoundCount();
  const currentRoundId = Number((roundCountRaw as bigint | undefined) ?? 0n);
  const { data: roundRaw } = useRound(currentRoundId);
  const { data: roundBotIdsRaw } = useRoundBots(currentRoundId);
  const roundBotIds = (roundBotIdsRaw as bigint[] | undefined) ?? [];
  const { data: predictionData } = useRoundPredictions(currentRoundId, roundBotIds);

  const roundStatus = roundRaw
    ? Number((roundRaw as { status: number | bigint }).status)
    : -1; // -1 = not loaded / no round yet

  const livePredictions = useMemo<PreviewPrediction[]>(() => {
    if (!predictionData || roundBotIds.length === 0) return [];
    const out: PreviewPrediction[] = [];
    for (let i = 0; i < roundBotIds.length; i++) {
      const pred = predictionData[i * 2]?.result as
        | { botId: bigint; priceLow: bigint; priceHigh: bigint; score: bigint }
        | undefined;
      const bot = predictionData[i * 2 + 1]?.result as
        | { id: bigint; name: string }
        | undefined;
      // pred.botId === 0n means the bot hasn't submitted a prediction yet.
      if (!pred || !bot || pred.botId === 0n) continue;
      out.push({
        botId: Number(bot.id),
        name: bot.name,
        priceLow: Number(pred.priceLow) / 100,
        priceHigh: Number(pred.priceHigh) / 100,
        color: BOT_COLORS[i % BOT_COLORS.length],
        won: roundStatus === 3 ? Number(pred.score) > 0 : undefined,
      });
    }
    return out;
  }, [predictionData, roundBotIds, roundStatus]);

  const showingLive = livePredictions.length > 0;
  const previewPredictions = showingLive ? livePredictions : demoPredictions;

  const previewSubtitle = showingLive
    ? roundStatus === 1
      ? `Round #${currentRoundId} — AI bots are generating predictions on 0G Compute…`
      : roundStatus === 2
        ? `Round #${currentRoundId} — open for betting · ${livePredictions.length} bots competing`
        : roundStatus === 3
          ? `Round #${currentRoundId} settled — see how each bot's range scored`
          : `Round #${currentRoundId} — ${livePredictions.length} bots in the arena`
    : "Watch AI bots compete with real-time BTC price predictions";

  // Pick the badge text + color class for each bot card in the preview grid.
  // Demo data always reads PREDICTING; live data reflects round state.
  const badgeFor = (won: boolean | undefined) => {
    if (!showingLive) return { text: "PREDICTING", className: "badge-cyan" };
    if (roundStatus === 1) return { text: "PREDICTING", className: "badge-cyan" };
    if (roundStatus === 2) return { text: "BETTING", className: "badge-pink" };
    if (roundStatus === 3) {
      return won
        ? { text: "WON", className: "badge-green" }
        : { text: "OUT OF RANGE", className: "" };
    }
    return { text: "PREDICTING", className: "badge-cyan" };
  };

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

      {/* Live Arena Preview */}
      <section className="container section">
        <div className="section-header">
          <h2 className="section-title">Live Battle Preview</h2>
          <p className="section-subtitle">{previewSubtitle}</p>
        </div>
        <BtcChart predictions={previewPredictions} height={350} />
        <div className="arena-preview-bots">
          {previewPredictions.map((bot) => {
            const badge = badgeFor(bot.won);
            return (
              <div key={bot.botId} className="arena-preview-bot glass-card">
                <div className="preview-bot-indicator" style={{ background: bot.color }} />
                <div className="preview-bot-info">
                  <span className="preview-bot-name">{bot.name}</span>
                  <span className="preview-bot-range font-mono">
                    ${bot.priceLow.toLocaleString()} – ${bot.priceHigh.toLocaleString()}
                  </span>
                </div>
                <div className="preview-bot-status">
                  <span className={`badge ${badge.className}`} style={{ fontSize: 9, padding: "3px 8px" }}>
                    {badge.text}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

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
