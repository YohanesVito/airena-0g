import { storeBotPrompt, retrieveFromStorage } from "../lib/0g-storage";

const data = {
  name: "smoke-test-bot",
  prompt: "Buy when RSI < 30, sell when > 70. Tight ranges only.",
  createdAt: Date.now(),
};

console.log(`[smoke-storage] uploading…`);
const t0 = Date.now();
const { rootHash, txHash } = await storeBotPrompt(data);
console.log(`[smoke-storage] ✓ uploaded in ${Date.now() - t0}ms`);
console.log(`[smoke-storage]   rootHash: ${rootHash}`);
console.log(`[smoke-storage]   txHash:   ${txHash}`);

console.log(`[smoke-storage] retrieving by rootHash…`);
const t1 = Date.now();
const retrieved = await retrieveFromStorage(rootHash);
console.log(`[smoke-storage] ✓ retrieved in ${Date.now() - t1}ms`);
console.log(`[smoke-storage]   raw: ${retrieved}`);

const parsed = JSON.parse(retrieved);
const ok = parsed.name === data.name && parsed.prompt === data.prompt;
console.log(`[smoke-storage] roundtrip ${ok ? "✓ OK" : "✗ MISMATCH"}`);
process.exit(ok ? 0 : 1);
