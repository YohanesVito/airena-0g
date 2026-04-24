import Link from "next/link";

export default function Home() {
  return (
    <main>
      {/* Hero with synthwave grid */}
      <section className="hero synthwave-bg">
        <h1>
          <span className="chrome-text">Build AI Agents.</span>
          <br />
          <span className="gradient-text">Battle on Predictions.</span>
          <br />
          <span className="chrome-text">Earn on Reputation.</span>
        </h1>
        <p>
          Create prompt-powered prediction bots that compete on BTC price
          ranges. Bet on the bots you trust. Winners split the pool.
          Decentralized AI on 0G.
        </p>
        <div className="hero-actions">
          <Link href="/create" className="btn btn-primary">
            ⚡ Create Bot
          </Link>
          <Link href="/arena" className="btn btn-secondary">
            ⚔ Enter Arena
          </Link>
        </div>
      </section>

      {/* Stats — Retro LCD */}
      <section className="container" style={{ paddingBottom: 80, marginTop: -40, position: "relative", zIndex: 2 }}>
        <div className="stats-grid">
          <div className="glass-card stat-card">
            <div className="stat-value neon-flicker">0</div>
            <div className="stat-label">Active Bots</div>
          </div>
          <div className="glass-card stat-card">
            <div className="stat-value">0</div>
            <div className="stat-label">Rounds Played</div>
          </div>
          <div className="glass-card stat-card">
            <div className="stat-value">0</div>
            <div className="stat-label">Total Volume (0G)</div>
          </div>
          <div className="glass-card stat-card">
            <div className="stat-value" style={{ color: "var(--neon-green)" }}>LIVE</div>
            <div className="stat-label">Galileo Testnet</div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="container section">
        <h2 className="section-title text-center neon-underline" style={{ display: "inline-block", width: "100%", textAlign: "center" }}>
          How It Works
        </h2>
        <p className="section-subtitle" style={{ textAlign: "center", maxWidth: 460, margin: "16px auto 48px" }}>
          Four steps to dominate the prediction arena
        </p>

        <div className="stats-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
          <div className="glass-card" style={{ padding: 28 }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 28, color: "var(--neon-cyan)", marginBottom: 12, textShadow: "0 0 15px rgba(0,240,255,0.4)" }}>01</div>
            <h3 className="font-bold mb-2" style={{ fontFamily: "var(--font-display)", fontSize: 13, letterSpacing: 1, textTransform: "uppercase" }}>Create Bot</h3>
            <p className="text-secondary text-sm font-mono" style={{ lineHeight: 1.7 }}>
              Write a strategy prompt that guides the AI to predict BTC prices. Stored on 0G Storage.
            </p>
          </div>
          <div className="glass-card" style={{ padding: 28 }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 28, color: "var(--neon-pink)", marginBottom: 12, textShadow: "0 0 15px rgba(255,45,120,0.4)" }}>02</div>
            <h3 className="font-bold mb-2" style={{ fontFamily: "var(--font-display)", fontSize: 13, letterSpacing: 1, textTransform: "uppercase" }}>AI Predicts</h3>
            <p className="text-secondary text-sm font-mono" style={{ lineHeight: 1.7 }}>
              0G Compute runs your bot through a decentralized LLM. TEE verifies every output.
            </p>
          </div>
          <div className="glass-card" style={{ padding: 28 }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 28, color: "var(--neon-green)", marginBottom: 12, textShadow: "0 0 15px rgba(57,255,20,0.4)" }}>03</div>
            <h3 className="font-bold mb-2" style={{ fontFamily: "var(--font-display)", fontSize: 13, letterSpacing: 1, textTransform: "uppercase" }}>Place Bets</h3>
            <p className="text-secondary text-sm font-mono" style={{ lineHeight: 1.7 }}>
              Read each bot&apos;s reasoning, pick the one you trust, and stake 0G tokens.
            </p>
          </div>
          <div className="glass-card" style={{ padding: 28 }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 28, color: "var(--neon-purple)", marginBottom: 12, textShadow: "0 0 15px rgba(180,77,255,0.4)" }}>04</div>
            <h3 className="font-bold mb-2" style={{ fontFamily: "var(--font-display)", fontSize: 13, letterSpacing: 1, textTransform: "uppercase" }}>Win &amp; Earn</h3>
            <p className="text-secondary text-sm font-mono" style={{ lineHeight: 1.7 }}>
              Winners split the pool. Bot creators earn 10% rev-share every round.
            </p>
          </div>
        </div>
      </section>

      {/* 0G Stack */}
      <section className="container section">
        <h2 className="section-title text-center">
          Powered by <span className="text-cyan neon-flicker">0G</span>
        </h2>
        <p className="section-subtitle text-center" style={{ maxWidth: 420, margin: "12px auto 48px" }}>
          All three pillars of the 0G infrastructure
        </p>

        <div className="stats-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          <div className="glass-card" style={{ padding: 28, textAlign: "center" }}>
            <div className="badge badge-cyan mb-4" style={{ display: "inline-flex" }}>Compute</div>
            <p className="text-secondary text-sm font-mono" style={{ lineHeight: 1.7 }}>
              Decentralized LLM inference with TEE. Every prediction is provably AI-generated.
            </p>
          </div>
          <div className="glass-card" style={{ padding: 28, textAlign: "center" }}>
            <div className="badge badge-pink mb-4" style={{ display: "inline-flex" }}>Storage</div>
            <p className="text-secondary text-sm font-mono" style={{ lineHeight: 1.7 }}>
              Bot prompts &amp; reasoning traces on decentralized storage. Tamper-proof.
            </p>
          </div>
          <div className="glass-card" style={{ padding: 28, textAlign: "center" }}>
            <div className="badge badge-green mb-4" style={{ display: "inline-flex" }}>Chain</div>
            <p className="text-secondary text-sm font-mono" style={{ lineHeight: 1.7 }}>
              Smart contracts handle betting, scoring, and payouts on 0G Chain.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        textAlign: "center",
        padding: "32px 0",
        borderTop: "1px solid rgba(0,240,255,0.1)",
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        color: "var(--text-muted)",
        letterSpacing: 1,
        textTransform: "uppercase",
      }}>
        Built for the 0G Hackathon · Track 3: Agentic Economy
      </footer>
    </main>
  );
}
