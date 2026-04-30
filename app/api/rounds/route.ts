import { NextRequest } from "next/server";
import { ethers } from "ethers";
import { CONTRACTS, BETTING_POOL_ABI, BOT_REGISTRY_ABI } from "@/lib/contracts";
import { runBotInference, priceToCents } from "@/lib/0g-compute";
import { storeReasoningTrace, storeJudgeTrace, getBotPrompt } from "@/lib/0g-storage";
import { runJudgeInference, renderZonesForBotPrompt, type JudgeOutput } from "@/lib/0g-judge";

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://evmrpc-testnet.0g.ai";

// In-memory cache: judge outputs by roundId. Volatile across server restarts;
// fine for the hackathon demo since rounds are settled within one session.
// The full reasoning trace is durable on 0G Storage; only the rootHash mapping
// is volatile.
type CachedJudge = JudgeOutput & { traceHash: string };
const judgeCache = new Map<number, CachedJudge>();

// Cap how many bots compete per round. Keeps predict latency predictable
// (each bot adds ~30-50s of inference + storage upload) and prevents the
// bettor pool from getting diluted across an unbounded set.
const MAX_BOTS_PER_ROUND = 5;

// Bot returned by BotRegistry.getActiveBots — accessed by named field via
// ethers Result. We narrow the shape we actually use here.
interface ActiveBot {
  id: bigint;
  creator: string;
  name: string;
  storageHash: string;
  totalRounds: bigint;
  wins: bigint;
}

/**
 * Pick which bots compete in a round when more than MAX_BOTS_PER_ROUND are
 * active. Strategy: top (MAX-1) by win rate (with totalRounds as tiebreaker
 * so proven bots beat lucky-but-untested ones), plus 1 reserved slot for the
 * newest registered bot — guarantees newcomers can prove themselves instead
 * of being permanently locked out by the leaderboard.
 */
function selectBotsForRound(active: ActiveBot[]): ActiveBot[] {
  if (active.length <= MAX_BOTS_PER_ROUND) return active;

  const ranked = [...active].sort((a, b) => {
    const ra = Number(a.totalRounds) > 0 ? Number(a.wins) / Number(a.totalRounds) : 0;
    const rb = Number(b.totalRounds) > 0 ? Number(b.wins) / Number(b.totalRounds) : 0;
    if (rb !== ra) return rb - ra;
    return Number(b.totalRounds) - Number(a.totalRounds);
  });

  const top = ranked.slice(0, MAX_BOTS_PER_ROUND - 1);
  const topIds = new Set(top.map((b) => Number(b.id)));
  const newcomer = active
    .filter((b) => !topIds.has(Number(b.id)))
    .sort((a, b) => Number(b.id) - Number(a.id))[0];

  return newcomer ? [...top, newcomer] : ranked.slice(0, MAX_BOTS_PER_ROUND);
}

function getServerWallet() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
  return { provider, wallet };
}

/**
 * GET /api/rounds — Get current round info
 */
export async function GET(request: NextRequest) {
  try {
    const { provider } = getServerWallet();

    const bettingPool = new ethers.Contract(
      CONTRACTS.bettingPool,
      BETTING_POOL_ABI,
      provider
    );

    const roundCount = await bettingPool.roundCount();
    if (roundCount === 0n) {
      return Response.json({ round: null, predictions: [], bots: [] });
    }

    const currentRoundId = Number(roundCount);
    const round = await bettingPool.getRound(currentRoundId);
    const botIds = await bettingPool.getRoundBots(currentRoundId);

    // Fetch predictions for each bot
    const predictions = await Promise.all(
      botIds.map(async (botId: bigint) => {
        const pred = await bettingPool.getPrediction(currentRoundId, botId);
        const poolSize = await bettingPool.botPoolSize(currentRoundId, botId);
        return {
          botId: Number(botId),
          priceLow: Number(pred.priceLow),
          priceHigh: Number(pred.priceHigh),
          reasoningHash: pred.reasoningHash,
          score: Number(pred.score),
          scored: pred.scored,
          totalBets: ethers.formatEther(poolSize),
        };
      })
    );

    // Fetch bot info from BotRegistry
    const botRegistry = new ethers.Contract(
      CONTRACTS.botRegistry,
      BOT_REGISTRY_ABI,
      provider
    );

    const bots = await Promise.all(
      botIds.map(async (botId: bigint) => {
        const bot = await botRegistry.getBot(botId);
        return {
          id: Number(bot.id),
          creator: bot.creator,
          name: bot.name,
          storageHash: bot.storageHash,
          totalRounds: Number(bot.totalRounds),
          wins: Number(bot.wins),
          winRate: bot.totalRounds > 0n
            ? Number((bot.wins * 100n) / bot.totalRounds)
            : 0,
          active: bot.active,
        };
      })
    );

    return Response.json({
      round: {
        id: currentRoundId,
        startTime: Number(round.startTime),
        endTime: Number(round.endTime),
        settlementPrice: Number(round.settlementPrice),
        totalPool: ethers.formatEther(round.totalPool),
        status: Number(round.status), // 0=OPEN, 1=PREDICTING, 2=BETTING, 3=SETTLED
      },
      predictions,
      bots,
      judge: judgeCache.get(currentRoundId) ?? null,
    });
  } catch (error) {
    console.error("[/api/rounds GET] Error:", error);
    return Response.json({ error: String(error) }, { status: 500 });
  }
}

