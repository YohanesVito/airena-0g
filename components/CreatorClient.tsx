"use client";

import { useEffect, useMemo } from "react";
import { useAccount, useReadContracts } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { formatEther } from "viem";
import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  useBotsByCreator,
  useCreatorEarnings,
  useWithdrawCreatorEarnings,
  shortenAddress,
} from "@/hooks/useContracts";
import { CONTRACTS, BOT_REGISTRY_ABI } from "@/lib/contracts";

type BotStruct = {
  id: bigint;
  creator: string;
  name: string;
  storageHash: string;
  totalRounds: bigint;
  wins: bigint;
  totalScore: bigint;
  createdAt: bigint;
  active: boolean;
};

export default function CreatorClient() {
  const { address, isConnected } = useAccount();
  const queryClient = useQueryClient();

  const { data: botIdsRaw } = useBotsByCreator(address);
  const botIds = (botIdsRaw as bigint[] | undefined) ?? [];

  // Multicall getBot for each owned id so we can render the full struct
  // without N round-trips. Pattern mirrors useRoundPredictions in
  // hooks/useContracts.ts but stays inline because no other page needs it.
  const { data: botsRaw } = useReadContracts({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    contracts: botIds.map((id) => ({
      address: CONTRACTS.botRegistry as `0x${string}`,
      abi: BOT_REGISTRY_ABI,
      functionName: "getBot",
      args: [id],
    })) as any,
    query: { enabled: botIds.length > 0 },
  });

  const bots = useMemo<BotStruct[]>(() => {
    if (!botsRaw) return [];
    return botsRaw
      .map((r) => r.result as BotStruct | undefined)
      .filter((b): b is BotStruct => !!b && b.id !== 0n);
  }, [botsRaw]);

  const { data: earningsRaw } = useCreatorEarnings(address);
  const earningsWei = (earningsRaw as bigint | undefined) ?? 0n;
  const earningsFormatted = formatEther(earningsWei);
  const hasEarnings = earningsWei > 0n;

  const {
    withdraw,
    isPending: withdrawPending,
    isConfirming: withdrawConfirming,
    isSuccess: withdrawSuccess,
  } = useWithdrawCreatorEarnings();

  // After a successful withdraw, force every wagmi read to refetch so
  // earningsWei drops to 0 and the button becomes disabled without a
  // page reload.
  useEffect(() => {
    if (withdrawSuccess) {
      queryClient.invalidateQueries();
    }
  }, [withdrawSuccess, queryClient]);

  // Aggregate stats across all owned bots — feeds the top stats grid.
  const aggregate = useMemo(() => {
    let totalRounds = 0;
    let totalWins = 0;
    let totalScore = 0;
    let activeCount = 0;
    for (const bot of bots) {
      totalRounds += Number(bot.totalRounds);
      totalWins += Number(bot.wins);
      totalScore += Number(bot.totalScore);
      if (bot.active) activeCount++;
    }
    const winRate = totalRounds > 0 ? (totalWins / totalRounds) * 100 : 0;
    return { totalRounds, totalWins, totalScore, activeCount, winRate };
  }, [bots]);

  if (!isConnected || !address) {
    return (
      <main className="container section">
        <h1 className="section-title mb-2">
          <span className="text-cyan">⚙</span> Creator Dashboard
        </h1>
        <p className="section-subtitle font-mono">
          Track your bots, win rate, and 10% rev-share earnings.
        </p>

        <div className="glass-card" style={{ padding: 56, textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 16 }}>🔌</div>
          <p className="font-display text-sm" style={{ letterSpacing: 1, marginBottom: 16 }}>
            CONNECT WALLET TO VIEW DASHBOARD
          </p>
          <p className="font-mono text-xs text-muted mb-4">
            Your bots, stats, and claimable earnings will load once your wallet is connected.
          </p>
          <div className="flex justify-center mt-4">
            <ConnectButton />
          </div>
        </div>
      </main>
    );
  }

  const withdrawBusy = withdrawPending || withdrawConfirming;
  const withdrawLabel = withdrawPending
    ? "✍ Confirm in wallet…"
    : withdrawConfirming
      ? "⏳ Confirming on chain…"
      : !hasEarnings
        ? "Nothing to withdraw"
        : `💰 Withdraw ${earningsFormatted} 0G`;

  return (
    <main className="container section">
      <h1 className="section-title mb-2">
        <span className="text-cyan">⚙</span> Creator Dashboard
      </h1>
      <p className="section-subtitle font-mono">
        {shortenAddress(address)} · {botIds.length} bot{botIds.length === 1 ? "" : "s"} registered
      </p>

      {/* Aggregate stats */}
      <div className="stats-grid mb-6">
        <div className="stat-card glass-card">
          <div className="stat-value">{aggregate.activeCount}</div>
          <div className="stat-label">Active Bots</div>
        </div>
        <div className="stat-card glass-card">
          <div className="stat-value">{aggregate.totalRounds}</div>
          <div className="stat-label">Rounds Fought</div>
        </div>
        <div className="stat-card glass-card">
          <div className="stat-value">
            {aggregate.totalRounds > 0 ? `${aggregate.winRate.toFixed(0)}%` : "—"}
          </div>
          <div className="stat-label">Avg Win Rate</div>
        </div>
        <div className="stat-card glass-card">
          <div className="stat-value text-pink">{aggregate.totalWins}</div>
          <div className="stat-label">Wins Total</div>
        </div>
      </div>

      {/* Earnings card */}
      <div
        className="glass-card mb-6"
        style={{ padding: 24, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}
      >
        <div>
          <div className="font-mono text-xs text-muted" style={{ letterSpacing: 2, textTransform: "uppercase" }}>
            Claimable Earnings
          </div>
          <div
            className="font-display"
            style={{
              fontSize: 32,
              fontWeight: 900,
              color: hasEarnings ? "var(--neon-green)" : "var(--text-muted)",
              textShadow: hasEarnings ? "var(--glow-green)" : undefined,
              letterSpacing: 2,
              marginTop: 4,
            }}
          >
            {earningsFormatted} <span style={{ fontSize: 14, opacity: 0.7 }}>0G</span>
          </div>
          <div className="font-mono text-xs text-muted mt-2">
            Accrues at 10% of every round your bot wins. Withdraw any time.
          </div>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => withdraw()}
          disabled={withdrawBusy || !hasEarnings}
          style={!hasEarnings ? { opacity: 0.4, cursor: "not-allowed" } : undefined}
        >
          {withdrawLabel}
        </button>
      </div>

      {/* Bots list */}
      <h2 className="font-display mb-4" style={{ fontSize: 14, letterSpacing: 2, textTransform: "uppercase" }}>
        <span className="text-pink">⟐</span> My Bots
      </h2>

      {bots.length === 0 ? (
        <div className="glass-card" style={{ padding: 56, textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🤖</div>
          <p className="font-display text-sm text-muted" style={{ letterSpacing: 1 }}>
            NO BOTS REGISTERED
          </p>
          <p className="font-mono text-xs text-muted mt-2 mb-4">
            Build your first bot, ship a strategy prompt to 0G Storage, and start earning.
          </p>
          <Link href="/create" className="btn btn-primary btn-sm">
            ⚡ Create your first bot
          </Link>
        </div>
      ) : (
        <div className="glass-card table-container">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Bot</th>
                <th>Status</th>
                <th>Rounds</th>
                <th>Wins</th>
                <th>Win Rate</th>
                <th>Avg Score</th>
                <th>Storage</th>
              </tr>
            </thead>
            <tbody>
              {bots.map((bot) => {
                const rounds = Number(bot.totalRounds);
                const wins = Number(bot.wins);
                const winRate = rounds > 0 ? ((wins / rounds) * 100).toFixed(1) : "—";
                const avgScore = rounds > 0 ? (Number(bot.totalScore) / rounds).toFixed(1) : "—";
                const winRateColor =
                  rounds === 0
                    ? "var(--text-muted)"
                    : wins / rounds >= 0.5
                      ? "var(--neon-green)"
                      : "var(--neon-pink)";
                return (
                  <tr key={bot.id.toString()}>
                    <td>
                      <span className="font-mono text-muted">#{bot.id.toString()}</span>
                    </td>
                    <td>
                      <span className="font-display" style={{ fontSize: 13, letterSpacing: 0.5 }}>
                        {bot.name}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`badge ${bot.active ? "badge-green" : ""}`}
                        style={{ fontSize: 10 }}
                      >
                        {bot.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>{rounds}</td>
                    <td>{wins}</td>
                    <td>
                      <span style={{ color: winRateColor }}>
                        {winRate}
                        {rounds > 0 ? "%" : ""}
                      </span>
                    </td>
                    <td>{avgScore}</td>
                    <td>
                      <span className="font-mono text-muted" style={{ fontSize: 11 }}>
                        {bot.storageHash.slice(0, 10)}…
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex gap-6 mt-4 justify-center">
        <span className="font-mono text-xs text-muted">
          All stats read live from{" "}
          <span className="text-cyan">BotRegistry</span>. Earnings settle on{" "}
          <span className="text-cyan">claimWinnings()</span>.
        </span>
      </div>
    </main>
  );
}
