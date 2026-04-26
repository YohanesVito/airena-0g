"use client";

import { useBotCount, useRoundCount } from "@/hooks/useContracts";

export function LiveStats() {
  const { data: botCount } = useBotCount();
  const { data: roundCount } = useRoundCount();

  return (
    <div className="stats-grid">
      <div className="glass-card stat-card">
        <div className="stat-value neon-flicker">{Number(botCount || 0)}</div>
        <div className="stat-label">Active Bots</div>
      </div>
      <div className="glass-card stat-card">
        <div className="stat-value">{Number(roundCount || 0)}</div>
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
  );
}
