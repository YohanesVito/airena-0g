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

type UserBetRow = {
  round: number;
  botId: bigint;
  amount: bigint;
  claimed: boolean;
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

  // Filter to bets owned by the connected wallet, sorted newest first.
  const userBets = useMemo<UserBetRow[]>(() => {
    if (!allBetsRaw) return [];
    const out: UserBetRow[] = [];
    for (let i = 0; i < allBetsRaw.length; i++) {
      const bet = allBetsRaw[i]?.result as BetTuple | undefined;
      if (!bet || bet.bettor.toLowerCase() !== address.toLowerCase()) continue;
      out.push({
        round: betIndexes[i].round,
        botId: bet.botId,
        amount: bet.amount,
        claimed: bet.claimed,
      });
    }
    return out.sort((a, b) => b.round - a.round);
  }, [allBetsRaw, betIndexes, address]);

  // Stage 3: resolve unique bot ids in user history to names.
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

  // Aggregate: total staked, total claimed, count.
  const totals = useMemo(() => {
    let totalStakedWei = 0n;
    let claimedCount = 0;
    for (const b of userBets) {
      totalStakedWei += b.amount;
      if (b.claimed) claimedCount++;
    }
    return { totalStakedWei, claimedCount, count: userBets.length };
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
              <div className="stat-value text-cyan">{totals.claimedCount}</div>
              <div className="stat-label">Already Claimed</div>
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
                        {bet.claimed ? (
                          <span className="badge badge-cyan" style={{ fontSize: 10 }}>
                            CLAIMED
                          </span>
                        ) : (
                          <span className="badge" style={{ fontSize: 10, opacity: 0.6 }}>
                            PENDING
                          </span>
                        )}
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
