/**
 * Register 3 bots, one per creator wallet — multi-creator demo.
 *
 * Reads CREATOR_1_PK / CREATOR_2_PK / CREATOR_3_PK from env. For each:
 * 1. Computes address, checks balance.
 * 2. If below 0.02 0G, tops up from PRIVATE_KEY (deployer) to 0.03 0G.
 * 3. Uploads bot strategy prompt to 0G Storage.
 * 4. Calls registerBot(name, rootHash) from that wallet (pays 0.001 0G fee).
 *
 * bun run scripts/multi-creator-demo.ts
 *
 * Prints final summary with 3 new bot IDs + 3 distinct creator addresses.
 */
import { ethers } from "ethers";
import { storeBotPrompt } from "../lib/0g-storage";

const RPC = process.env.NEXT_PUBLIC_RPC_URL!;
const DEPLOYER_PK = process.env.PRIVATE_KEY!;
const REGISTRY = process.env.NEXT_PUBLIC_BOT_REGISTRY_ADDRESS!;

const TARGET_BALANCE = ethers.parseEther("0.5");
const MIN_BALANCE = ethers.parseEther("0.4");

const REGISTRY_ABI = [
 "function registerBot(string,string) payable returns (uint256)",
 "function registrationFee() view returns (uint256)",
 "function botCount() view returns (uint256)",
 "function bots(uint256) view returns (uint256 id, address creator, string name, string storageHash, uint256 totalRounds, uint256 wins, uint256 totalScore, uint256 createdAt, bool active)",
];

type Bot = { name: string; prompt: string };

const BOTS: Bot[] = [
 {
 name: "TightScalper",
 prompt:
 "You are a precision tight-range scalper for BTC predictions. Your range MUST have a width between 0.2% and 0.4% of the current BTC spot price. Example: at 77000 USD BTC, width should be between 154 USD (0.2%) and 308 USD (0.4%). NEVER set priceLow equal to priceHigh — the contract requires priceLow strictly less than priceHigh, so rangeWidth must be > 0. Center your range on the Judge zone whose midpoint is closest to the current spot price. If multiple Judge zones are similarly close, pick the one whose midpoint matches current spot best. Reasoning style: emphasize precision; you would rather be wrong outright than win with a sloppy wide range. Output ONLY valid JSON with priceLow, priceHigh, reasoning. No markdown.",
 },
 {
 name: "MeanReverter",
 prompt:
 "You are a contrarian mean-reversion AI for BTC predictions. Your range MUST have a width between 0.6% and 0.9% of the current BTC spot price. Example: at 77000 USD BTC, width should be between 462 USD (0.6%) and 693 USD (0.9%). Compute width DIRECTLY from current price — DO NOT just take the union of Judge zones. Use the recent price samples to detect direction: if last samples trend UP, bias your range CENTER slightly BELOW current spot (expecting pullback); if trending DOWN, bias center slightly ABOVE. Reasoning style: emphasize contrarian conviction; the crowd is often wrong at extremes. Output ONLY valid JSON with priceLow, priceHigh, reasoning. No markdown.",
 },
 {
 name: "TrendRider",
 prompt:
 "You are a momentum trend-following AI for BTC predictions. Your range MUST have a width between 0.6% and 0.9% of the current BTC spot price. Example: at 77000 USD BTC, width should be between 462 USD (0.6%) and 693 USD (0.9%). Compute width DIRECTLY from current price. Use the recent price samples to detect direction: if last samples trend UP, bias your range CENTER slightly ABOVE current spot (expecting continuation); if trending DOWN, bias center slightly BELOW. Reasoning style: emphasize trend persistence and momentum. Output ONLY valid JSON with priceLow, priceHigh, reasoning. No markdown.",
 },
];

function normalizePk(pk: string): string {
 const trimmed = pk.trim();
 return trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
}

const provider = new ethers.JsonRpcProvider(RPC);
const deployer = new ethers.Wallet(DEPLOYER_PK, provider);

const creatorPks = [
 process.env.CREATOR_1_PK,
 process.env.CREATOR_2_PK,
 process.env.CREATOR_3_PK,
];

for (let i = 0; i < creatorPks.length; i++) {
 if (!creatorPks[i]) {
 console.error(`[demo] CREATOR_${i + 1}_PK is not set in .env.local — aborting`);
 process.exit(2);
 }
}

const creators = creatorPks.map((pk) => new ethers.Wallet(normalizePk(pk!), provider));

console.log("[demo] === multi-creator demo ===");
console.log(`[demo] deployer: ${deployer.address}`);
for (let i = 0; i < creators.length; i++) {
 console.log(`[demo] creator ${i + 1}: ${creators[i].address} → ${BOTS[i].name}`);
}
console.log();

// Step 1: fund creators if needed
const deployerBal = await provider.getBalance(deployer.address);
console.log(`[demo] deployer balance: ${ethers.formatEther(deployerBal)} 0G`);

for (let i = 0; i < creators.length; i++) {
 const c = creators[i];
 const bal = await provider.getBalance(c.address);
 console.log(`[demo] creator ${i + 1} (${c.address.slice(0, 10)}…) balance: ${ethers.formatEther(bal)} 0G`);
 if (bal < MIN_BALANCE) {
 const topUp = TARGET_BALANCE - bal;
 process.stdout.write(` topping up ${ethers.formatEther(topUp)} 0G from deployer… `);
 const tx = await deployer.sendTransaction({ to: c.address, value: topUp });
 await tx.wait();
 console.log(` ${tx.hash}`);
 }
}
console.log();

// Step 2: register one bot per creator
const newBotIds: number[] = [];
for (let i = 0; i < creators.length; i++) {
 const c = creators[i];
 const bot = BOTS[i];
 const reg = new ethers.Contract(REGISTRY, REGISTRY_ABI, c);

 console.log(`[demo] === bot ${i + 1}/${creators.length}: ${bot.name} from ${c.address.slice(0, 10)}… ===`);

 process.stdout.write(" uploading prompt to 0G Storage… ");
 const t0 = Date.now();
 const { rootHash } = await storeBotPrompt({ name: bot.name, prompt: bot.prompt, createdAt: Date.now() });
 console.log(` ${Date.now() - t0}ms — ${rootHash}`);

 const fee: bigint = await reg.registrationFee();
 process.stdout.write(` registerBot(${bot.name}) [fee ${ethers.formatEther(fee)} 0G]… `);
 const tx = await reg.registerBot(bot.name, rootHash, { value: fee });
 await tx.wait();
 console.log(` ${tx.hash}`);

 const botCount: bigint = await reg.botCount();
 const newId = Number(botCount);
 newBotIds.push(newId);
 const stored = await reg.bots(newId);
 console.log(` bot #${newId}: creator=${stored.creator}, active=${stored.active}\n`);
}

console.log("[demo] === SUMMARY ===");
console.log(`[demo] new bot IDs: ${newBotIds.join(", ")}`);
console.log("[demo] distinct creators on mainnet:");
const seen = new Set<string>();
for (let i = 0; i < creators.length; i++) {
 const a = creators[i].address;
 console.log(` ${BOTS[i].name.padEnd(14)} (#${newBotIds[i]}): ${a}`);
 seen.add(a.toLowerCase());
}
console.log(`[demo] distinct address count: ${seen.size}`);
console.log("[demo] done");
