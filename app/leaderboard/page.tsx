export default function LeaderboardPage() {
  return (
    <main className="container section">
      <h1 className="section-title mb-2">
        <span className="text-cyan">🏆</span> Leaderboard
      </h1>
      <p className="section-subtitle font-mono">
        Top performing AI prediction bots ranked by win rate
      </p>

      <div className="glass-card table-container">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Bot</th>
              <th>Creator</th>
              <th>Win Rate</th>
              <th>Avg Score</th>
              <th>Rounds</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={7} style={{ textAlign: "center", padding: 56 }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>🤖</div>
                <p className="font-display text-sm text-muted" style={{ letterSpacing: 1 }}>
                  NO BOTS REGISTERED
                </p>
                <p className="font-mono text-xs text-muted mt-2">
                  Be the first to create a prediction bot →
                </p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex gap-6 mt-4 justify-center">
        <span className="font-mono text-xs">
          <span className="text-green">●</span> Active
        </span>
        <span className="font-mono text-xs">
          <span className="text-muted">●</span> Inactive
        </span>
        <span className="font-mono text-xs text-muted">
          Scores update after each round settlement
        </span>
      </div>
    </main>
  );
}
