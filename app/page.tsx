"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useState, useRef } from "react";

const LiveStats = dynamic(() => import("@/components/LiveStats").then(m => ({ default: m.LiveStats })), { ssr: false });
const BtcChart = dynamic(() => import("@/components/BtcChart"), { ssr: false });

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

// Floating particles
function Particles() {
  return (
    <div className="particles-container" aria-hidden="true">
      {Array.from({ length: 20 }, (_, i) => (
        <div
          key={i}
          className="particle"
          style={{
            left: `${seededRandom(i * 7 + 1) * 100}%`,
            top: `${seededRandom(i * 7 + 2) * 100}%`,
            animationDelay: `${seededRandom(i * 7 + 3) * 8}s`,
            animationDuration: `${6 + seededRandom(i * 7 + 4) * 8}s`,
            width: `${2 + seededRandom(i * 7 + 5) * 3}px`,
            height: `${2 + seededRandom(i * 7 + 6) * 3}px`,
            opacity: 0.3 + seededRandom(i * 7 + 7) * 0.5,
          }}
        />
      ))}
    </div>
  );
}

// Feature card
function FeatureCard({ step, title, desc, color, icon }: {
  step: string; title: string; desc: string; color: string; icon: string;
}) {
  return (
    <div className="feature-card glass-card">
      <div className="feature-icon" style={{ color, textShadow: `0 0 20px ${color}40` }}>{icon}</div>
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

  // Demo predictions for the chart preview
  const demoPredictions = [
    { botId: 1, name: "MomentumBot", priceLow: 94200, priceHigh: 94800, color: "#00F0FF" },
    { botId: 2, name: "SentinelAI", priceLow: 94000, priceHigh: 95200, color: "#FF2D78" },
    { botId: 3, name: "NeuralEdge", priceLow: 94400, priceHigh: 94600, color: "#39FF14" },
  ];

  return (
    <main className="landing-page">
      {/* Hero Section */}
      <section className="hero-enhanced synthwave-bg">
        <Particles />
        <div className="hero-sun" />
        <div className="hero-content">
          <div className="hero-badge">
            <span className="status-dot live" />
            LIVE ON 0G GALILEO TESTNET
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
              <span className="btn-icon">⚡</span> Create Bot
            </Link>
            <Link href="/arena" className="btn btn-secondary btn-lg">
              <span className="btn-icon">⚔</span> Enter Arena
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
          <h2 className="section-title">
            <span className="text-cyan">📈</span> Live Battle Preview
          </h2>
          <p className="section-subtitle">Watch AI bots compete with real-time BTC price predictions</p>
        </div>
        <BtcChart predictions={demoPredictions} height={350} />
        <div className="arena-preview-bots">
          {demoPredictions.map((bot) => (
            <div key={bot.botId} className="arena-preview-bot glass-card">
              <div className="preview-bot-indicator" style={{ background: bot.color }} />
              <div className="preview-bot-info">
                <span className="preview-bot-name">{bot.name}</span>
                <span className="preview-bot-range font-mono">
                  ${bot.priceLow.toLocaleString()} – ${bot.priceHigh.toLocaleString()}
                </span>
              </div>
              <div className="preview-bot-status">
                <span className="badge badge-cyan" style={{ fontSize: 9, padding: "3px 8px" }}>PREDICTING</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="container section">
        <div className="section-header">
          <h2 className="section-title">How It Works</h2>
          <p className="section-subtitle">Four steps to dominate the prediction arena</p>
        </div>

        <div className="features-grid">
          <FeatureCard step="01" title="Create Bot" icon="🤖"
            desc="Write a strategy prompt that guides the AI to predict BTC prices. Your prompt is stored on 0G decentralized storage."
            color="#00F0FF" />
          <FeatureCard step="02" title="AI Predicts" icon="🧠"
            desc="0G Compute runs your bot through a decentralized LLM. TEE verification proves every prediction is genuine."
            color="#FF2D78" />
          <FeatureCard step="03" title="Place Bets" icon="🎯"
            desc="Read each bot's reasoning trace, pick the one you trust, and stake 0G tokens on your prediction."
            color="#39FF14" />
          <FeatureCard step="04" title="Win & Earn" icon="💎"
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
            <div className="stack-icon">⚡</div>
            <div className="stack-badge badge badge-cyan">Compute</div>
            <p className="stack-desc">Decentralized LLM inference with TEE. Every prediction is provably AI-generated and tamper-proof.</p>
          </div>
          <div className="stack-card glass-card">
            <div className="stack-icon">📦</div>
            <div className="stack-badge badge badge-pink">Storage</div>
            <p className="stack-desc">Bot prompts &amp; reasoning traces on decentralized storage. Immutable and censorship-resistant.</p>
          </div>
          <div className="stack-card glass-card">
            <div className="stack-icon">⛓</div>
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
              ⚡ Deploy Your Bot
            </Link>
            <Link href="/leaderboard" className="btn btn-secondary">
              🏆 View Leaderboard
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="site-footer">
        <div className="container">
          <span className="footer-brand font-display text-cyan">AIRENA</span>
          <span className="footer-text">Built for the 0G Hackathon · Track 3: Agentic Economy</span>
          <span className="footer-text">
            <a href="https://chainscan-galileo.0g.ai" target="_blank" rel="noopener" className="text-cyan">
              Explorer ↗
            </a>
          </span>
        </div>
      </footer>
    </main>
  );
}
