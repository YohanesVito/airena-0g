"use client";

import { useMemo } from "react";
import { useReadContracts } from "wagmi";
import { formatEther } from "viem";
import { useRoundCount } from "@/hooks/useContracts";
import { CONTRACTS, BETTING_POOL_ABI, BOT_REGISTRY_ABI } from "@/lib/contracts";

const bettingPoolAddress = CONTRACTS.bettingPool as `0x${string}`;
const botRegistryAddress = CONTRACTS.botRegistry as `0x${string}`;

// Cap how many recent rounds we scan. The contract has no
// getBetsByBettor view, so we have to multicall every round's full
// Bet list and filter client-side. Keeping this bounded prevents the
// dashboard from making thousands of reads on a busy season.
const ROUNDS_TO_SCAN = 10;

type BetStatus = "PENDING" | "WIN" | "CLAIMED" | "REFUND" | "REFUNDED" | "LOST";

type UserBetRow = {
  round: number;
  botId: bigint;
  amount: bigint;
  claimed: boolean;
  status: BetStatus;
};

type BetTuple = {
  bettor: string;
  botId: bigint;
  amount: bigint;
  claimed: boolean;
};

export default function BetHistory({ address }: { address: `0x${string}` }) {
  const { data: roundCountRaw } = useRoundCount();
  const latestRoundId = Number((roundCountRaw as bigint | undefined) ?? 0n);

  const scanRounds = useMemo(() => {
    if (latestRoundId <= 0) return [] as number[];
    const start = Math.max(1, latestRoundId - ROUNDS_TO_SCAN + 1);
    const out: number[] = [];
    for (let r = start; r <= latestRoundId; r++) out.push(r);
    return out;
  }, [latestRoundId]);

  // Stage 1: per-round bet counts — feeds the second multicall.
  const { data: betCountsRaw } = useReadContracts({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    contracts: scanRounds.map((r) => ({
      address: bettingPoolAddress,
      abi: BETTING_POOL_ABI,
      functionName: "getRoundBetCount",
      args: [BigInt(r)],
    })) as any,
    query: { enabled: scanRounds.length > 0 },
  });

  // Build flat (round, betIndex) pairs.
  const betIndexes = useMemo(() => {
    if (!betCountsRaw) return [] as { round: number; idx: number }[];
    const out: { round: number; idx: number }[] = [];
    for (let i = 0; i < scanRounds.length; i++) {
      const c = Number((betCountsRaw[i]?.result as bigint | undefined) ?? 0n);
      for (let j = 0; j < c; j++) out.push({ round: scanRounds[i], idx: j });
    }
    return out;
  }, [betCountsRaw, scanRounds]);

  // Stage 2: fetch every Bet across the scan window.
  const { data: allBetsRaw } = useReadContracts({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    contracts: betIndexes.map((b) => ({
      address: bettingPoolAddress,
      abi: BETTING_POOL_ABI,
      functionName: "getBet",
      args: [BigInt(b.round), BigInt(b.idx)],
    })) as any,
    query: { enabled: betIndexes.length > 0 },
  });

  // Pre-filter user-owned bets, indexed by (round, botId) so we can
  // attach status once we know each round's settlement state and the
  // bet's bot's score.
  const userBetsRaw = useMemo(() => {
    if (!allBetsRaw) return [] as { round: number; bet: BetTuple }[];
    const out: { round: number; bet: BetTuple }[] = [];
    for (let i = 0; i < allBetsRaw.length; i++) {
      const bet = allBetsRaw[i]?.result as BetTuple | undefined;
      if (!bet || bet.bettor.toLowerCase() !== address.toLowerCase()) continue;
      out.push({ round: betIndexes[i].round, bet });
    }
    return out;
  }, [allBetsRaw, betIndexes, address]);

  // Stage 3: for each unique round the user has a bet in, fetch round
  // status + the round's full bot list. Status drives PENDING vs LOST,
  // bot list drives Stage 4's predictions multicall that decides
  // per-round totalWinScore (refund vs lost) and per-bet score (won
  // vs not).
  const uniqueRounds = useMemo(() => {
    const set = new Set<number>();
    for (const b of userBetsRaw) set.add(b.round);
    return [...set].sort((a, b) => a - b);
  }, [userBetsRaw]);

  const roundContracts = useMemo(() => {
    return uniqueRounds.flatMap((r) => [
      {
        address: bettingPoolAddress,
        abi: BETTING_POOL_ABI,
        functionName: "getRound",
        args: [BigInt(r)],
      },
      {
        address: bettingPoolAddress,
        abi: BETTING_POOL_ABI,
        functionName: "getRoundBots",
        args: [BigInt(r)],
      },
    ]);
  }, [uniqueRounds]);

  const { data: roundDataRaw } = useReadContracts({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    contracts: roundContracts as any,
    query: { enabled: roundContracts.length > 0 },
  });

  // Stage 4: flatten (round, botId) prediction lookups so a single
  // multicall covers every bot in every round the user touched. The
  // user's bet score and the round's totalWinScore both fall out.
  const predictionLookups = useMemo(() => {
    if (!roundDataRaw) return [] as { round: number; botId: bigint }[];
    const out: { round: number; botId: bigint }[] = [];
    for (let i = 0; i < uniqueRounds.length; i++) {
      const bots = roundDataRaw[i * 2 + 1]?.result as bigint[] | undefined;
      if (!bots) continue;
      for (const bid of bots) out.push({ round: uniqueRounds[i], botId: bid });
    }
    return out;
  }, [roundDataRaw, uniqueRounds]);

  const { data: predictionsRaw } = useReadContracts({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    contracts: predictionLookups.map((p) => ({
      address: bettingPoolAddress,
      abi: BETTING_POOL_ABI,
      functionName: "getPrediction",
      args: [BigInt(p.round), p.botId],
    })) as any,
    query: { enabled: predictionLookups.length > 0 },
  });

  // Build round → { status, totalWinScore, scoreByBotId } so the bet
  // status derivation below is a constant-time lookup.
  const roundInfo = useMemo(() => {
    const m = new Map<
      number,
      { status: number; totalWinScore: number; scoreByBotId: Map<string, number> }
    >();
    if (!roundDataRaw) return m;
    for (let i = 0; i < uniqueRounds.length; i++) {
      const round = uniqueRounds[i];
      const r = roundDataRaw[i * 2]?.result as { status: number | bigint } | undefined;
      const status = r ? Number(r.status) : -1;
      m.set(round, { status, totalWinScore: 0, scoreByBotId: new Map() });
    }
    if (!predictionsRaw) return m;
    for (let i = 0; i < predictionLookups.length; i++) {
      const { round, botId } = predictionLookups[i];
      const pred = predictionsRaw[i]?.result as { score?: bigint } | undefined;
      const score = Number(pred?.score ?? 0n);
      const bucket = m.get(round);
      if (!bucket) continue;
      bucket.scoreByBotId.set(botId.toString(), score);
      if (score > 0) bucket.totalWinScore += score;
    }
    return m;
  }, [roundDataRaw, predictionsRaw, uniqueRounds, predictionLookups]);

  // Final user-bet rows with derived status, sorted newest first.
  const userBets = useMemo<UserBetRow[]>(() => {
    const out: UserBetRow[] = [];
    for (const { round, bet } of userBetsRaw) {
      const info = roundInfo.get(round);
      let status: BetStatus = "PENDING";
      if (info && info.status === 3) {
        const myScore = info.scoreByBotId.get(bet.botId.toString()) ?? 0;
        if (myScore > 0) {
          status = bet.claimed ? "CLAIMED" : "WIN";
        } else if (info.totalWinScore === 0) {
          // No bot won → contract refunds every bet in this round.
          status = bet.claimed ? "REFUNDED" : "REFUND";
        } else {
          status = "LOST";
        }
      }
      out.push({
        round,
        botId: bet.botId,
        amount: bet.amount,
        claimed: bet.claimed,
        status,
      });
    }
    return out.sort((a, b) => b.round - a.round);
  }, [userBetsRaw, roundInfo]);

  // Stage 5: resolve unique bot ids in user history to names.
  const uniqueBotIds = useMemo(() => {
    const seen = new Set<string>();
    const out: bigint[] = [];
    for (const b of userBets) {
      const key = b.botId.toString();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(b.botId);
    }
    return out;
  }, [userBets]);

  const { data: betBotsRaw } = useReadContracts({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    contracts: uniqueBotIds.map((id) => ({
      address: botRegistryAddress,
      abi: BOT_REGISTRY_ABI,
      functionName: "getBot",
      args: [id],
    })) as any,
    query: { enabled: uniqueBotIds.length > 0 },
  });

  const botNameById = useMemo(() => {
    const m = new Map<string, string>();
    if (!betBotsRaw) return m;
    for (let i = 0; i < uniqueBotIds.length; i++) {
      const b = betBotsRaw[i]?.result as { name?: string } | undefined;
      if (b?.name) m.set(uniqueBotIds[i].toString(), b.name);
    }
    return m;
  }, [betBotsRaw, uniqueBotIds]);

  // Aggregate: total staked, count, and the only status bucket that
  // actually requires user action — winnable + refundable bets that
  // haven't been claimed yet. Bettors care more about "what can I
  // collect" than the raw claimed count.
  const totals = useMemo(() => {
    let totalStakedWei = 0n;
    let actionable = 0;
    for (const b of userBets) {
      totalStakedWei += b.amount;
      if (b.status === "WIN" || b.status === "REFUND") actionable++;
    }
    return { totalStakedWei, actionable, count: userBets.length };
  }, [userBets]);

  const formatStake = (wei: bigint) => {
    const n = Number(formatEther(wei));
    if (n === 0) return "0";
    if (n < 0.0001) return "<0.0001";
    return n.toFixed(4);
  };

  return (
    <>
      <h2 className="font-display mb-4 mt-6" style={{ fontSize: 14, letterSpacing: 2, textTransform: "uppercase" }}>
        Bet History
        <span className="font-mono text-xs text-muted" style={{ marginLeft: 12, fontWeight: 400 }}>
          last {scanRounds.length} round{scanRounds.length === 1 ? "" : "s"}
        </span>
      </h2>

      {userBets.length === 0 ? (
        <div className="glass-card" style={{ padding: 36, textAlign: "center" }}>
          <p className="font-display text-sm text-muted" style={{ letterSpacing: 1 }}>
            NO BETS PLACED
          </p>
          <p className="font-mono text-xs text-muted mt-2">
            Your wallet hasn&apos;t placed any bets in the last {ROUNDS_TO_SCAN} rounds. Head to the arena to back a bot.
          </p>
        </div>
      ) : (
        <>
          <div className="stats-grid mb-4" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
            <div className="stat-card glass-card">
              <div className="stat-value">{totals.count}</div>
              <div className="stat-label">Bets Placed</div>
            </div>
            <div className="stat-card glass-card">
              <div className="stat-value text-green">{formatStake(totals.totalStakedWei)}</div>
              <div className="stat-label">Total Staked (0G)</div>
            </div>
            <div className="stat-card glass-card">
              <div
                className={totals.actionable > 0 ? "stat-value text-green" : "stat-value text-muted"}
              >
                {totals.actionable}
              </div>
              <div className="stat-label">Ready to Claim</div>
            </div>
          </div>

          <div className="glass-card table-container">
            <table>
              <thead>
                <tr>
                  <th>Round</th>
                  <th>Bot</th>
                  <th>Stake</th>
                  <th>Claim</th>
                </tr>
              </thead>
              <tbody>
                {userBets.map((bet, i) => {
                  const botName = botNameById.get(bet.botId.toString()) ?? `bot #${bet.botId.toString()}`;
                  return (
                    <tr key={`${bet.round}-${i}`}>
                      <td>
                        <span className="font-mono">#{bet.round}</span>
                      </td>
                      <td>
                        <span className="font-display" style={{ fontSize: 13, letterSpacing: 0.5 }}>
                          {botName}
                        </span>
                        <span className="font-mono text-muted" style={{ fontSize: 10, marginLeft: 6 }}>
                          (#{bet.botId.toString()})
                        </span>
                      </td>
                      <td>
                        <span className="font-mono text-green">{formatStake(bet.amount)} 0G</span>
                      </td>
                      <td>
                        <StatusBadge status={bet.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

function StatusBadge({ status }: { status: BetStatus }) {
  // Map each bet status to a badge class + label. WIN and REFUND are
  // the actionable states (user has 0G to collect); CLAIMED/REFUNDED
  // are settled-positive; LOST is settled-negative; PENDING means the
  // round hasn't settled yet.
  const meta: Record<BetStatus, { className: string; label: string; opacity?: number }> = {
    WIN: { className: "badge-green", label: "WIN — CLAIMABLE" },
    CLAIMED: { className: "badge-cyan", label: "CLAIMED" },
    REFUND: { className: "badge-pink", label: "REFUND READY" },
    REFUNDED: { className: "badge-cyan", label: "REFUNDED" },
    LOST: { className: "", label: "LOST", opacity: 0.5 },
    PENDING: { className: "", label: "PENDING", opacity: 0.6 },
  };
  const m = meta[status];
  return (
    <span
      className={`badge ${m.className}`}
      style={{ fontSize: 10, opacity: m.opacity ?? 1 }}
    >
      {m.label}
    </span>
  );
}
