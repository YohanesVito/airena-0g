/**
 * Seed-pool workaround for hackathon demos.
 *
 * The deployed BettingPool has no sponsorPool() / seedRound() admin
 * function — adding one would require redeploying the contract and
 * migrating bots, which we're not doing in v1. Instead this script
 * places a small placeBet() from the wallet running it, distributed
 * evenly across every bot in the current round. The funds become real
 * bets and follow the standard 85/10/5 split at settlement:
 *   - if any bot in the seeded set wins, the seeding wallet gets back
 *     a proportional share of the 85% pool (its stake mostly returns,
 *     net of the 5% platform fee on its slice and 10% creator share).
 *   - if no bot wins, the contract auto-refunds 100% to every bettor
 *     (including the seed) — net cost zero, only the gas.
 *
 * In practice the wallet running this loses around 5–15% of the seed
 * to platform + creator fees, in exchange for a visibly active pool
 * that demos and judges can interact with. Use it when the round is
 * in BETTING status (status === 2) and you want the pool to look
 * non-zero before public bets land.
 *
 * Usage:
 *   bun run scripts/seed-pool.ts                   # default: MIN_BET per bot
 *   SEED_PER_BOT=0.005 bun run scripts/seed-pool.ts
 */
import { ethers } from "ethers";

const RPC = process.env.NEXT_PUBLIC_RPC_URL!;
const PK = process.env.PRIVATE_KEY!;
const POOL = process.env.NEXT_PUBLIC_BETTING_POOL_ADDRESS!;

const POOL_ABI = [
  "function roundCount() view returns (uint256)",
  "function getRound(uint256) view returns (tuple(uint256 id, uint256 startTime, uint256 endTime, uint256 settlementPrice, uint256 totalPool, uint8 status))",
  "function getRoundBots(uint256) view returns (uint256[])",
  "function placeBet(uint256,uint256) payable",
  "function botPoolSize(uint256,uint256) view returns (uint256)",
  "function MIN_BET() view returns (uint256)",
];

if (!RPC || !PK || !POOL) {
  console.error("[seed-pool] Missing env: NEXT_PUBLIC_RPC_URL / PRIVATE_KEY / NEXT_PUBLIC_BETTING_POOL_ADDRESS");
  process.exit(1);
}

const wallet = new ethers.Wallet(PK, new ethers.JsonRpcProvider(RPC));
const pool = new ethers.Contract(POOL, POOL_ABI, wallet);

const STATUS = ["OPEN", "PREDICTING", "BETTING", "SETTLED"];

async function main() {
  const roundCount = await pool.roundCount();
  if (roundCount === 0n) {
    console.error("[seed-pool] No rounds exist yet. Create one first via the admin UI or scripts/smoke-round.ts");
    process.exit(1);
  }
  const roundId = Number(roundCount);
  const round = await pool.getRound(roundId);
  const status = Number(round.status);
  console.log(`[seed-pool] round #${roundId} status: ${STATUS[status] ?? "UNKNOWN"} (${status})`);

  if (status !== 2) {
    console.error(`[seed-pool] round must be in BETTING (2) to seed. Aborting.`);
    process.exit(1);
  }

  const minBet: bigint = await pool.MIN_BET();
  const perBotEnv = process.env.SEED_PER_BOT;
  const perBotWei = perBotEnv
    ? ethers.parseEther(perBotEnv)
    : minBet;

  if (perBotWei < minBet) {
    console.error(`[seed-pool] SEED_PER_BOT (${ethers.formatEther(perBotWei)} 0G) is below MIN_BET (${ethers.formatEther(minBet)} 0G)`);
    process.exit(1);
  }

  const botIds: bigint[] = await pool.getRoundBots(roundId);
  if (botIds.length === 0) {
    console.error(`[seed-pool] round #${roundId} has no bots. Aborting.`);
    process.exit(1);
  }

  const totalSeed = perBotWei * BigInt(botIds.length);
  console.log(
    `[seed-pool] seeding round #${roundId} with ${ethers.formatEther(perBotWei)} 0G on each of ${botIds.length} bot(s) = ${ethers.formatEther(totalSeed)} 0G total`
  );

  const balance = await wallet.provider!.getBalance(wallet.address);
  if (balance < totalSeed) {
    console.error(
      `[seed-pool] wallet ${wallet.address} has ${ethers.formatEther(balance)} 0G, needs at least ${ethers.formatEther(totalSeed)} 0G plus gas`
    );
    process.exit(1);
  }

  for (const botId of botIds) {
    process.stdout.write(`  bot #${botId}: placing ${ethers.formatEther(perBotWei)} 0G... `);
    const tx = await pool.placeBet(roundId, botId, { value: perBotWei });
    const receipt = await tx.wait();
    const newSize: bigint = await pool.botPoolSize(roundId, botId);
    console.log(`tx ${tx.hash.slice(0, 14)}…  pool now ${ethers.formatEther(newSize)} 0G  (block ${receipt?.blockNumber})`);
  }

  const finalRound = await pool.getRound(roundId);
  console.log(`[seed-pool] done. round #${roundId} totalPool: ${ethers.formatEther(finalRound.totalPool)} 0G`);
}

main().catch((err) => {
  console.error("[seed-pool] failed:", err);
  process.exit(1);
});
