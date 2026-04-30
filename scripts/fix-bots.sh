#!/usr/bin/env bash
# One-shot script to fix the broken ZeroBound + WideNet bots and run a fresh
# round. Steps:
#   1. settle round 8 (cleanup)
#   2. deactivate ZeroBound (#3)  — broken prompt
#   3. deactivate WideNet  (#4)   — broken prompt
#   4. register fixed ZeroBound (#5) with explicit numeric width
#   5. register fixed WideNet  (#6) with absolute-percent width
#   6. create round 9
#   7. run predict on round 9 (~5 min)
set -e

PK=$(grep '^PRIVATE_KEY=' .env.local | cut -d= -f2)
RPC=https://evmrpc-testnet.0g.ai
REG=0x6303db2FeF6f10404818e2b4ee71506e9C809F02
GAS=( --gas-price 4000000000 --priority-gas-price 2000000000 )
API=http://localhost:3000/api/rounds

echo "=== [1/7] settle round 8 ==="
curl -s -X POST "$API" -H "Content-Type: application/json" -d '{"action":"settle"}' | head -c 300
echo; echo

echo "=== [2/7] deactivate ZeroBound (#3) ==="
cast send "$REG" "deactivateBot(uint256)" 3 --private-key "$PK" --rpc-url "$RPC" "${GAS[@]}" 2>&1 | grep -E "transactionHash|status" | head -2
echo

echo "=== [3/7] deactivate WideNet (#4) ==="
cast send "$REG" "deactivateBot(uint256)" 4 --private-key "$PK" --rpc-url "$RPC" "${GAS[@]}" 2>&1 | grep -E "transactionHash|status" | head -2
echo

echo "=== [4/7] register fixed ZeroBound (#5) ==="
bun run scripts/register-bot.ts \
  --name "ZeroBound" \
  --prompt 'You are a precision tight-range scalper for BTC predictions. Your range MUST have a width between 0.1% and 0.4% of the current BTC spot price. Example: at 77000 USD BTC, your range width should be between 77 USD (0.1%) and 308 USD (0.4%). NEVER set priceLow equal to priceHigh — the contract requires priceLow strictly less than priceHigh, so rangeWidth must be > 0. Center your range on the Judge zone whose midpoint is closest to the current spot price. If multiple Judge zones are close, pick the one closest to the current price. Reasoning style: emphasize precision; you would rather be wrong outright than win with a sloppy wide range. Output ONLY valid JSON with priceLow, priceHigh, reasoning. No markdown.' \
  2>&1 | tail -6
echo

echo "=== [5/7] register fixed WideNet (#6) ==="
bun run scripts/register-bot.ts \
  --name "WideNet" \
  --prompt 'You are a defensive hedge AI for BTC predictions. Your range MUST have a width between 1.5% and 2.5% of the current BTC spot price. Example: at 77000 USD BTC, your range width should be between 1155 USD (1.5%) and 1925 USD (2.5%). Compute your range width DIRECTLY from the current price — DO NOT just take the union of Judge zones; use the Judge zones only as directional reference. Center your range slightly biased toward the recent trend direction (up if last samples trending up, down if trending down). Reasoning style: emphasize coverage and downside protection. Output ONLY valid JSON with priceLow, priceHigh, reasoning. No markdown.' \
  2>&1 | tail -6
echo

echo "=== [6/7] create round 9 ==="
curl -s -X POST "$API" -H "Content-Type: application/json" -d '{"action":"create"}'
echo; echo

echo "=== [7/7] run predict on round 9 (this takes ~5 min) ==="
curl -s -X POST "$API" -H "Content-Type: application/json" -d '{"action":"predict"}' > /tmp/predict-r9.json
echo
echo "=== predict result (round 9) ==="
cat /tmp/predict-r9.json | bun -e '
const d = JSON.parse(await Bun.stdin.text());
if (!d.success) { console.log("FAILED:", d.error); process.exit(1); }
console.log("BTC at predict:", "$" + d.btcPrice);
console.log();
console.log("Judge zones:");
for (const z of d.judge?.zones ?? []) {
  console.log("  " + z.label + ": $" + z.priceLow + " - $" + z.priceHigh + " (width $" + (z.priceHigh - z.priceLow).toFixed(0) + ")");
}
console.log();
console.log("Bot predictions:");
for (const r of d.results) {
  if (!r.success) { console.log("  " + r.botName + ": FAILED - " + r.error); continue; }
  const w = r.prediction.priceHigh - r.prediction.priceLow;
  const wPct = (w / d.btcPrice * 100).toFixed(2);
  console.log("  " + r.botName + ": $" + r.prediction.priceLow + " - $" + r.prediction.priceHigh + " (width $" + w.toFixed(0) + " = " + wPct + "%)");
}
'

echo
echo "=== ALL DONE ==="
