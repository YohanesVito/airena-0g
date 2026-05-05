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
    <section style={{ marginTop: 64 }}>
      <header style={{ marginBottom: 32 }}>
        <div className="section-num">02 / Wallet</div>
        <h2
          className="font-display"
          style={{
            fontSize: "clamp(40px, 6vw, 72px)",
            lineHeight: 0.92,
            letterSpacing: -1,
            textTransform: "uppercase",
            margin: 0,
            color: "var(--text-primary)",
          }}
        >
          Bet History
        </h2>
        <p
          className="font-mono"
          style={{
            marginTop: 14,
            fontSize: 11,
            color: "var(--text-muted)",
            letterSpacing: 2,
            textTransform: "uppercase",
          }}
        >
          // Last {scanRounds.length} round{scanRounds.length === 1 ? "" : "s"} scanned
          {totals.actionable > 0 && (
            <span style={{ color: "var(--accent)", marginLeft: 18 }}>
              · {totals.actionable} ready to claim
            </span>
          )}
        </p>
      </header>

      {userBets.length === 0 ? (
        <div
          style={{
            padding: "64px 32px",
            border: "1px solid var(--border-color)",
            borderRadius: "var(--radius-md)",
            background: "var(--bg-card)",
          }}
        >
          <div
            className="font-mono"
            style={{
              fontSize: 11,
              letterSpacing: 2,
              color: "var(--text-muted)",
              marginBottom: 16,
              textTransform: "uppercase",
            }}
          >
            // Status: No_bets_found
          </div>
          <p
            className="font-display"
            style={{
              fontSize: 32,
              letterSpacing: 0,
              textTransform: "uppercase",
              lineHeight: 1,
              marginBottom: 16,
              color: "var(--text-primary)",
            }}
          >
            Stand back. Nothing on the line.
          </p>
          <p style={{ color: "var(--text-secondary)", maxWidth: 460, lineHeight: 1.6 }}>
            Your wallet hasn&apos;t placed any bets in the last {ROUNDS_TO_SCAN} rounds. Pick a bot
            in the arena to back the next prediction.
          </p>
        </div>
      ) : (
        <>
          <div
            className="stats-grid mb-6"
            style={{ gridTemplateColumns: "repeat(3, 1fr)" }}
          >
            <Stat label="Bets placed" value={totals.count} />
            <Stat label="Total staked / 0G" value={formatStake(totals.totalStakedWei)} />
            <Stat
              label="Ready to claim"
              value={totals.actionable}
              accent={totals.actionable > 0}
            />
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 96 }}>Round</th>
                  <th>Bot</th>
                  <th>Stake / 0G</th>
                  <th style={{ textAlign: "right" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {userBets.map((bet, i) => {
                  const botName =
                    botNameById.get(bet.botId.toString()) ?? `bot #${bet.botId.toString()}`;
                  return (
                    <tr key={`${bet.round}-${i}`}>
                      <td style={{ color: "var(--text-muted)" }}>
                        #{bet.round.toString().padStart(3, "0")}
                      </td>
                      <td>
                        <div
                          className="font-display"
                          style={{
                            fontSize: 15,
                            letterSpacing: 1,
                            textTransform: "uppercase",
                            color: "var(--text-primary)",
                          }}
                        >
                          {botName}
                        </div>
                        <div
                          className="font-mono"
                          style={{
                            fontSize: 10,
                            color: "var(--text-muted)",
                            marginTop: 2,
                            letterSpacing: 1,
                          }}
                        >
                          ID: {bet.botId.toString()}
                        </div>
                      </td>
                      <td style={{ color: "var(--text-primary)" }}>{formatStake(bet.amount)}</td>
                      <td style={{ textAlign: "right" }}>
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
    </section>
  );
}

function Stat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div
        className="stat-value"
        style={accent ? { color: "var(--accent)" } : undefined}
      >
        {value}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: BetStatus }) {
  // WIN and REFUND are the only states with an action attached, so they
  // get the loud red accent. Settled-positive (CLAIMED/REFUNDED) get a
  // neutral hairline pill. LOST gets ghosted so it doesn't compete.
  // PENDING shows a pulsing live dot — the round hasn't settled yet.
  const meta: Record<
    BetStatus,
    { label: string; tone: "accent" | "neutral" | "ghost" | "live" }
  > = {
    WIN:      { label: "Claimable",     tone: "accent" },
    REFUND:   { label: "Refund ready",  tone: "accent" },
    CLAIMED:  { label: "Claimed",       tone: "neutral" },
    REFUNDED: { label: "Refunded",      tone: "neutral" },
    LOST:     { label: "Lost",          tone: "ghost" },
    PENDING:  { label: "Pending",       tone: "live" },
  };
  const m = meta[status];

  const base: React.CSSProperties = {
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    padding: "5px 10px",
    borderRadius: "var(--radius-sm)",
    border: "1px solid transparent",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    whiteSpace: "nowrap",
  };

  if (m.tone === "accent") {
    return (
      <span
        style={{
          ...base,
          color: "var(--accent)",
          background: "var(--accent-soft)",
          borderColor: "var(--border-accent)",
        }}
      >
        {m.label}
      </span>
    );
  }
  if (m.tone === "neutral") {
    return (
      <span
        style={{
          ...base,
          color: "var(--text-secondary)",
          background: "rgba(255,255,255,0.04)",
          borderColor: "var(--border-color)",
        }}
      >
        {m.label}
      </span>
    );
  }
  if (m.tone === "live") {
    return (
      <span
        style={{
          ...base,
          color: "var(--text-secondary)",
          background: "transparent",
          borderColor: "var(--border-color)",
        }}
      >
        <span className="status-dot live" />
        {m.label}
      </span>
    );
  }
  return (
    <span
      style={{
        ...base,
        color: "var(--text-faint)",
        background: "transparent",
        borderColor: "var(--border-color)",
      }}
    >
      {m.label}
    </span>
  );
}
