"use client";

import { useBotCount, useBotsRange, shortenAddress } from "@/hooks/useContracts";

export default function LeaderboardClient() {
  const { data: botCount } = useBotCount();
  const count = Number(botCount || 0);
  const { data: bots, isLoading } = useBotsRange(1, Math.min(count, 50));

  const sortedBots = bots
    ? [...(bots as any[])].sort((a, b) => {
        const aWR = Number(a.totalRounds) > 0 ? Number(a.wins) / Number(a.totalRounds) : 0;
        const bWR = Number(b.totalRounds) > 0 ? Number(b.wins) / Number(b.totalRounds) : 0;
        if (bWR !== aWR) return bWR - aWR;
        return Number(b.totalScore) - Number(a.totalScore);
      })
    : [];

  return (
    <main className="container section">
      <h1 className="section-title mb-2">Leaderboard</h1>
      <p className="section-subtitle font-mono">
        Top performing AI prediction bots ranked by win rate{count > 0 ? ` · ${count} total bots` : ""}
      </p>

      <div className="glass-card table-container">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Bot</th>
              <th>Creator</th>
              <th>Win Rate</th>
              <th title="Average BTC range width across winning rounds — smaller is tighter, better bots">
                Avg Range
              </th>
              <th>Rounds</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} style={{ textAlign: "center", padding: 48 }}><span className="font-mono text-muted">Loading...</span></td></tr>
            ) : sortedBots.length > 0 ? (
              sortedBots.map((bot, idx) => {
                const rounds = Number(bot.totalRounds);
                const wins = Number(bot.wins);
                const totalScore = Number(bot.totalScore);
                const winRate = rounds > 0 ? ((wins / rounds) * 100).toFixed(1) : "—";
                // Translate raw on-chain score to a USD range width that
                // viewers can actually interpret. Score formula in
                // BettingPool.sol: score = SCORE_PRECISION / rangeCents
                // (SCORE_PRECISION=1e12, rangeCents in USD-cents). Inverting
                // and converting to dollars: rangeUsd = 1e10 / avgScore.
                // wins (not rounds) is the divisor because totalScore only
                // accumulates on rounds the bot won. Same translation as
                // CreatorClient — keep them in sync.
                const avgRangeUsd =
                  wins > 0 && totalScore > 0
                    ? Math.round(1e10 / (totalScore / wins))
                    : null;
                const colors = ["var(--neon-cyan)", "var(--neon-pink)", "var(--neon-green)"];
                return (
                  <tr key={bot.id.toString()}>
                    <td><span className="font-display" style={{ color: idx < 3 ? colors[idx] : "var(--text-muted)" }}>{idx + 1}</span></td>
                    <td><span className="font-display" style={{ fontSize: 13, letterSpacing: 0.5 }}>{bot.name}</span></td>
                    <td><span className="font-mono text-muted" style={{ fontSize: 11 }}>{shortenAddress(bot.creator)}</span></td>
                    <td><span style={{ color: rounds === 0 ? "var(--text-muted)" : wins / rounds >= 0.5 ? "var(--neon-green)" : "var(--neon-pink)" }}>{winRate}{rounds > 0 ? "%" : ""}</span></td>
                    <td>
                      {avgRangeUsd !== null ? (
                        <span className="font-mono">${avgRangeUsd.toLocaleString("en-US")}</span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td>{rounds}</td>
                    <td><span className={`badge ${bot.active ? "badge-green" : ""}`} style={{ fontSize: 10 }}>{bot.active ? "Active" : "Inactive"}</span></td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: 56 }}>
                  <p className="font-display text-sm text-muted" style={{ letterSpacing: 1 }}>NO BOTS REGISTERED</p>
                  <p className="font-mono text-xs text-muted mt-2">Be the first to create a prediction bot</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex gap-6 mt-4 justify-center">
        <span className="font-mono text-xs"><span className="text-green">●</span> Active</span>
        <span className="font-mono text-xs"><span className="text-muted">●</span> Inactive</span>
        <span className="font-mono text-xs text-muted">Scores update after each round settlement</span>
      </div>
    </main>
  );
}
