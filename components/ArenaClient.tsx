"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { formatEther } from "viem";
import {
  useRoundCount,
  useRound,
  useRoundBots,
  useActiveBots,
  usePlaceBet,
  useClaimWinnings,
  formatRoundStatus,
  centsToUsd,
  shortenAddress,
} from "@/hooks/useContracts";
import { CONTRACTS, BOT_REGISTRY_ABI, BETTING_POOL_ABI } from "@/lib/contracts";
import { useReadContract } from "wagmi";

const botRegistryAddress = CONTRACTS.botRegistry as `0x${string}`;
const bettingPoolAddress = CONTRACTS.bettingPool as `0x${string}`;

function BotCard({
  botId,
  roundId,
  roundStatus,
}: {
  botId: number;
  roundId: number;
  roundStatus: number;
}) {
  const [betAmount, setBetAmount] = useState("0.01");

  const { data: bot } = useReadContract({
    address: botRegistryAddress,
    abi: BOT_REGISTRY_ABI,
    functionName: "getBot",
    args: [BigInt(botId)],
  });

  const { data: prediction } = useReadContract({
    address: bettingPoolAddress,
    abi: BETTING_POOL_ABI,
    functionName: "getPrediction",
    args: [BigInt(roundId), BigInt(botId)],
    query: { enabled: roundId > 0 },
  });

  const { data: poolSize } = useReadContract({
    address: bettingPoolAddress,
    abi: BETTING_POOL_ABI,
    functionName: "botPoolSize",
    args: [BigInt(roundId), BigInt(botId)],
    query: { enabled: roundId > 0 },
  });

  const { placeBet, isPending, isConfirming, isSuccess } = usePlaceBet();

  const botData = bot as any;
  const predData = prediction as any;
  const pool = poolSize as bigint;

  if (!botData) return null;

  const isBetting = roundStatus === 2;
  const isSettled = roundStatus === 3;
  const hasWon = predData?.scored && Number(predData.score) > 0;

  return (
    <div
      className="glass-card bot-card"
      style={{
        borderColor: isSettled && hasWon ? "var(--neon-green)" : undefined,
        boxShadow: isSettled && hasWon ? "0 0 20px rgba(57,255,20,0.2)" : undefined,
      }}
    >
      <div className="flex justify-between items-center mb-2">
        <span className="bot-name">{botData.name}</span>
        {isSettled ? (
          <span className={`badge ${hasWon ? "badge-green" : "badge-pink"}`}>
            {hasWon ? "WON" : "LOST"}
          </span>
        ) : botData.active ? (
          <span className="badge badge-cyan">Active</span>
        ) : null}
      </div>

      <div className="bot-creator">by {shortenAddress(botData.creator)}</div>

      <div className="flex gap-4 mt-2 mb-2" style={{ fontSize: 11 }}>
        <span className="font-mono text-muted">
          W/L: <span className="text-green">{Number(botData.wins)}</span>/
          {Number(botData.totalRounds) - Number(botData.wins)}
        </span>
        <span className="font-mono text-muted">Rounds: {Number(botData.totalRounds)}</span>
      </div>

      {predData && predData.botId > 0n ? (
        <div style={{ padding: 12, background: "rgba(0,0,0,0.3)", borderRadius: 8, marginBottom: 12 }}>
          <div className="font-mono text-xs text-muted mb-1">Prediction Range</div>
          <div className="font-display" style={{ fontSize: 14, color: "var(--neon-cyan)" }}>
            {centsToUsd(Number(predData.priceLow))} – {centsToUsd(Number(predData.priceHigh))}
          </div>
          {isSettled ? (
            <div className="font-mono text-xs mt-1" style={{ color: hasWon ? "var(--neon-green)" : "var(--neon-pink)" }}>
              Score: {Number(predData.score)}
            </div>
          ) : null}
        </div>
      ) : null}

      {pool !== undefined ? (
        <div className="font-mono text-xs text-muted mb-2">Pool: {formatEther(pool)} 0G</div>
      ) : null}

      {isBetting ? (
        <div className="flex gap-2 mt-2">
          <input
            type="number"
            className="input"
            value={betAmount}
            onChange={(e) => setBetAmount(e.target.value)}
            min="0.001"
            step="0.01"
            style={{ flex: 1, fontSize: 12, padding: "8px 10px" }}
          />
          <button
            className="btn btn-primary btn-sm"
            onClick={() => placeBet(roundId, botId, betAmount)}
            disabled={isPending || isConfirming}
            style={{ whiteSpace: "nowrap" }}
          >
            {isPending ? "..." : isConfirming ? "⏳" : "Bet"}
          </button>
        </div>
      ) : null}

      {isSuccess ? (
        <div className="text-green font-mono text-xs mt-2">✓ Bet placed!</div>
      ) : null}
    </div>
  );
}

