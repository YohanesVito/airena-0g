/**
 * Bot diversity smoke test — runs the Judge once + inference for each active
 * bot, and prints the resulting price ranges side-by-side. Skips all on-chain
 * writes and 0G Storage uploads, so it sidesteps the slow testnet storage
 * sync that's currently blocking full predict cycles.
 *
 * What this verifies:
 *   - ZeroBound (#5) produces a TIGHT range (~0.1–0.4% of BTC price)
 *   - WideNet  (#6) produces a WIDE  range (~1.5–2.5% of BTC price)
 *   - smoke-bot (#1) + MomentumMax (#2) sit between, with distinct strategies
 *
 * Usage:
 *   bun run scripts/check-bot-diversity.ts
 */
import { ethers } from "ethers";
import { runBotInference, runZGInference } from "../lib/0g-compute";
import { getBotPrompt } from "../lib/0g-storage";
import { renderZonesForBotPrompt, type JudgeZone } from "../lib/0g-judge";

const RPC = process.env.NEXT_PUBLIC_RPC_URL!;
const REGISTRY = process.env.NEXT_PUBLIC_BOT_REGISTRY_ADDRESS!;
const PK = process.env.PRIVATE_KEY!;

const REGISTRY_ABI = [
  "function getActiveBots() external view returns (tuple(uint256 id, address creator, string name, string storageHash, uint256 totalRounds, uint256 wins, uint256 totalScore, uint256 createdAt, bool active)[])",
];

const wallet = new ethers.Wallet(PK, new ethers.JsonRpcProvider(RPC));
const registry = new ethers.Contract(REGISTRY, REGISTRY_ABI, wallet);

console.log("[check-diversity] fetching live BTC price…");
const priceRes = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd");
const btcPrice = (await priceRes.json()).bitcoin.usd as number;
console.log(`[check-diversity] BTC: $${btcPrice}`);

console.log("\n[check-diversity] running Judge AI…");
const t0 = Date.now();
// Inline a minimal judge call (don't import runJudgeInference to skip its
// own storage paths). We just need zones to feed the bots.
const judgeSystem = `You are the Airena Judge AI. Output 3 candidate BTC prediction zones in JSON: {"zones":[{"label":"Bullish breakout","priceLow":N,"priceHigh":N},{"label":"Sideways","priceLow":N,"priceHigh":N},{"label":"Bearish dip","priceLow":N,"priceHigh":N}],"reasoning":"..."}. Each zone width 0.7%-1.5% of current price. Together cover 3-5% band. priceLow < priceHigh strictly. Output JSON only, no markdown.`;
const judgeUser = `Current BTC: $${btcPrice.toFixed(2)}. Propose 3 zones for the next hour.`;
const { content: judgeContent, tee: judgeTee } = await runZGInference(judgeSystem, judgeUser, {
  logTag: "Judge",
  temperature: 0.6,
  maxTokens: 400,
});
const judgeJson = JSON.parse(judgeContent.replace(/```json\s*/gi, "").replace(/```\s*/g, "").match(/\{[\s\S]*\}/)![0]);
const zones: JudgeZone[] = judgeJson.zones;
console.log(`[check-diversity] Judge returned ${zones.length} zones in ${Date.now() - t0}ms (TEE ${judgeTee?.verified ? "✓" : "✗"})`);
for (const z of zones) {
  const w = z.priceHigh - z.priceLow;
  console.log(`  ${z.label}: $${z.priceLow.toFixed(0)} - $${z.priceHigh.toFixed(0)} (width $${w.toFixed(0)} = ${(w / btcPrice * 100).toFixed(2)}%)`);
}
const judgeContext = renderZonesForBotPrompt(zones);

console.log("\n[check-diversity] fetching active bots…");
const activeBots = await registry.getActiveBots();
const bots: { id: number; name: string; storageHash: string }[] = activeBots.map((b: any) => ({
  id: Number(b.id),
  name: b.name,
  storageHash: b.storageHash,
}));
console.log(`[check-diversity] ${bots.length} active bots: ${bots.map(b => `#${b.id} ${b.name}`).join(", ")}`);

console.log("\n[check-diversity] running per-bot inference (sequential)…");
const results: { name: string; id: number; low: number; high: number; widthPct: number; reasoning: string; verified: boolean }[] = [];

for (const bot of bots) {
  console.log(`\n--- bot #${bot.id} ${bot.name} ---`);
  const tStart = Date.now();
  const prompt = (await getBotPrompt(bot.storageHash)).prompt;
  console.log(`  prompt loaded (${prompt.length} chars)`);
  try {
    const pred = await runBotInference(prompt, btcPrice, judgeContext);
    const w = pred.priceHigh - pred.priceLow;
    const wPct = (w / btcPrice) * 100;
    results.push({
      name: bot.name,
      id: bot.id,
      low: pred.priceLow,
      high: pred.priceHigh,
      widthPct: wPct,
      reasoning: pred.reasoning,
      verified: pred.tee?.verified ?? false,
    });
    console.log(`  ✓ ${(Date.now() - tStart) / 1000 | 0}s — range $${pred.priceLow.toFixed(0)}-$${pred.priceHigh.toFixed(0)} (width ${wPct.toFixed(2)}%)`);
    console.log(`  reasoning: ${pred.reasoning.slice(0, 120)}…`);
  } catch (err) {
    console.log(`  ✗ FAILED: ${err instanceof Error ? err.message : err}`);
  }
}

console.log("\n=== SUMMARY ===");
console.log(`BTC: $${btcPrice}`);
console.log("Bot                     | range                  | width   | TEE");
console.log("------------------------|------------------------|---------|----");
for (const r of results) {
  const range = `$${r.low.toFixed(0)}-$${r.high.toFixed(0)}`.padEnd(22);
  const name = `#${r.id} ${r.name}`.padEnd(22);
  console.log(`${name}  | ${range} | ${r.widthPct.toFixed(2).padStart(5)}% | ${r.verified ? "✓" : "✗"}`);
}

// Diversity verdict
const widths = results.map(r => r.widthPct);
const minW = Math.min(...widths);
const maxW = Math.max(...widths);
console.log(`\nrange width spread: ${minW.toFixed(2)}% (tightest) to ${maxW.toFixed(2)}% (widest) — ratio ${(maxW / minW).toFixed(1)}×`);
console.log(maxW / minW >= 3 ? "✅ DIVERSITY OK — clear archetype split" : "⚠️  bots converging — consider re-tuning prompts");
