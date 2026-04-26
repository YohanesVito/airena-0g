"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { formatEther } from "viem";
import dynamic from "next/dynamic";
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
import type { BotPrediction } from "@/components/BtcChart";

const BtcChart = dynamic(() => import("@/components/BtcChart"), { ssr: false });

const botRegistryAddress = CONTRACTS.botRegistry as `0x${string}`;
const bettingPoolAddress = CONTRACTS.bettingPool as `0x${string}`;
const BOT_COLORS = ["#00F0FF", "#FF2D78", "#39FF14", "#B44DFF", "#FF6B2B"];
const ROUND_DURATION = 3600; // 1 hour in seconds

// ============ Countdown Timer ============

function CountdownTimer({ endTime }: { endTime: number }) {
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    const update = () => {
      const remaining = Math.max(0, endTime - Math.floor(Date.now() / 1000));
      setTimeLeft(remaining);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [endTime]);

  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  const isUrgent = timeLeft < 300 && timeLeft > 0;
  const isExpired = timeLeft === 0;

  return (
    <div className="countdown" style={{ textAlign: "center" }}>
      <div className="font-mono text-xs text-muted mb-2" style={{ letterSpacing: 2 }}>
        {isExpired ? "ROUND ENDED" : "SETTLES IN"}
      </div>
      <div className="font-display" style={{
        fontSize: 42,
        letterSpacing: 4,
        color: isExpired ? "var(--text-muted)" : isUrgent ? "var(--neon-pink)" : "var(--neon-cyan)",
        textShadow: isExpired
          ? "none"
          : isUrgent
          ? "0 0 20px rgba(255,45,120,0.5)"
          : "0 0 20px rgba(0,240,255,0.4)",
        fontVariantNumeric: "tabular-nums",
        animation: isUrgent ? "pulse 1s ease-in-out infinite" : undefined,
      }}>
        {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
      </div>
    </div>
  );
}

// ============ Bot Battle Card ============

function BotBattleCard({
  botId,
  roundId,
  roundStatus,
  color,
  index,
}: {
  botId: number;
  roundId: number;
  roundStatus: number;
  color: string;
  index: number;
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
    <div className="battle-card glass-card" style={{
      borderColor: isSettled && hasWon ? "var(--neon-green)" : `${color}30`,
      boxShadow: isSettled && hasWon
        ? "0 0 25px rgba(57,255,20,0.25)"
        : `0 0 15px ${color}10`,
    }}>
      {/* Color indicator */}
      <div style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
        borderRadius: "12px 12px 0 0",
        opacity: isSettled && !hasWon ? 0.3 : 1,
      }} />

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div>
          <div className="font-display" style={{ fontSize: 14, fontWeight: 700, letterSpacing: 1, color, textShadow: `0 0 12px ${color}40` }}>
            {botData.name}
          </div>
          <div className="font-mono text-xs text-muted" style={{ marginTop: 2 }}>
            by {shortenAddress(botData.creator)}
          </div>
        </div>
        {isSettled ? (
          <span className={`badge ${hasWon ? "badge-green" : "badge-pink"}`} style={{ fontSize: 10 }}>
            {hasWon ? "✓ WON" : "✗ LOST"}
          </span>
        ) : (
          <div style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: color,
            boxShadow: `0 0 8px ${color}`,
          }} />
        )}
      </div>

      {/* Stats row */}
      <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
        <div className="font-mono text-xs text-muted">
          Win Rate: <span style={{ color: "var(--neon-green)" }}>
            {Number(botData.totalRounds) > 0
              ? `${((Number(botData.wins) / Number(botData.totalRounds)) * 100).toFixed(0)}%`
              : "—"}
          </span>
        </div>
        <div className="font-mono text-xs text-muted">
          Rounds: {Number(botData.totalRounds)}
        </div>
      </div>

      {/* Prediction Range */}
      {predData && predData.botId > 0n ? (
        <div style={{
          padding: 14,
          background: `linear-gradient(135deg, ${color}08, ${color}04)`,
          border: `1px solid ${color}20`,
          borderRadius: 8,
          marginBottom: 12,
        }}>
          <div className="font-mono text-xs text-muted mb-2">Predicted Range</div>
          <div className="font-display" style={{ fontSize: 16, color, letterSpacing: 0.5 }}>
            {centsToUsd(Number(predData.priceLow))}
          </div>
          <div className="font-mono text-xs text-muted" style={{ margin: "2px 0" }}>to</div>
          <div className="font-display" style={{ fontSize: 16, color, letterSpacing: 0.5 }}>
            {centsToUsd(Number(predData.priceHigh))}
          </div>
          <div className="font-mono text-xs text-muted" style={{ marginTop: 6 }}>
            Spread: ${((Number(predData.priceHigh) - Number(predData.priceLow)) / 100).toFixed(0)}
          </div>
          {isSettled ? (
            <div className="font-mono text-xs" style={{ marginTop: 8, color: hasWon ? "var(--neon-green)" : "var(--neon-pink)" }}>
              Score: {Number(predData.score)}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Pool */}
      {pool !== undefined ? (
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "8px 12px",
          background: "rgba(0,0,0,0.3)",
          borderRadius: 6,
          marginBottom: isBetting ? 12 : 0,
        }}>
          <span className="font-mono text-xs text-muted">Pool</span>
          <span className="font-display" style={{ fontSize: 13, color: "var(--neon-green)" }}>
            {formatEther(pool)} 0G
          </span>
        </div>
      ) : null}

      {/* Bet Controls */}
      {isBetting ? (
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="number"
            className="input"
            value={betAmount}
            onChange={(e) => setBetAmount(e.target.value)}
            min="0.001"
            step="0.01"
            style={{ flex: 1, fontSize: 12, padding: "10px 12px" }}
          />
          <button
            className="btn btn-sm"
            style={{
              background: color,
              color: "#000",
              fontFamily: "var(--font-display)",
              fontSize: 11,
              fontWeight: 700,
              border: "none",
              borderRadius: 8,
              padding: "10px 16px",
              cursor: "pointer",
              boxShadow: `0 0 12px ${color}40`,
            }}
            onClick={() => placeBet(roundId, botId, betAmount)}
            disabled={isPending || isConfirming}
          >
            {isPending ? "..." : isConfirming ? "⏳" : "BET"}
          </button>
        </div>
      ) : null}

      {isSuccess ? (
        <div className="text-green font-mono text-xs mt-2" style={{ textAlign: "center" }}>✓ Bet placed!</div>
      ) : null}
    </div>
  );
}

