/**
 * End-to-end round lifecycle smoke test.
 * Mirrors what /api/rounds does but runs against the contracts directly,
 * so failures are easier to localize. Steps:
 *   1. createRound (onlyOwner)
 *   2. For each active bot: load prompt → 0G Compute inference → store reasoning trace → submitPrediction
 *   3. openBetting (onlyOwner)
 *   4. placeBet (server wallet bets MIN_BET on bot #1)
 *   5. settleRound (onlyOwner, uses live BTC price)
 *   6. updateBotStats per bot (onlyOwner)
 *   7. claimWinnings (if our bet won)
 */
import { ethers } from "ethers";
import { runBotInference, priceToCents } from "../lib/0g-compute";
import { storeReasoningTrace, getBotPrompt } from "../lib/0g-storage";

const RPC = process.env.NEXT_PUBLIC_RPC_URL!;
const PK = process.env.PRIVATE_KEY!;
const REGISTRY = process.env.NEXT_PUBLIC_BOT_REGISTRY_ADDRESS!;
const POOL = process.env.NEXT_PUBLIC_BETTING_POOL_ADDRESS!;

const POOL_ABI = [
  "function createRound() returns (uint256)",
  "function roundCount() view returns (uint256)",
  "function getRound(uint256) view returns (tuple(uint256 id, uint256 startTime, uint256 endTime, uint256 settlementPrice, uint256 totalPool, uint8 status))",
  "function getRoundBots(uint256) view returns (uint256[])",
  "function submitPrediction(uint256,uint256,uint256,uint256,string,address)",
  "function openBetting(uint256)",
  "function placeBet(uint256,uint256) payable",
  "function settleRound(uint256,uint256)",
  "function getPrediction(uint256,uint256) view returns (tuple(uint256 botId, uint256 priceLow, uint256 priceHigh, string reasoningHash, uint256 score, bool scored))",
  "function claimWinnings(uint256)",
  "function botPoolSize(uint256,uint256) view returns (uint256)",
  "function MIN_BET() view returns (uint256)",
];
const REGISTRY_ABI = [
  "function getActiveBots() view returns (tuple(uint256 id, address creator, string name, string storageHash, uint256 totalRounds, uint256 wins, uint256 totalScore, uint256 createdAt, bool active)[])",
  "function updateBotStats(uint256,uint256,bool)",
];

const wallet = new ethers.Wallet(PK, new ethers.JsonRpcProvider(RPC));
const pool = new ethers.Contract(POOL, POOL_ABI, wallet);
const registry = new ethers.Contract(REGISTRY, REGISTRY_ABI, wallet);

async function btcPrice(): Promise<number> {
  const r = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd");
  return (await r.json()).bitcoin.usd;
}

const STATUS = ["OPEN", "PREDICTING", "BETTING", "SETTLED"];

console.log(`[smoke-round] wallet: ${wallet.address}`);
const bal0 = await wallet.provider!.getBalance(wallet.address);
console.log(`[smoke-round] starting balance: ${ethers.formatEther(bal0)} 0G`);

// ---------- 1. createRound ----------
console.log(`\n[1] createRound()`);
const tx1 = await pool.createRound();
const r1 = await tx1.wait();
const roundId = Number(await pool.roundCount());
console.log(`    ✓ round #${roundId} created (block ${r1.blockNumber}, tx ${tx1.hash})`);

// ---------- 2. predictions for each active bot ----------
const activeBots = await registry.getActiveBots();
console.log(`\n[2] running predictions for ${activeBots.length} active bot(s)`);
const price = await btcPrice();
console.log(`    BTC: $${price}`);

for (const bot of activeBots) {
  console.log(`    — bot #${bot.id} (${bot.name})`);
  const promptData = await getBotPrompt(bot.storageHash);
  console.log(`      ✓ loaded prompt from 0G Storage`);
  const pred = await runBotInference(promptData.prompt, price);
  console.log(`      ✓ inference: $${pred.priceLow} – $${pred.priceHigh}`);
  const trace = await storeReasoningTrace({
    botId: Number(bot.id),
    roundId,
    priceLow: pred.priceLow,
    priceHigh: pred.priceHigh,
    reasoning: pred.reasoning,
    timestamp: Date.now(),
    tee: pred.tee,
  });
  console.log(`      ✓ reasoning trace stored: ${trace.rootHash.slice(0, 14)}…`);
  const tx = await pool.submitPrediction(
    roundId,
    bot.id,
    priceToCents(pred.priceLow),
    priceToCents(pred.priceHigh),
    trace.rootHash,
    bot.creator
  );
  await tx.wait();
  console.log(`      ✓ submitted on-chain (tx ${tx.hash.slice(0, 14)}…)`);
}

// ---------- 3. openBetting ----------
console.log(`\n[3] openBetting(${roundId})`);
const tx3 = await pool.openBetting(roundId);
await tx3.wait();
console.log(`    ✓ status now BETTING`);

// ---------- 4. placeBet on bot #1 ----------
const targetBotId = Number(activeBots[0].id);
const minBet = await pool.MIN_BET();
console.log(`\n[4] placeBet(round=${roundId}, bot=${targetBotId}) value=${ethers.formatEther(minBet)} 0G`);
const tx4 = await pool.placeBet(roundId, targetBotId, { value: minBet });
await tx4.wait();
console.log(`    ✓ bet placed (tx ${tx4.hash.slice(0, 14)}…)`);

// ---------- 5. settleRound ----------
const settlePrice = await btcPrice();
console.log(`\n[5] settleRound(${roundId}, ${settlePrice}) — settlement BTC: $${settlePrice}`);
const tx5 = await pool.settleRound(roundId, priceToCents(settlePrice));
await tx5.wait();
const round = await pool.getRound(roundId);
console.log(`    ✓ status now ${STATUS[Number(round.status)]} | pool: ${ethers.formatEther(round.totalPool)} 0G`);

// ---------- 6. updateBotStats per bot ----------
console.log(`\n[6] updating bot stats`);
const botIds = await pool.getRoundBots(roundId);
let anyWon = false;
let ourBotWon = false;
for (const id of botIds) {
  const pred = await pool.getPrediction(roundId, id);
  const won = Number(pred.score) > 0;
  if (won) anyWon = true;
  if (Number(id) === targetBotId && won) ourBotWon = true;
  const tx = await registry.updateBotStats(id, pred.score, won);
  await tx.wait();
  console.log(`    bot #${id}: range $${Number(pred.priceLow)/100}–$${Number(pred.priceHigh)/100}, ${won ? `✓ WON (score ${pred.score})` : "✗ lost"}`);
}

// ---------- 7. claimWinnings (if applicable) ----------
console.log(`\n[7] claim winnings`);
if (!anyWon) {
  console.log(`    no bots won — bettors should be refundable`);
}
try {
  const tx7 = await pool.claimWinnings(roundId);
  await tx7.wait();
  console.log(`    ✓ claim succeeded (we ${ourBotWon ? "won, payout claimed" : !anyWon ? "got refunded" : "lost, no claim"})`);
} catch (err) {
  console.log(`    claim returned: ${(err as Error).message.split("(")[0].trim()}`);
}

const bal1 = await wallet.provider!.getBalance(wallet.address);
console.log(`\n[done] ending balance:   ${ethers.formatEther(bal1)} 0G`);
console.log(`[done] net spend:        ${ethers.formatEther(bal0 - bal1)} 0G`);