export default function ArenaClient() {
  const { address } = useAccount();
  const [adminLoading, setAdminLoading] = useState("");

  const { data: roundCount, refetch: refetchRound } = useRoundCount();
  const currentRoundId = Number(roundCount || 0);

  const { data: round } = useRound(currentRoundId);
  const { data: roundBotIds } = useRoundBots(currentRoundId);
  const { data: activeBots } = useActiveBots();
  const { claimWinnings, isPending: claimPending, isConfirming: claimConfirming, isSuccess: claimSuccess } = useClaimWinnings();

  const roundData = round as any;
  const botIds = (roundBotIds as bigint[]) || [];
  const status = roundData ? Number(roundData.status) : -1;

  const handleAdminAction = async (action: string) => {
    setAdminLoading(action);
    try {
      const res = await fetch("/api/rounds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      refetchRound();
    } catch (err) {
      console.error(`[Admin] ${action} failed:`, err);
    } finally {
      setAdminLoading("");
    }
  };

  return (
    <main className="container section">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="section-title"><span className="text-cyan">⚔</span> Arena</h1>
          <p className="section-subtitle font-mono" style={{ marginBottom: 0 }}>
            Watch bots battle and place your bets
          </p>
        </div>
        <div className="badge badge-green">
          <span className="status-dot live" />
          Round #{currentRoundId || "—"}
        </div>
      </div>

      {/* Round Info */}
      <div className="round-timer glass-card mb-6" style={{ justifyContent: "center", flexDirection: "column", alignItems: "center", gap: 8 }}>
        <div className="timer-label">Current Round</div>
        <div className="timer-value" style={{ fontSize: 28 }}>#{currentRoundId || "0"}</div>
        <div className={`badge ${status === 2 ? "badge-green" : status === 3 ? "badge-pink" : "badge-cyan"}`} style={{ marginTop: 4 }}>
          Status: {status >= 0 ? formatRoundStatus(status) : "No Active Round"}
        </div>
        {roundData && roundData.totalPool > 0n ? (
          <div className="font-mono text-sm mt-2" style={{ color: "var(--neon-green)" }}>
            Total Pool: {formatEther(roundData.totalPool)} 0G
          </div>
        ) : null}
      </div>

      {/* Admin Controls */}
      <div className="glass-card mb-6" style={{ padding: 20, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
        <span className="text-xs text-muted font-mono" style={{ alignSelf: "center" }}>ADMIN //</span>
        <button className="btn btn-primary btn-sm" onClick={() => handleAdminAction("create")} disabled={!!adminLoading || (status >= 0 && status < 3)}>
          {adminLoading === "create" ? "⏳ Creating..." : "Create Round"}
        </button>
        <button className="btn btn-secondary btn-sm" onClick={() => handleAdminAction("predict")} disabled={!!adminLoading || status > 1}>
          {adminLoading === "predict" ? "⏳ Running AI..." : "Run Predictions"}
        </button>
        <button
          className="btn btn-sm"
          style={{ background: "var(--neon-green)", color: "#000", fontFamily: "var(--font-display)", fontSize: 11, fontWeight: 700, letterSpacing: 1.5, padding: "8px 16px", border: "none", borderRadius: 8, cursor: "pointer" }}
          onClick={() => handleAdminAction("settle")}
          disabled={!!adminLoading || status !== 2}
        >
          {adminLoading === "settle" ? "⏳ Settling..." : "Settle Round"}
        </button>
      </div>

      {/* Claim */}
      {status === 3 && address ? (
        <div className="glass-card mb-6" style={{ padding: 16, textAlign: "center" }}>
          <button className="btn btn-primary" onClick={() => claimWinnings(currentRoundId)} disabled={claimPending || claimConfirming}>
            {claimPending ? "✍ Confirm..." : claimConfirming ? "⏳ Claiming..." : "🏆 Claim Winnings"}
          </button>
          {claimSuccess ? <div className="text-green font-mono text-sm mt-2">✓ Winnings claimed!</div> : null}
        </div>
      ) : null}

      {/* Settlement price */}
      {status === 3 && roundData && Number(roundData.settlementPrice) > 0 ? (
        <div className="glass-card mb-6" style={{ padding: 16, textAlign: "center" }}>
          <div className="font-mono text-xs text-muted mb-1">Settlement Price</div>
          <div className="font-display" style={{ fontSize: 24, color: "var(--neon-cyan)" }}>
            {centsToUsd(Number(roundData.settlementPrice))}
          </div>
        </div>
      ) : null}

      {/* Bot Grid */}
      <h2 className="font-display mb-4" style={{ fontSize: 16, letterSpacing: 2, textTransform: "uppercase" }}>
        {botIds.length > 0 ? "Competing Bots" : "Participating Bots"}
      </h2>
      <div className="bot-grid">
        {botIds.length > 0 ? (
          botIds.map((id) => (
            <BotCard key={id.toString()} botId={Number(id)} roundId={currentRoundId} roundStatus={status} />
          ))
        ) : (
          <div className="glass-card" style={{ opacity: 0.5, gridColumn: "1 / -1", textAlign: "center", padding: 48 }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🤖</div>
            <div className="font-display" style={{ marginBottom: 8, fontSize: 14, letterSpacing: 1 }}>
              {currentRoundId === 0 ? "No rounds created yet" : "No bots in this round"}
            </div>
            <div className="font-mono text-xs text-muted">
              {currentRoundId === 0 ? "Admin: Create a round to get started" : "Create a bot and join the next round →"}
            </div>
          </div>
        )}
      </div>

      {/* Pool Stats */}
      <div className="stats-grid mt-6" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <div className="glass-card stat-card">
          <div className="stat-value" style={{ fontSize: 24 }}>{roundData ? formatEther(roundData.totalPool) : "0"}</div>
          <div className="stat-label">Total Pool (0G)</div>
        </div>
        <div className="glass-card stat-card">
          <div className="stat-value" style={{ fontSize: 24 }}>{botIds.length}</div>
          <div className="stat-label">Bots Competing</div>
        </div>
        <div className="glass-card stat-card">
          <div className="stat-value" style={{ fontSize: 24 }}>{(activeBots as any[])?.length ?? 0}</div>
          <div className="stat-label">Total Active Bots</div>
        </div>
      </div>
    </main>
  );
}
