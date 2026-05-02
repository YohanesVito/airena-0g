import { ethers } from "ethers";
import { storeBotPrompt } from "../lib/0g-storage";

// Pass --name "..." --prompt "..." OR set BOT_NAME / BOT_PROMPT env vars.
function arg(flag: string): string | undefined {
 const i = process.argv.indexOf(flag);
 return i >= 0 ? process.argv[i + 1] : undefined;
}

const NAME = arg("--name") ?? process.env.BOT_NAME;
const PROMPT = arg("--prompt") ?? process.env.BOT_PROMPT;
if (!NAME || !PROMPT) {
 console.error("usage: bun run scripts/register-bot.ts --name <name> --prompt <strategy-prompt>");
 process.exit(2);
}

const RPC = process.env.NEXT_PUBLIC_RPC_URL!;
const PK = process.env.PRIVATE_KEY!;
const REGISTRY = process.env.NEXT_PUBLIC_BOT_REGISTRY_ADDRESS!;

const REGISTRY_ABI = [
 "function registerBot(string,string) payable returns (uint256)",
 "function registrationFee() view returns (uint256)",
 "function botCount() view returns (uint256)",
 "function bots(uint256) view returns (uint256 id, address creator, string name, string storageHash, uint256 totalRounds, uint256 wins, uint256 totalScore, uint256 createdAt, bool active)",
];

const wallet = new ethers.Wallet(PK, new ethers.JsonRpcProvider(RPC));
const registry = new ethers.Contract(REGISTRY, REGISTRY_ABI, wallet);

console.log(`[register-bot] uploading prompt to 0G Storage…`);
const t0 = Date.now();
const { rootHash } = await storeBotPrompt({ name: NAME, prompt: PROMPT, createdAt: Date.now() });
console.log(`[register-bot] uploaded in ${Date.now() - t0}ms — rootHash: ${rootHash}`);

const fee: bigint = await registry.registrationFee();
console.log(`[register-bot] registration fee: ${ethers.formatEther(fee)} 0G`);

console.log(`[register-bot] registering "${NAME}"…`);
const tx = await registry.registerBot(NAME, rootHash, { value: fee });
console.log(`[register-bot] tx: ${tx.hash}`);
const receipt = await tx.wait();
console.log(`[register-bot] confirmed in block ${receipt.blockNumber}`);

const botCount: bigint = await registry.botCount();
const newId = Number(botCount);
const stored = await registry.bots(newId);
console.log(`\n[register-bot] DONE — bot #${newId}:`);
console.log(` name: ${stored.name}`);
console.log(` creator: ${stored.creator}`);
console.log(` storageHash: ${stored.storageHash}`);
console.log(` active: ${stored.active}`);
