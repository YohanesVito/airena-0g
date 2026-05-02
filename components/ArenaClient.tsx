"use client";

import { useState, useEffect, useMemo } from "react";
import { useAccount } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { formatEther } from "viem";
import dynamic from "next/dynamic";
import {
  useRoundCount,
  useRound,
  useRoundBots,
  useActiveBots,
  useRoundPredictions,
  useRoundBetCount,
  useRoundBets,
  usePlaceBet,
  useClaimWinnings,
  useHasClaimed,
  centsToUsd,
  shortenAddress,
} from "@/hooks/useContracts";
import { CONTRACTS, BOT_REGISTRY_ABI, BETTING_POOL_ABI } from "@/lib/contracts";
import { useReadContract } from "wagmi";
import type { BotPrediction, JudgeZone } from "@/components/BtcChart";
// Type-only import — lib/0g-storage.ts has Node-only deps and would bloat the
// client bundle; `import type` is erased at compile time.
import type { ReasoningTraceData } from "@/lib/0g-storage";

// Estimated stages for the predict admin action (~2 min total).
// Used to drive the multi-step progress display so the user isn't left
// staring at a frozen spinner.
const PREDICT_STAGES: { label: string; afterSec: number }[] = [
  { label: "⚖ 0G Judge AI inferring volatility zones…", afterSec: 0 },
  { label: "🔐 Verifying Judge attestation in TEE…", afterSec: 15 },
  { label: "🤖 Bot 1 picking a range within the Judge zones…", afterSec: 25 },
  { label: "💾 Storing reasoning trace on 0G Storage…", afterSec: 50 },
  { label: "🤖 Bot 2 picking a range within the Judge zones…", afterSec: 75 },
  { label: "💾 Storing reasoning trace on 0G Storage…", afterSec: 100 },
  { label: "✓ Submitting predictions on-chain & opening betting…", afterSec: 120 },
];

// Settlement is much shorter (~25s for 2 bots): one settleRound tx,
// then one updateBotStats tx per bot.
const SETTLE_STAGES: { label: string; afterSec: number }[] = [
  { label: "📡 Fetching settlement BTC price from CoinGecko…", afterSec: 0 },
  { label: "⛓ settleRound() — scoring predictions on-chain…", afterSec: 3 },
  { label: "🤖 Updating bot stats (wins / total score)…", afterSec: 12 },
  { label: "✓ Round settled — bettors can now claim winnings", afterSec: 22 },
];

// New Round is the fastest action (~6-10s, single createRound tx).
const CREATE_STAGES: { label: string; afterSec: number }[] = [
  { label: "✍ Signing createRound() with admin key…", afterSec: 0 },
  { label: "⛓ Awaiting block confirmation on 0G chain…", afterSec: 3 },
  { label: "✓ Round created — click Run Predictions next", afterSec: 8 },
];

const BtcChart = dynamic(() => import("@/components/BtcChart"), { ssr: false });

const botRegistryAddress = CONTRACTS.botRegistry as `0x${string}`;
const bettingPoolAddress = CONTRACTS.bettingPool as `0x${string}`;
const BOT_COLORS = ["#00F0FF", "#FF2D78", "#39FF14", "#B44DFF", "#FF6B2B"];
const ROUND_DURATION = 3600; // 1 hour in seconds
// Admin wallet address — only this wallet sees the create/predict/settle
// controls. Empty = hide admin UI for everyone (safe default).
const ADMIN_ADDRESS = (process.env.NEXT_PUBLIC_ADMIN_ADDRESS ?? "").toLowerCase();

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

// ============ Reasoning Trace + TEE Badge ============

function useReasoningTrace(reasoningHash: string | undefined) {
  const [trace, setTrace] = useState<ReasoningTraceData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!reasoningHash || !reasoningHash.startsWith("0x") || reasoningHash.length < 10) {
      setTrace(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/storage/trace/${reasoningHash}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.trace) setTrace(data.trace as ReasoningTraceData);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reasoningHash]);

  return { trace, loading };
}

// ============ Judge AI ============

