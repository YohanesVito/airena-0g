import { NextRequest } from "next/server";
import { ethers } from "ethers";
import { CONTRACTS, BETTING_POOL_ABI, BOT_REGISTRY_ABI } from "@/lib/contracts";
import { runBotInference, priceToCents } from "@/lib/0g-compute";
import { storeReasoningTrace, getBotPrompt } from "@/lib/0g-storage";

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://evmrpc-testnet.0g.ai";

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

        // Get all active bots
        const activeBots = await botRegistry.getActiveBots();

        if (activeBots.length === 0) {
          return Response.json({ error: "No active bots" }, { status: 400 });
        }

        if (activeBots.length < 2) {
          return Response.json({
            error: "Minimum 2 active bots required to run a round. Register more bots first.",
          }, { status: 400 });
        }

        // Fetch current BTC price
        const priceRes = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd"
        );
        const priceData = await priceRes.json();
        const btcPrice = priceData.bitcoin.usd;

        const results = [];

        // Run inference for each bot
        for (const bot of activeBots) {
          try {
            // Get bot prompt from 0G Storage
            const promptData = await getBotPrompt(bot.storageHash);

            // Run through 0G Compute
            const prediction = await runBotInference(promptData.prompt, btcPrice);

            // Store reasoning trace on 0G Storage
            const traceResult = await storeReasoningTrace({
              botId: Number(bot.id),
              roundId,
              priceLow: prediction.priceLow,
              priceHigh: prediction.priceHigh,
              reasoning: prediction.reasoning,
              timestamp: Date.now(),
            });

            // Submit prediction on-chain
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

        // Open betting after all predictions
        try {
          const tx = await bettingPool.openBetting(roundId);
          await tx.wait();
        } catch (err) {
          console.warn("[predict] openBetting failed:", err);
        }

        return Response.json({ success: true, roundId, btcPrice, results });
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