// ============ Main Arena Page ============

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
  const startTime = roundData ? Number(roundData.startTime) : 0;
  const endTime = startTime > 0 ? startTime + ROUND_DURATION : 0;

  // Build target time string for the question
  const targetTimeStr = endTime > 0
    ? new Date(endTime * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "—:—";

  // Build predictions array for chart
  const [chartPredictions, setChartPredictions] = useState<BotPrediction[]>([]);

  // Read all predictions for chart visualization
  useEffect(() => {
    if (botIds.length === 0) {
      setChartPredictions([]);
      return;
    }
    // We'll let the BotBattleCard handle individual reads
    // For the chart, create placeholder predictions based on botIds
    // Real data comes from the individual card reads
  }, [botIds]);

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

  // Demo predictions for chart when no real data
  const demoPredictions: BotPrediction[] = currentRoundId === 0
    ? [
        { botId: 1, name: "MomentumBot", priceLow: 94200, priceHigh: 94800, color: BOT_COLORS[0] },
        { botId: 2, name: "SentinelAI", priceLow: 94000, priceHigh: 95200, color: BOT_COLORS[1] },
        { botId: 3, name: "NeuralEdge", priceLow: 94400, priceHigh: 94600, color: BOT_COLORS[2] },
      ]
    : [];

  return (
    <main className="container section">
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 className="section-title"><span className="text-cyan">⚔</span> Arena</h1>
          <p className="section-subtitle font-mono" style={{ marginBottom: 0 }}>
            AI bots battle on BTC price predictions
          </p>
        </div>
        <div className="badge badge-green" style={{ fontSize: 11 }}>
          <span className="status-dot live" />
          Round #{currentRoundId || "—"}
        </div>
      </div>

      {/* Round Question + Countdown */}
      <div className="glass-card mb-6" style={{ padding: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 20 }}>
          <div>
            <div className="font-display" style={{ fontSize: 18, letterSpacing: 1, marginBottom: 6 }}>
              <span className="text-pink">⟐</span>{" "}
              {currentRoundId > 0
                ? `What will BTC be at ${targetTimeStr}?`
                : "Waiting for next round..."}
            </div>
            <div className="font-mono text-xs text-muted">
              {status === 0 ? "Round created — waiting for predictions" :
               status === 1 ? "AI bots are generating predictions..." :
               status === 2 ? "Betting is OPEN — pick your bot!" :
               status === 3 ? "Round settled — check results below" :
               "No active round"}
              {" · "}
              Min 2 bots required
            </div>
          </div>
          {endTime > 0 && status < 3 ? (
            <CountdownTimer endTime={endTime} />
          ) : status === 3 && roundData && Number(roundData.settlementPrice) > 0 ? (
            <div style={{ textAlign: "center" }}>
              <div className="font-mono text-xs text-muted mb-2" style={{ letterSpacing: 2 }}>SETTLED AT</div>
              <div className="font-display" style={{ fontSize: 24, color: "var(--neon-green)", textShadow: "0 0 15px rgba(57,255,20,0.4)" }}>
                {centsToUsd(Number(roundData.settlementPrice))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* BTC Chart with Bot Ranges */}
      <div className="mb-6">
        <BtcChart
          predictions={demoPredictions}
          height={350}
          question={currentRoundId > 0 ? `Target: ${targetTimeStr}` : undefined}
          settlementPrice={
            status === 3 && roundData ? Number(roundData.settlementPrice) / 100 : undefined
          }
        />
      </div>

      {/* Admin Controls */}
      <div className="glass-card mb-6" style={{ padding: 16, display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", alignItems: "center" }}>
        <span className="font-mono text-xs text-muted" style={{ letterSpacing: 1 }}>ADMIN //</span>
        <button className="btn btn-primary btn-sm" onClick={() => handleAdminAction("create")}
          disabled={!!adminLoading || (status >= 0 && status < 3)}>
          {adminLoading === "create" ? "⏳..." : "New Round"}
        </button>
        <button className="btn btn-secondary btn-sm" onClick={() => handleAdminAction("predict")}
          disabled={!!adminLoading || status > 1}>
          {adminLoading === "predict" ? "⏳ Running AI..." : "Run Predictions"}
        </button>
        <button className="btn btn-sm" style={{
          background: "var(--neon-green)", color: "#000", fontFamily: "var(--font-display)",
          fontSize: 11, fontWeight: 700, letterSpacing: 1.5, padding: "8px 16px",
          border: "none", borderRadius: 8, cursor: "pointer",
        }} onClick={() => handleAdminAction("settle")} disabled={!!adminLoading || status !== 2}>
          {adminLoading === "settle" ? "⏳..." : "Settle"}
        </button>
      </div>

      {/* Claim */}
      {status === 3 && address ? (
        <div className="glass-card mb-6" style={{ padding: 16, textAlign: "center" }}>
          <button className="btn btn-primary" onClick={() => claimWinnings(currentRoundId)} disabled={claimPending || claimConfirming}>
            {claimPending ? "✍ Confirm..." : claimConfirming ? "⏳..." : "🏆 Claim Winnings"}
          </button>
          {claimSuccess ? <div className="text-green font-mono text-sm mt-2">✓ Winnings claimed!</div> : null}
        </div>
      ) : null}

      {/* Bot Battle Grid */}
      <h2 className="font-display mb-4" style={{ fontSize: 14, letterSpacing: 2, textTransform: "uppercase" }}>
        <span className="text-pink">⟐</span> Competing Bots
        <span className="font-mono text-xs text-muted" style={{ marginLeft: 12, fontWeight: 400 }}>
          {botIds.length} / {(activeBots as any[])?.length ?? 0} active
        </span>
      </h2>

      {botIds.length > 0 ? (
        <div className="battle-bots-row">
          {botIds.map((id, idx) => (
            <BotBattleCard
              key={id.toString()}
              botId={Number(id)}
              roundId={currentRoundId}
              roundStatus={status}
              color={BOT_COLORS[idx % BOT_COLORS.length]}
              index={idx}
            />
          ))}
        </div>
      ) : (
        <div className="glass-card" style={{ textAlign: "center", padding: 56, opacity: 0.6 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🤖</div>
          <div className="font-display" style={{ fontSize: 14, letterSpacing: 1, marginBottom: 8 }}>
            {currentRoundId === 0 ? "No rounds created yet" : "Waiting for bot predictions..."}
          </div>
          <div className="font-mono text-xs text-muted">
            {currentRoundId === 0
              ? "Create a round to start the battle"
              : "Click 'Run Predictions' to let bots compete"}
          </div>
        </div>
      )}

      {/* Bottom Stats */}
      <div className="stats-grid mt-6" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <div className="glass-card stat-card">
          <div className="stat-value" style={{ fontSize: 22 }}>
            {roundData ? formatEther(roundData.totalPool) : "0"}
          </div>
          <div className="stat-label">Pool (0G)</div>
        </div>
        <div className="glass-card stat-card">
          <div className="stat-value" style={{ fontSize: 22 }}>{botIds.length}</div>
          <div className="stat-label">Competing</div>
        </div>
        <div className="glass-card stat-card">
          <div className="stat-value" style={{ fontSize: 22 }}>{(activeBots as any[])?.length ?? 0}</div>
          <div className="stat-label">Active Bots</div>
        </div>
        <div className="glass-card stat-card">
          <div className="stat-value" style={{ fontSize: 22 }}>{currentRoundId}</div>
          <div className="stat-label">Total Rounds</div>
        </div>
      </div>

      {/* Info: Edge cases */}
      <div className="glass-card mt-6" style={{ padding: 16, borderLeft: "2px solid var(--neon-cyan)" }}>
        <div className="font-mono text-xs text-secondary" style={{ lineHeight: 1.8 }}>
          <span className="text-cyan">ℹ</span> If all bots predict correctly, the pool splits by score (tighter range = higher score).
          If no bot is correct, all bettors are automatically refunded.
          Minimum 2 bots required to start a round.
        </div>
      </div>
    </main>
  );
}