interface JudgeData {
  zones: JudgeZone[];
  reasoning: string;
  traceHash: string;
  tee?: {
    signature: string;
    signer: string;
    signedText: string;
    chatID: string;
    verified: boolean;
  };
}

function useJudge(roundId: number, status: number, refreshKey: number) {
  const [judge, setJudge] = useState<JudgeData | null>(null);
  // Refetch on round/status change AND when refreshKey is bumped
  // (e.g. after an admin action completes — useRound's data may still be cached
  // so status hasn't moved yet, but we still want to fetch fresh judge data).
  useEffect(() => {
    if (roundId === 0) {
      setJudge(null);
      return;
    }
    let cancelled = false;
    fetch("/api/rounds")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        setJudge((data?.judge as JudgeData) ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [roundId, status, refreshKey]);
  return judge;
}

function JudgePanel({ judge, settled }: { judge: JudgeData | null; settled: boolean }) {
  if (!judge) return null;
  const tee = judge.tee;
  const short = (s: string) => `${s.slice(0, 6)}…${s.slice(-4)}`;

  return (
    <div
      className="glass-card mb-6"
      style={{
        padding: 20,
        borderLeft: "3px solid rgba(255,255,255,0.4)",
        background: "linear-gradient(135deg, rgba(255,255,255,0.03), rgba(0,240,255,0.02))",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div className="font-display" style={{ fontSize: 13, letterSpacing: 2, color: "rgba(255,255,255,0.85)", textTransform: "uppercase" }}>
            ⚖ 0G Judge AI
          </div>
          <div className="font-mono text-xs text-muted" style={{ marginTop: 4, lineHeight: 1.6 }}>
            {settled
              ? "Frame for last round — these zones informed each bot's prediction."
              : "Volatility forecast — bots are nudged to align their ranges with one of these zones."}
          </div>
        </div>
        {tee ? (
          <div
            title={`Verified by 0G Compute TEE\nSigner:   ${tee.signer}\nChat ID:  ${tee.chatID}\nSig:      ${tee.signature.slice(0, 24)}…\nStatus:   ${tee.verified ? "✓ recovered address matches contract" : "✗ unverified"}`}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "6px 10px",
              background: tee.verified ? "rgba(57,255,20,0.08)" : "rgba(255,45,120,0.08)",
              border: `1px solid ${tee.verified ? "rgba(57,255,20,0.35)" : "rgba(255,45,120,0.35)"}`,
              borderRadius: 6, cursor: "help",
            }}
          >
            <span style={{ color: tee.verified ? "var(--neon-green)" : "var(--neon-pink)", fontSize: 12 }}>
              {tee.verified ? "✓" : "⚠"}
            </span>
            <span className="font-mono" style={{ fontSize: 10, color: tee.verified ? "var(--neon-green)" : "var(--neon-pink)", letterSpacing: 0.8, fontWeight: 600 }}>
              VERIFIED · 0G TEE
            </span>
            <span className="font-mono" style={{ fontSize: 9, color: "rgba(255,255,255,0.55)" }}>
              {short(tee.signer)}
            </span>
          </div>
        ) : null}
      </div>

      <div className="font-mono text-xs" style={{ color: "rgba(255,255,255,0.7)", lineHeight: 1.7, marginBottom: 14, fontStyle: "italic" }}>
        “{judge.reasoning}”
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {judge.zones.map((z, i) => (
          <div
            key={i}
            style={{
              padding: "10px 14px",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 8,
              minWidth: 160,
            }}
          >
            <div className="font-mono" style={{ fontSize: 9, color: "rgba(255,255,255,0.55)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>
              Zone {i + 1}
            </div>
            <div className="font-display" style={{ fontSize: 12, color: "rgba(255,255,255,0.95)", marginBottom: 6 }}>
              {z.label}
            </div>
            <div className="font-mono" style={{ fontSize: 11, color: "var(--neon-cyan)" }}>
              ${z.priceLow.toLocaleString()} – ${z.priceHigh.toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TEEBadge({ reasoningHash }: { reasoningHash: string | undefined }) {
  const { trace, loading } = useReasoningTrace(reasoningHash);
  const tee = trace?.tee;

  if (!reasoningHash || reasoningHash.length < 10) return null;
  if (loading && !tee) {
    return (
      <div className="font-mono text-xs text-muted" style={{ marginTop: 8, opacity: 0.6 }}>
        ⟳ fetching TEE attestation…
      </div>
    );
  }
  if (!tee) return null;

  const short = (s: string) => `${s.slice(0, 6)}…${s.slice(-4)}`;
  const signedPreview = tee.signedText.length > 32 ? `${tee.signedText.slice(0, 32)}…` : tee.signedText;
  const tooltip = `Verified by 0G Compute TEE
Signer:   ${tee.signer}
Chat ID:  ${tee.chatID}
Signed:   ${signedPreview}
Sig:      ${tee.signature.slice(0, 24)}…
Status:   ${tee.verified ? "✓ recovered address matches contract" : "✗ unverified"}`;

  const ok = tee.verified;
  const accent = ok ? "rgba(57,255,20" : "rgba(255,45,120"; // green vs pink

  return (
    <div
      title={tooltip}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 10px",
        marginTop: 8,
        background: `${accent},0.08)`,
        border: `1px solid ${accent},0.35)`,
        borderRadius: 6,
        cursor: "help",
      }}
    >
      <span style={{ color: ok ? "var(--neon-green)" : "var(--neon-pink)", fontSize: 12 }}>
        {ok ? "✓" : "⚠"}
      </span>
      <span
        className="font-mono"
        style={{
          fontSize: 10,
          color: ok ? "var(--neon-green)" : "var(--neon-pink)",
          letterSpacing: 0.8,
          fontWeight: 600,
        }}
      >
        VERIFIED · 0G TEE
      </span>
      <span
        className="font-mono"
        style={{ fontSize: 9, color: "rgba(255,255,255,0.55)" }}
      >
        {short(tee.signer)}
      </span>
    </div>
  );
}

// Compact-format a raw on-chain score (which is 1e12 / rangeWidth, so it
// lives in the millions–billions range). 20_000_000 → "20.0M".
function formatScoreCompact(n: number): string {
  if (n === 0) return "0";
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return Math.round(n).toString();
}

// ============ Bot Strategy (prompt from 0G Storage) ============

function useBotPrompt(storageHash: string | undefined, enabled: boolean) {
  const [prompt, setPrompt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !storageHash || !storageHash.startsWith("0x")) return;
    if (prompt !== null) return; // already fetched
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch("/api/storage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "retrieve", rootHash: storageHash }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`)))
      .then((res) => {
        if (cancelled) return;
        const p = (res.data?.prompt as string) ?? null;
        if (p) setPrompt(p);
        else setError("prompt missing in stored data");
      })
      .catch((err) => !cancelled && setError(String(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [storageHash, enabled, prompt]);

  return { prompt, loading, error };
}

function BotStrategy({ storageHash, color }: { storageHash: string | undefined; color: string }) {
  const [open, setOpen] = useState(false);
  const { prompt, loading, error } = useBotPrompt(storageHash, open);

  if (!storageHash || !storageHash.startsWith("0x")) return null;

  return (
    <div style={{ marginBottom: 12 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="font-mono"
        style={{
          fontSize: 10,
          color: open ? color : "rgba(255,255,255,0.6)",
          background: "transparent",
          border: `1px solid ${open ? color : "rgba(255,255,255,0.15)"}`,
          borderRadius: 6,
          padding: "5px 10px",
          letterSpacing: 0.5,
          cursor: "pointer",
          width: "100%",
          textAlign: "left",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span>{open ? "▼" : "▶"} Strategy prompt (0G Storage)</span>
        <span style={{ opacity: 0.4, fontSize: 9 }}>
          {storageHash.slice(0, 8)}…{storageHash.slice(-4)}
        </span>
      </button>
      {open ? (
        <div
          className="font-mono"
          style={{
            marginTop: 6, padding: 10,
            background: "rgba(0,0,0,0.4)",
            border: `1px dashed ${color}30`,
            borderRadius: 6,
            fontSize: 10, lineHeight: 1.5,
            color: "rgba(255,255,255,0.8)",
            maxHeight: 200, overflowY: "auto",
            whiteSpace: "pre-wrap",
          }}
        >
          {loading ? "⟳ fetching from 0G Storage…"
            : error ? <span style={{ color: "var(--neon-pink)" }}>error: {error}</span>
            : prompt ?? "(empty)"}
        </div>
      ) : null}
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
  totalWinScore,
}: {
  botId: number;
  roundId: number;
  roundStatus: number;
  color: string;
  index: number;
  totalWinScore: number;
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

      {/* Strategy prompt — fetched on demand from 0G Storage when expanded */}
      <BotStrategy storageHash={botData.storageHash} color={color} />

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
            (() => {
              const score = Number(predData.score);
              if (hasWon && totalWinScore > 0) {
                const sharePct = (score / totalWinScore) * 100;
                return (
                  <div className="font-mono text-xs" style={{ marginTop: 8, color: "var(--neon-green)" }}>
                    ✓ Pool share: {sharePct.toFixed(1)}%
                    <span style={{ marginLeft: 6, opacity: 0.5 }}>
                      (accuracy {formatScoreCompact(score)})
                    </span>
                  </div>
                );
              }
              if (!hasWon && totalWinScore > 0) {
                return (
                  <div className="font-mono text-xs" style={{ marginTop: 8, color: "var(--neon-pink)" }}>
                    ✗ Out of range — winners take the pool
                  </div>
                );
              }
              return (
                <div className="font-mono text-xs" style={{ marginTop: 8, color: "var(--text-muted)" }}>
                  ✗ Out of range — all bets refunded
                </div>
              );
            })()
          ) : null}
          {/* TEE attestation badge — proves this prediction was produced by a
              verified 0G Compute provider, not fabricated server-side */}
          <TEEBadge reasoningHash={predData.reasoningHash} />
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
  const queryClient = useQueryClient();
  const [adminLoading, setAdminLoading] = useState("");
  const [predictStageIdx, setPredictStageIdx] = useState(0);
  const [settleStageIdx, setSettleStageIdx] = useState(0);
  const [createStageIdx, setCreateStageIdx] = useState(0);
  const [actionMessage, setActionMessage] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);
  // Bumped after each admin action to force the judge fetch (and any other
  // non-wagmi data) to refresh, even if the round read is still cached.
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: roundCount, error: roundCountError, isFetching: roundCountFetching, status: roundCountStatus } = useRoundCount();
  const currentRoundId = Number(roundCount || 0);

  const { data: round } = useRound(currentRoundId);
  const { data: roundBotIds } = useRoundBots(currentRoundId);
  const { data: activeBots } = useActiveBots();
  const { claimWinnings, isPending: claimPending, isConfirming: claimConfirming, isSuccess: claimSuccess } = useClaimWinnings();
  // Read hasClaimed[round][user] from chain so the button stays disabled
  // across page reloads and works for users who already claimed previously.
  const { data: hasClaimedOnChain } = useHasClaimed(currentRoundId, address);

  // After a successful claim, refresh the on-chain hasClaimed flag so the UI
  // reflects the new state without requiring a manual reload.
  useEffect(() => {
    if (claimSuccess) {
      queryClient.invalidateQueries();
    }
  }, [claimSuccess, queryClient]);

  const roundData = round as any;
  const botIds = (roundBotIds as bigint[]) || [];
  const status = roundData ? Number(roundData.status) : -1;
  const startTime = roundData ? Number(roundData.startTime) : 0;
  const endTime = startTime > 0 ? startTime + ROUND_DURATION : 0;

  // Build target time string for the question
  const targetTimeStr = endTime > 0
    ? new Date(endTime * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "—:—";

  // Batch-read all on-chain predictions + bot metadata for the current round
  const { data: predictionData } = useRoundPredictions(currentRoundId, botIds);

  const realPredictions: BotPrediction[] = useMemo(() => {
    if (!predictionData || botIds.length === 0) return [];
    const out: BotPrediction[] = [];
    for (let i = 0; i < botIds.length; i++) {
      const pred = predictionData[i * 2]?.result as
        | { botId: bigint; priceLow: bigint; priceHigh: bigint; score: bigint; scored: boolean }
        | undefined;
      const bot = predictionData[i * 2 + 1]?.result as
        | { id: bigint; name: string }
        | undefined;
      // pred.botId === 0n means the bot hasn't submitted a prediction yet
      if (!pred || !bot || pred.botId === 0n) continue;
      out.push({
        botId: Number(bot.id),
        name: bot.name,
        priceLow: Number(pred.priceLow) / 100,
        priceHigh: Number(pred.priceHigh) / 100,
        color: BOT_COLORS[i % BOT_COLORS.length],
        won: status === 3 ? Number(pred.score) > 0 : undefined,
      });
    }
    return out;
  }, [predictionData, botIds, status]);

  // Sum of all winning bots' scores — denominator for "pool share %" math
  // shown on each bot card after settlement. Computed from the same batched
  // prediction reads so we don't make an extra contract call.
  const totalWinScore = useMemo(() => {
    if (!predictionData || botIds.length === 0) return 0;
    let sum = 0;
    for (let i = 0; i < botIds.length; i++) {
      const pred = predictionData[i * 2]?.result as { score?: bigint } | undefined;
      if (pred?.score) sum += Number(pred.score);
    }
    return sum;
  }, [predictionData, botIds]);

  // Decide whether the connected wallet has anything to claim in this round,
  // so we can hide the claim card from non-bettors and from bettors whose
  // only bets were on losing bots. The contract auto-refunds when no bot
  // wins (totalWinScore === 0), so any bettor in that case is eligible.
  const { data: roundBetCount } = useRoundBetCount(currentRoundId);
  const betCountNum = Number((roundBetCount as bigint | undefined) ?? 0n);
  const { data: roundBetsData } = useRoundBets(currentRoundId, betCountNum);

  const claimEligibility = useMemo<{
    canClaim: boolean;
    isRefund: boolean;
  }>(() => {
    if (!address || status !== 3 || !roundBetsData) {
      return { canClaim: false, isRefund: false };
    }
    type BetTuple = { bettor: string; botId: bigint; amount: bigint; claimed: boolean };
    const userBets: BetTuple[] = [];
    for (const r of roundBetsData) {
      const b = r.result as BetTuple | undefined;
      if (b && b.bettor.toLowerCase() === address.toLowerCase()) userBets.push(b);
    }
    if (userBets.length === 0) return { canClaim: false, isRefund: false };

    if (totalWinScore === 0) return { canClaim: true, isRefund: true };

    const winningBotIds = new Set<number>();
    if (predictionData) {
      for (let i = 0; i < botIds.length; i++) {
        const pred = predictionData[i * 2]?.result as { score?: bigint } | undefined;
        if (pred && Number(pred.score ?? 0n) > 0) winningBotIds.add(Number(botIds[i]));
      }
    }
    const hasWinningBet = userBets.some((b) => winningBotIds.has(Number(b.botId)));
    return { canClaim: hasWinningBet, isRefund: false };
  }, [address, status, roundBetsData, totalWinScore, predictionData, botIds]);

  // Drive staged progress text for slow admin actions so the user has
  // something to watch instead of a frozen spinner. Stages advance on a
  // timer based on STAGES[*].afterSec (rough but conveys what's happening).
  useEffect(() => {
    if (adminLoading !== "predict") {
      setPredictStageIdx(0);
      return;
    }
    const start = Date.now();
    const tick = () => {
      const elapsedSec = (Date.now() - start) / 1000;
      let idx = 0;
      for (let i = 0; i < PREDICT_STAGES.length; i++) {
        if (elapsedSec >= PREDICT_STAGES[i].afterSec) idx = i;
      }
      setPredictStageIdx(idx);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [adminLoading]);

  useEffect(() => {
    if (adminLoading !== "settle") {
      setSettleStageIdx(0);
      return;
    }
    const start = Date.now();
    const tick = () => {
      const elapsedSec = (Date.now() - start) / 1000;
      let idx = 0;
      for (let i = 0; i < SETTLE_STAGES.length; i++) {
        if (elapsedSec >= SETTLE_STAGES[i].afterSec) idx = i;
      }
      setSettleStageIdx(idx);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [adminLoading]);

  useEffect(() => {
    if (adminLoading !== "create") {
      setCreateStageIdx(0);
      return;
    }
    const start = Date.now();
    const tick = () => {
      const elapsedSec = (Date.now() - start) / 1000;
      let idx = 0;
      for (let i = 0; i < CREATE_STAGES.length; i++) {
        if (elapsedSec >= CREATE_STAGES[i].afterSec) idx = i;
      }
      setCreateStageIdx(idx);
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [adminLoading]);

  // Auto-clear the action banner after 6 seconds.
  useEffect(() => {
    if (!actionMessage) return;
    const id = setTimeout(() => setActionMessage(null), 6000);
    return () => clearTimeout(id);
  }, [actionMessage]);

  const handleAdminAction = async (action: string) => {
    setAdminLoading(action);
    setActionMessage(null);
    try {
      const res = await fetch("/api/rounds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `${res.status} ${res.statusText}`);
      // Force every wagmi read to refetch — round status, bots, predictions,
      // pool, etc. Without this the UI keeps showing the pre-action state.
      await queryClient.invalidateQueries();
      // Trigger the (non-wagmi) judge fetch too.
      setRefreshKey((k) => k + 1);
      const ok =
        action === "create"
          ? "✓ New round created. Click Run Predictions next."
          : action === "predict"
            ? "✓ Predictions submitted, betting is OPEN."
            : action === "settle"
              ? "✓ Round settled. Bettors can now claim winnings."
              : "✓ Done.";
      setActionMessage({ kind: "success", text: ok });
    } catch (err) {
      console.error(`[Admin] ${action} failed:`, err);
      setActionMessage({
        kind: "error",
        text: `${action} failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setAdminLoading("");
    }
  };

  // Judge data lives in the API's in-memory cache (not on-chain). Fetch it
  // separately and refresh whenever round/status/refreshKey changes.
  const judge = useJudge(currentRoundId, status, refreshKey);
  const judgeZones: JudgeZone[] = judge?.zones ?? [];

  // Use real on-chain predictions when bots have predicted; fall back to demo
  // ranges only when there's no round at all (landing-style preview).
  const demoPredictions: BotPrediction[] = currentRoundId === 0
    ? [
        { botId: 1, name: "MomentumBot", priceLow: 94200, priceHigh: 94800, color: BOT_COLORS[0] },
        { botId: 2, name: "SentinelAI", priceLow: 94000, priceHigh: 95200, color: BOT_COLORS[1] },
        { botId: 3, name: "NeuralEdge", priceLow: 94400, priceHigh: 94600, color: BOT_COLORS[2] },
      ]
    : [];
  const chartPredictions = realPredictions.length > 0 ? realPredictions : demoPredictions;

  return (
    <main className="container section">
      {/* Debug strip — shows the wagmi read state so we can see immediately
          if the RPC is reachable. Can be removed after diagnostics are done. */}
      <div className="font-mono text-xs" style={{
        marginBottom: 16, padding: "8px 12px", borderRadius: 6,
        background: "rgba(0,0,0,0.4)", border: "1px solid rgba(0,240,255,0.15)",
        display: "flex", gap: 18, flexWrap: "wrap",
        color: "rgba(255,255,255,0.6)",
      }}>
        <span>chain RPC read status: <span style={{ color: roundCountError ? "var(--neon-pink)" : roundCountStatus === "success" ? "var(--neon-green)" : "var(--neon-cyan)" }}>{roundCountStatus}</span></span>
        <span>roundCount: <span style={{ color: "var(--neon-cyan)" }}>{roundCount?.toString() ?? "(undefined)"}</span></span>
        <span>fetching: <span style={{ color: roundCountFetching ? "var(--neon-pink)" : "var(--neon-green)" }}>{String(roundCountFetching)}</span></span>
        {roundCountError ? (
          <span style={{ color: "var(--neon-pink)" }}>error: {roundCountError.message.slice(0, 80)}</span>
        ) : null}
      </div>
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

      {/* Judge AI panel (volatility forecast → zones for bots to choose from) */}
      <JudgePanel judge={judge} settled={status === 3} />

      {/* BTC Chart with Bot Ranges */}
      <div className="mb-6">
        <BtcChart
          predictions={chartPredictions}
          judgeZones={judgeZones}
          height={350}
          question={currentRoundId > 0 ? `Target: ${targetTimeStr}` : undefined}
          settlementPrice={
            status === 3 && roundData ? Number(roundData.settlementPrice) / 100 : undefined
          }
        />
      </div>

      {/* Admin Controls — only rendered when the connected wallet matches
          NEXT_PUBLIC_ADMIN_ADDRESS. Non-admins see nothing here at all. */}
      {ADMIN_ADDRESS && address?.toLowerCase() === ADMIN_ADDRESS ? (
      <div className="glass-card mb-6" style={{ padding: 16 }}>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", alignItems: "center" }}>
          <span className="font-mono text-xs text-muted" style={{ letterSpacing: 1 }}>ADMIN //</span>
          <button className="btn btn-primary btn-sm" onClick={() => handleAdminAction("create")}
            disabled={!!adminLoading || (status >= 0 && status < 3)}>
            {adminLoading === "create" ? "⏳ Creating round…" : "1. New Round"}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => handleAdminAction("predict")}
            disabled={!!adminLoading || status > 1}>
            {adminLoading === "predict" ? "⏳ Running AI… (~2 min)" : "2. Run Predictions"}
          </button>
          <button className="btn btn-sm" style={{
            background: "var(--neon-green)", color: "#000", fontFamily: "var(--font-display)",
            fontSize: 11, fontWeight: 700, letterSpacing: 1.5, padding: "8px 16px",
            border: "none", borderRadius: 8, cursor: "pointer",
            opacity: (!!adminLoading || status !== 2) ? 0.4 : 1,
          }} onClick={() => handleAdminAction("settle")} disabled={!!adminLoading || status !== 2}>
            {adminLoading === "settle" ? "⏳ Settling…" : "3. Settle"}
          </button>
        </div>

        {/* Staged progress during create round (~8s, one tx) */}
        {adminLoading === "create" ? (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(0,240,255,0.15)" }}>
            <div className="font-mono text-xs" style={{ color: "var(--neon-cyan)", marginBottom: 6, letterSpacing: 1 }}>
              {CREATE_STAGES[createStageIdx]?.label}
            </div>
            <div style={{
              height: 4, background: "rgba(0,240,255,0.1)", borderRadius: 2, overflow: "hidden",
            }}>
              <div style={{
                height: "100%",
                width: `${Math.min(100, ((createStageIdx + 1) / CREATE_STAGES.length) * 100)}%`,
                background: "linear-gradient(90deg, var(--neon-cyan), var(--neon-pink))",
                transition: "width 0.5s ease",
                boxShadow: "0 0 8px rgba(0,240,255,0.4)",
              }} />
            </div>
            <div className="font-mono text-xs text-muted" style={{ marginTop: 6, opacity: 0.6 }}>
              Step {createStageIdx + 1}/{CREATE_STAGES.length} · ~8s total
            </div>
          </div>
        ) : null}

        {/* Staged progress during predict — gives the user something to watch
            while ~2 min of AI inference + storage uploads happen server-side */}
        {adminLoading === "predict" ? (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(0,240,255,0.1)" }}>
            <div className="font-mono text-xs" style={{ color: "var(--neon-cyan)", marginBottom: 6, letterSpacing: 1 }}>
              {PREDICT_STAGES[predictStageIdx]?.label}
            </div>
            <div style={{
              height: 4, background: "rgba(0,240,255,0.1)", borderRadius: 2, overflow: "hidden",
            }}>
              <div style={{
                height: "100%",
                width: `${Math.min(100, ((predictStageIdx + 1) / PREDICT_STAGES.length) * 100)}%`,
                background: "linear-gradient(90deg, var(--neon-cyan), var(--neon-pink))",
                transition: "width 1s ease",
                boxShadow: "0 0 8px rgba(0,240,255,0.4)",
              }} />
            </div>
            <div className="font-mono text-xs text-muted" style={{ marginTop: 6, opacity: 0.6 }}>
              Step {predictStageIdx + 1}/{PREDICT_STAGES.length} · don't close this tab
            </div>
          </div>
        ) : null}

        {/* Staged progress during settle (~25s for 2 bots: 1 settleRound tx
            plus 1 updateBotStats tx per bot) */}
        {adminLoading === "settle" ? (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(57,255,20,0.15)" }}>
            <div className="font-mono text-xs" style={{ color: "var(--neon-green)", marginBottom: 6, letterSpacing: 1 }}>
              {SETTLE_STAGES[settleStageIdx]?.label}
            </div>
            <div style={{
              height: 4, background: "rgba(57,255,20,0.1)", borderRadius: 2, overflow: "hidden",
            }}>
              <div style={{
                height: "100%",
                width: `${Math.min(100, ((settleStageIdx + 1) / SETTLE_STAGES.length) * 100)}%`,
                background: "linear-gradient(90deg, var(--neon-green), var(--neon-cyan))",
                transition: "width 1s ease",
                boxShadow: "0 0 8px rgba(57,255,20,0.4)",
              }} />
            </div>
            <div className="font-mono text-xs text-muted" style={{ marginTop: 6, opacity: 0.6 }}>
              Step {settleStageIdx + 1}/{SETTLE_STAGES.length} · this is fast, hang on
            </div>
          </div>
        ) : null}

        {/* Success/error banner — auto-clears after 6s */}
        {actionMessage ? (
          <div
            style={{
              marginTop: 12,
              padding: "10px 14px",
              borderRadius: 6,
              background: actionMessage.kind === "success"
                ? "rgba(57,255,20,0.08)"
                : "rgba(255,45,120,0.08)",
              border: `1px solid ${actionMessage.kind === "success" ? "rgba(57,255,20,0.35)" : "rgba(255,45,120,0.35)"}`,
              color: actionMessage.kind === "success" ? "var(--neon-green)" : "var(--neon-pink)",
            }}
            className="font-mono text-xs"
          >
            {actionMessage.text}
          </div>
        ) : null}
      </div>
      ) : null}

      {/* Claim — only rendered for wallets with at least one winning bet
          (or any bet when the round had no winner and bets are refunded).
          Disabled once claimed; on-chain hasClaimed flag persists the
          disabled state across reloads, claimSuccess covers the gap before
          the chain read refreshes. */}
      {status === 3 && address && claimEligibility.canClaim ? (
        <div className="glass-card mb-6" style={{ padding: 16, textAlign: "center" }}>
          {(() => {
            const alreadyClaimed = hasClaimedOnChain === true || claimSuccess;
            const busy = claimPending || claimConfirming;
            const idleLabel = claimEligibility.isRefund ? "💰 Claim Refund" : "🏆 Claim Winnings";
            return (
              <>
                <button
                  className="btn btn-primary"
                  onClick={() => claimWinnings(currentRoundId)}
                  disabled={busy || alreadyClaimed}
                  style={alreadyClaimed ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
                >
                  {claimPending ? "✍ Confirm in wallet…"
                    : claimConfirming ? "⏳ Confirming on chain…"
                    : alreadyClaimed ? "✓ Already Claimed"
                    : idleLabel}
                </button>
                {alreadyClaimed ? (
                  <div className="text-green font-mono text-xs mt-2" style={{ opacity: 0.7 }}>
                    Claim recorded on-chain · this round is closed for {shortenAddress(address)}
                  </div>
                ) : null}
              </>
            );
          })()}
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
              totalWinScore={totalWinScore}
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
