import { runBotInference } from "../lib/0g-compute";

const STRATEGY = `Conservative trader. Predict tight ranges (~1.5% width).
Use recent volatility as your guide. Lean slightly bullish in uptrends.`;

// Fetch live BTC price for realism
const priceRes = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd");
const priceJson = await priceRes.json();
const btcPrice = priceJson?.bitcoin?.usd;
if (!btcPrice) throw new Error("could not fetch BTC price");
console.log(`[smoke-compute] BTC: $${btcPrice}`);

console.log(`[smoke-compute] running inference (this hits 0G Compute + TEE verify)…`);
const t0 = Date.now();
const pred = await runBotInference(STRATEGY, btcPrice);
console.log(`[smoke-compute] inference returned in ${Date.now() - t0}ms`);
console.log(`[smoke-compute] priceLow: $${pred.priceLow}`);
console.log(`[smoke-compute] priceHigh: $${pred.priceHigh}`);
console.log(`[smoke-compute] reasoning: ${pred.reasoning}`);

const sane =
 pred.priceLow > 0 &&
 pred.priceHigh > pred.priceLow &&
 pred.priceLow > btcPrice * 0.5 &&
 pred.priceHigh < btcPrice * 2;
console.log(`[smoke-compute] sanity ${sane ? " OK" : " out of range"}`);

if (pred.tee) {
 console.log(`[smoke-compute] TEE attestation captured:`);
 console.log(` signer: ${pred.tee.signer}`);
 console.log(` chatID: ${pred.tee.chatID}`);
 console.log(` signedText: ${pred.tee.signedText.slice(0, 60)}…`);
 console.log(` signature: ${pred.tee.signature.slice(0, 24)}…`);
 console.log(` verified: ${pred.tee.verified ? " yes" : " no"}`);
} else {
 console.log(`[smoke-compute] TEE attestation NOT captured`);
}

process.exit(sane && pred.tee?.verified ? 0 : 1);
