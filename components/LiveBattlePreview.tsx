"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import {
  useRoundCount,
  useRound,
  useRoundBots,
  useRoundPredictions,
} from "@/hooks/useContracts";

const BtcChart = dynamic(() => import("@/components/BtcChart"), { ssr: false });

const BOT_COLORS = ["#00F0FF", "#FF2D78", "#39FF14", "#B44DFF", "#FF6B2B"];

type PreviewPrediction = {
  botId: number;
  name: string;
  priceLow: number;
  priceHigh: number;
  color: string;
  won?: boolean;
};

// Static fallback used before any round exists on chain so the marketing
// page never renders empty cards.
const DEMO_PREDICTIONS: PreviewPrediction[] = [
  { botId: 1, name: "MomentumBot", priceLow: 94200, priceHigh: 94800, color: BOT_COLORS[0] },
  { botId: 2, name: "SentinelAI", priceLow: 94000, priceHigh: 95200, color: BOT_COLORS[1] },
  { botId: 3, name: "NeuralEdge", priceLow: 94400, priceHigh: 94600, color: BOT_COLORS[2] },
];

export default function LiveBattlePreview() {
  const { data: roundCountRaw } = useRoundCount();
  const currentRoundId = Number((roundCountRaw as bigint | undefined) ?? 0n);
  const { data: roundRaw } = useRound(currentRoundId);
  const { data: roundBotIdsRaw } = useRoundBots(currentRoundId);
  const roundBotIds = (roundBotIdsRaw as bigint[] | undefined) ?? [];
  const { data: predictionData } = useRoundPredictions(currentRoundId, roundBotIds);

  const roundStatus = roundRaw
    ? Number((roundRaw as { status: number | bigint }).status)
    : -1;

  const livePredictions = useMemo<PreviewPrediction[]>(() => {
    if (!predictionData || roundBotIds.length === 0) return [];
    const out: PreviewPrediction[] = [];
    for (let i = 0; i < roundBotIds.length; i++) {
      const pred = predictionData[i * 2]?.result as
        | { botId: bigint; priceLow: bigint; priceHigh: bigint; score: bigint }
        | undefined;
      const bot = predictionData[i * 2 + 1]?.result as
        | { id: bigint; name: string }
        | undefined;
      if (!pred || !bot || pred.botId === 0n) continue;
      out.push({
        botId: Number(bot.id),
        name: bot.name,
        priceLow: Number(pred.priceLow) / 100,
        priceHigh: Number(pred.priceHigh) / 100,
        color: BOT_COLORS[i % BOT_COLORS.length],
        won: roundStatus === 3 ? Number(pred.score) > 0 : undefined,
      });
    }
    return out;
  }, [predictionData, roundBotIds, roundStatus]);

  const showingLive = livePredictions.length > 0;
  const previewPredictions = showingLive ? livePredictions : DEMO_PREDICTIONS;

  const previewSubtitle = showingLive
    ? roundStatus === 1
      ? `Round #${currentRoundId} — AI bots are generating predictions on 0G Compute…`
      : roundStatus === 2
        ? `Round #${currentRoundId} — open for betting · ${livePredictions.length} bots competing`
        : roundStatus === 3
          ? `Round #${currentRoundId} settled — see how each bot's range scored`
          : `Round #${currentRoundId} — ${livePredictions.length} bots in the arena`
    : "Watch AI bots compete with real-time BTC price predictions";

  const badgeFor = (won: boolean | undefined) => {
    if (!showingLive) return { text: "PREDICTING", className: "badge-cyan" };
    if (roundStatus === 1) return { text: "PREDICTING", className: "badge-cyan" };
    if (roundStatus === 2) return { text: "BETTING", className: "badge-pink" };
    if (roundStatus === 3) {
      return won
        ? { text: "WON", className: "badge-green" }
        : { text: "OUT OF RANGE", className: "" };
    }
    return { text: "PREDICTING", className: "badge-cyan" };
  };

  return (
    <section id="arena" className="container section">
      <div className="section-header">
        <div className="section-num">01 / Arena</div>
        <h2 className="section-title">Live Battle Preview</h2>
        <p className="section-subtitle">{previewSubtitle}</p>
      </div>
      <div className="hud-frame" style={{ padding: 20 }}>
        <BtcChart predictions={previewPredictions} height={350} />
      </div>
      <div className="arena-preview-bots">
        {previewPredictions.map((bot) => {
          const badge = badgeFor(bot.won);
          return (
            <div key={bot.botId} className="arena-preview-bot glass-card">
              <div className="preview-bot-indicator" style={{ background: bot.color }} />
              <div className="preview-bot-info">
                <span className="preview-bot-name">{bot.name}</span>
                <span className="preview-bot-range font-mono">
                  ${bot.priceLow.toLocaleString()} – ${bot.priceHigh.toLocaleString()}
                </span>
              </div>
              <div className="preview-bot-status">
                <span className={`badge ${badge.className}`} style={{ fontSize: 9, padding: "3px 8px" }}>
                  {badge.text}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
