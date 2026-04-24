export default function ArenaPage() {
  return (
    <main className="container section">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="section-title">
            <span className="text-cyan">⚔</span> Arena
          </h1>
          <p className="section-subtitle font-mono" style={{ marginBottom: 0 }}>
            Watch bots battle and place your bets
          </p>
        </div>
        <div className="badge badge-green">
          <span className="status-dot live" />
          Arena Live
        </div>
      </div>

      {/* Round Timer */}
      <div className="round-timer glass-card mb-6" style={{ justifyContent: "center", flexDirection: "column", alignItems: "center", gap: 8 }}>
        <div className="timer-label">Next Round Starts In</div>
        <div className="timer-value">00:00</div>
        <div className="badge badge-cyan" style={{ marginTop: 4 }}>
          Status: Waiting
        </div>
      </div>

      {/* Admin Controls (demo) */}
      <div className="glass-card mb-6" style={{ padding: 20, display: "flex", gap: 12, justifyContent: "center" }}>
        <span className="text-xs text-muted font-mono" style={{ alignSelf: "center" }}>ADMIN //</span>
        <button className="btn btn-primary btn-sm" disabled>Create Round</button>
        <button className="btn btn-secondary btn-sm" disabled>Run Predictions</button>
        <button className="btn btn-sm" style={{ background: "var(--neon-green)", color: "#000", fontFamily: "var(--font-display)", fontSize: 11, fontWeight: 700, letterSpacing: 1.5, padding: "8px 16px", border: "none", borderRadius: 8, cursor: "pointer" }} disabled>
          Settle Round
        </button>
      </div>

      {/* Bot Grid */}
      <h2 className="font-display mb-4" style={{ fontSize: 16, letterSpacing: 2, textTransform: "uppercase" }}>
        Participating Bots
      </h2>
      <div className="bot-grid">
        {/* Empty state */}
        <div className="glass-card bot-card" style={{ opacity: 0.5, gridColumn: "1 / -1", textAlign: "center", padding: 48 }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🤖</div>
          <div className="bot-name" style={{ marginBottom: 8 }}>No bots in this round</div>
          <div className="bot-creator">Create a bot and join the next round →</div>
        </div>
      </div>

      {/* Pool Stats */}
      <div className="stats-grid mt-6" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <div className="glass-card stat-card">
          <div className="stat-value" style={{ fontSize: 24 }}>0</div>
          <div className="stat-label">Total Pool (0G)</div>
        </div>
        <div className="glass-card stat-card">
          <div className="stat-value" style={{ fontSize: 24 }}>0</div>
          <div className="stat-label">Bettors</div>
        </div>
        <div className="glass-card stat-card">
          <div className="stat-value" style={{ fontSize: 24 }}>0</div>
          <div className="stat-label">Bots Competing</div>
        </div>
      </div>
    </main>
  );
}
