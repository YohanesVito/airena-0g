/**
 * Deactivate all currently-active bots owned by the running wallet.
 *
 * Reads PRIVATE_KEY and walks bots 1..botCount(), calling deactivateBot
 * for each bot whose `creator` matches the wallet. deactivateBot is
 * creator-gated (not registry-owner-gated), so bots registered by other
 * wallets are skipped. One-way per the contract.
 *
 * bun run scripts/deactivate-bots.ts
 */
import { ethers } from "ethers";

const RPC = process.env.NEXT_PUBLIC_RPC_URL;
const PK = process.env.PRIVATE_KEY;
const REGISTRY = process.env.NEXT_PUBLIC_BOT_REGISTRY_ADDRESS;

if (!RPC || !PK || !REGISTRY) {
  console.error(
    "[deactivate] Missing env: NEXT_PUBLIC_RPC_URL / PRIVATE_KEY / NEXT_PUBLIC_BOT_REGISTRY_ADDRESS"
  );
  process.exit(1);
}

const ABI = [
  "function botCount() view returns (uint256)",
  "function bots(uint256) view returns (uint256 id, address creator, string name, string storageHash, uint256 totalRounds, uint256 wins, uint256 totalScore, uint256 createdAt, bool active)",
  "function deactivateBot(uint256)",
];

const provider = new ethers.JsonRpcProvider(RPC);
const wallet = new ethers.Wallet(PK, provider);
const reg = new ethers.Contract(REGISTRY, ABI, wallet);

const total = Number(await reg.botCount());
console.log(`[deactivate] botCount = ${total}`);

for (let id = 1; id <= total; id++) {
  const b = await reg.bots(id);
  if (!b.active) {
    console.log(`  #${id} ${b.name} — already inactive, skip`);
    continue;
  }
  if (b.creator.toLowerCase() !== wallet.address.toLowerCase()) {
    console.log(`  #${id} ${b.name} — creator ${b.creator} not us, skip`);
    continue;
  }
  process.stdout.write(`  #${id} ${b.name} — deactivating… `);
  const tx = await reg.deactivateBot(id);
  await tx.wait();
  console.log(`  ${tx.hash}`);
}

console.log("[deactivate] done");
