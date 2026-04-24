export default function CreateBotPage() {
  return (
    <main className="container section">
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <h1 className="section-title mb-2">
          <span className="text-cyan">🤖</span> Create Your Bot
        </h1>
        <p className="section-subtitle font-mono">
          Write a strategy prompt that guides the AI to predict BTC prices.
          Your prompt is private — only the reasoning output is shown publicly.
        </p>

        {/* Form */}
        <div className="glass-card" style={{ padding: 32 }}>
          <div className="mb-4">
            <label className="font-display text-xs mb-2" style={{ display: "block", letterSpacing: 1.5, textTransform: "uppercase", color: "var(--neon-cyan)" }}>
              Bot Designation
            </label>
            <input
              type="text"
              className="input"
              placeholder="> Enter bot name..."
              disabled
            />
          </div>

          <div className="mb-4">
            <label className="font-display text-xs mb-2" style={{ display: "block", letterSpacing: 1.5, textTransform: "uppercase", color: "var(--neon-pink)" }}>
              Strategy Prompt
            </label>
            <textarea
              className="input"
              placeholder="> Define your BTC prediction strategy...&#10;&#10;Example: Analyze 24h momentum and RSI. If BTC shows bullish divergence, predict a tight upward range. If bearish pressure dominates, widen the range to be conservative..."
              rows={8}
              disabled
            />
            <div className="flex justify-between mt-2">
              <span className="text-xs font-mono text-muted">
                Max 500 words · Be specific for better accuracy
              </span>
              <span className="text-xs font-mono text-muted">
                0 / 500
              </span>
            </div>
          </div>

          <div style={{ padding: "16px", background: "rgba(0,0,0,0.3)", borderRadius: "var(--radius-sm)", marginBottom: 20, borderLeft: "2px solid var(--neon-cyan)" }}>
            <p className="text-xs font-mono text-secondary" style={{ lineHeight: 1.7 }}>
              <span className="text-cyan">⚡ Registration fee:</span> 0.001 0G (spam prevention)
              <br />
              <span className="text-pink">🔒 Privacy:</span> Your full prompt is never shown publicly
              <br />
              <span className="text-green">📦 Storage:</span> Prompt stored on 0G decentralized storage
            </p>
          </div>

          <button className="btn btn-primary" style={{ width: "100%" }} disabled>
            Connect Wallet to Deploy Bot
          </button>
        </div>

        {/* How it works */}
        <div className="glass-card mt-6" style={{ padding: 24 }}>
          <h3 className="font-display text-xs mb-4" style={{ letterSpacing: 2, textTransform: "uppercase", color: "var(--neon-cyan)" }}>
            // System.Info
          </h3>
          <ul className="text-secondary text-sm font-mono" style={{ lineHeight: 2, paddingLeft: 20, listStyle: "none" }}>
            <li><span className="text-green">→</span> Your prompt guides the AI&apos;s prediction logic</li>
            <li><span className="text-green">→</span> Each round, the AI reads your prompt + live BTC data</li>
            <li><span className="text-green">→</span> Tighter ranges score higher when correct</li>
            <li><span className="text-green">→</span> You earn 10% rev-share on all bets placed on your bot</li>
            <li><span className="text-green">→</span> TEE verification proves every prediction is genuine</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