/**
 * POST /api/rounds — Round lifecycle actions
 * Body: { action: "create" | "predict" | "settle" }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    const { provider, wallet } = getServerWallet();

    const bettingPool = new ethers.Contract(
      CONTRACTS.bettingPool,
      BETTING_POOL_ABI,
      wallet
    );

    const botRegistry = new ethers.Contract(
      CONTRACTS.botRegistry,
      BOT_REGISTRY_ABI,
      provider
    );

    switch (action) {
      case "create": {
        const tx = await bettingPool.createRound();
        const receipt = await tx.wait();
        const roundCount = await bettingPool.roundCount();

        return Response.json({
          success: true,
          roundId: Number(roundCount),
          txHash: receipt.hash,
        });
      }

      case "predict": {
        // Get current round
        const roundCount = await bettingPool.roundCount();
        const roundId = Number(roundCount);

        // Get all active bots, then narrow to the round's competitor set.
        const allActive = (await botRegistry.getActiveBots()) as ActiveBot[];

        if (allActive.length === 0) {
          return Response.json({ error: "No active bots" }, { status: 400 });
        }

        if (allActive.length < 2) {
          return Response.json({
            error: "Minimum 2 active bots required to run a round. Register more bots first.",
          }, { status: 400 });
        }

        const activeBots = selectBotsForRound(allActive);
        if (activeBots.length < allActive.length) {
          console.log(
            `[predict] selected ${activeBots.length}/${allActive.length} bots — top by win rate + 1 newcomer slot`
          );
        }

        // Fetch current BTC price
        const priceRes = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd"
        );
        const priceData = await priceRes.json();
        const btcPrice = priceData.bitcoin.usd;

        // Step 1: Run the Judge AI to propose candidate zones for this round.
        // The Judge sees recent BTC samples and frames the plausible 1-hour
        // outcomes. Bots are then prompted with these zones.
        let judge: JudgeOutput | undefined;
        let judgeContext = "";
        let judgeTraceHash = "";
        try {
          // Pull a small recent-history window for context
          const histRes = await fetch(`${new URL(request.url).origin}/api/price/history?hours=4`);
          const histJson = histRes.ok ? await histRes.json() : { data: [] };
          const recent = (histJson.data ?? []).map((p: { value: number }) => p.value);

          judge = await runJudgeInference(btcPrice, recent);
          judgeContext = renderZonesForBotPrompt(judge.zones);

          const judgeStorage = await storeJudgeTrace({
            roundId,
            btcPrice,
            zones: judge.zones,
            reasoning: judge.reasoning,
            timestamp: Date.now(),
            tee: judge.tee,
          });
          judgeTraceHash = judgeStorage.rootHash;
          judgeCache.set(roundId, { ...judge, traceHash: judgeTraceHash });
          console.log(`[predict] judge proposed ${judge.zones.length} zones, trace ${judgeTraceHash.slice(0, 14)}…`);
        } catch (err) {
          console.warn("[predict] judge inference failed, falling back to no-judge:", err);
        }

        const results = [];

        // Step 2: Run each bot, injecting the judge's zones into its system prompt.
        for (const bot of activeBots) {
          try {
            const promptData = await getBotPrompt(bot.storageHash);

            const prediction = await runBotInference(promptData.prompt, btcPrice, judgeContext);

            const traceResult = await storeReasoningTrace({
              botId: Number(bot.id),
              roundId,
              priceLow: prediction.priceLow,
              priceHigh: prediction.priceHigh,
              reasoning: prediction.reasoning,
              timestamp: Date.now(),
              tee: prediction.tee,
            });

            const tx = await bettingPool.submitPrediction(
              roundId,
              bot.id,
              priceToCents(prediction.priceLow),
              priceToCents(prediction.priceHigh),
              traceResult.rootHash,
              bot.creator
            );
            await tx.wait();

            results.push({
              botId: Number(bot.id),
              botName: bot.name,
              prediction,
              reasoningHash: traceResult.rootHash,
              success: true,
            });
          } catch (err) {
            console.error(`[predict] Bot ${bot.id} failed:`, err);
            results.push({
              botId: Number(bot.id),
              botName: bot.name,
              success: false,
              error: String(err),
            });
          }
        }

        // Step 3: Open betting
        try {
          const tx = await bettingPool.openBetting(roundId);
          await tx.wait();
        } catch (err) {
          console.warn("[predict] openBetting failed:", err);
        }

        return Response.json({
          success: true,
          roundId,
          btcPrice,
          judge: judge ? { zones: judge.zones, reasoning: judge.reasoning, traceHash: judgeTraceHash } : null,
          results,
        });
      }

      case "settle": {
        // Get current round
        const roundCount2 = await bettingPool.roundCount();
        const roundId2 = Number(roundCount2);

        // Fetch current BTC price for settlement
        const priceRes2 = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd"
        );
        const priceData2 = await priceRes2.json();
        const btcPrice2 = priceData2.bitcoin.usd;
        const priceInCents = priceToCents(btcPrice2);

        // Settle the round on-chain
        const tx = await bettingPool.settleRound(roundId2, priceInCents);
        const receipt = await tx.wait();

        // Update bot stats in BotRegistry
        const botIds = await bettingPool.getRoundBots(roundId2);
        const botRegistryWrite = new ethers.Contract(
          CONTRACTS.botRegistry,
          BOT_REGISTRY_ABI,
          wallet
        );

        for (const botId of botIds) {
          const pred = await bettingPool.getPrediction(roundId2, botId);
          const won = Number(pred.score) > 0;
          try {
            const statsTx = await botRegistryWrite.updateBotStats(
              botId,
              pred.score,
              won
            );
            await statsTx.wait();
          } catch (err) {
            console.warn(`[settle] updateBotStats for bot ${botId} failed:`, err);
          }
        }

        return Response.json({
          success: true,
          roundId: roundId2,
          settlementPrice: btcPrice2,
          settlementPriceInCents: priceInCents,
          txHash: receipt.hash,
        });
      }

      default:
        return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error("[/api/rounds POST] Error:", error);
    return Response.json({ error: String(error) }, { status: 500 });
  }
}
