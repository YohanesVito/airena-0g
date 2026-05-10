/**
 * Manually advance a stuck round from PREDICTING to BETTING.
 *
 * Use when the predict API timed out mid-cycle and the round is parked
 * in status=1 with at least 2 valid predictions on-chain. The contract
 * accepts openBetting() from the owner regardless of how predictions
 * landed there, so this just calls the missing final step that the API
 * never reached.
 *
 * Usage:
 *   bun run scripts/open-betting.ts          # uses latest round
 *   bun run scripts/open-betting.ts 2        # explicit round id
 */
import { ethers } from "ethers";

const RPC = process.env.NEXT_PUBLIC_RPC_URL!;
const PK = process.env.PRIVATE_KEY!;
const POOL = process.env.NEXT_PUBLIC_BETTING_POOL_ADDRESS!;

if (!RPC || !PK || !POOL) {
  console.error("Missing env. Need NEXT_PUBLIC_RPC_URL, PRIVATE_KEY, NEXT_PUBLIC_BETTING_POOL_ADDRESS in .env.local");
  process.exit(1);
}

const POOL_ABI = [
  "function roundCount() view returns (uint256)",
  "function getRound(uint256) view returns (tuple(uint256 id, uint256 startTime, uint256 endTime, uint256 settlementPrice, uint256 totalPool, uint8 status))",
  "function getRoundBots(uint256) view returns (uint256[])",
  "function openBetting(uint256)",
];

const STATUS_NAMES = ["OPEN", "PREDICTING", "BETTING", "SETTLED"] as const;

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(PK, provider);
  const pool = new ethers.Contract(POOL, POOL_ABI, wallet);

  const argRound = process.argv[2];
  const roundId = argRound ? Number(argRound) : Number(await pool.roundCount());

  const round = await pool.getRound(roundId);
  const bots = (await pool.getRoundBots(roundId)) as bigint[];
  const status = Number(round.status);

  console.log(`Round #${roundId}`);
  console.log(`  status      : ${STATUS_NAMES[status] ?? status} (${status})`);
  console.log(`  predictions : ${bots.length} (bot ids: ${bots.map(String).join(", ") || "none"})`);
  console.log(`  signer      : ${wallet.address}`);

  if (status !== 1) {
    console.error(`\nRefusing to advance — round must be in PREDICTING (1), got ${STATUS_NAMES[status] ?? status}.`);
    process.exit(1);
  }
  if (bots.length < 2) {
    console.error(`\nRefusing to advance — need at least 2 predictions on-chain, got ${bots.length}.`);
    process.exit(1);
  }

  console.log(`\nCalling openBetting(${roundId})...`);
  const tx = await pool.openBetting(roundId);
  console.log(`  tx hash : ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`  block   : ${receipt?.blockNumber}`);

  const after = await pool.getRound(roundId);
  console.log(`\nDone. Round #${roundId} status -> ${STATUS_NAMES[Number(after.status)]} (${Number(after.status)})`);
  console.log(`Open /arena and the BET input should be live.`);
}

main().catch((err) => {
  console.error("\nFailed:", err?.shortMessage || err?.message || err);
  process.exit(1);
});
