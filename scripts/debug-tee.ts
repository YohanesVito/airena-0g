import { createZGComputeNetworkBroker } from "@0glabs/0g-serving-broker";
import { ethers } from "ethers";

const RPC = process.env.NEXT_PUBLIC_RPC_URL ?? "https://evmrpc-testnet.0g.ai";
const PROVIDER = process.env.COMPUTE_PROVIDER_ADDRESS!;
const PK = process.env.PRIVATE_KEY!;

const wallet = new ethers.Wallet(PK, new ethers.JsonRpcProvider(RPC));
const broker = await createZGComputeNetworkBroker(wallet);

const { endpoint, model } = await broker.inference.requestProcessor.getServiceMetadata(PROVIDER);
console.log("endpoint:", endpoint);
console.log("model:", model);

const headers = await broker.inference.requestProcessor.getRequestHeaders(PROVIDER);
const res = await fetch(`${endpoint}/chat/completions`, {
  method: "POST",
  headers: { "Content-Type": "application/json", ...headers },
  body: JSON.stringify({
    messages: [{ role: "user", content: "Reply with the single word OK." }],
    model,
    max_tokens: 10,
  }),
});

console.log("\n=== inference response headers ===");
res.headers.forEach((v, k) => console.log(`  ${k}: ${v}`));

const data: any = await res.json();
console.log("\n=== inference response body ===");
console.log("  id (completion):", data.id);
console.log("  content:", data.choices?.[0]?.message?.content);

const zgResKey = res.headers.get("zg-res-key") || res.headers.get("ZG-Res-Key");
const chatID = zgResKey || data.id;
console.log("\n=== chatID resolution ===");
console.log("  ZG-Res-Key header:", zgResKey ?? "(missing)");
console.log("  using chatID:", chatID);

// Probe signature endpoint with each candidate
const candidates = [
  { label: "ZG-Res-Key header", id: zgResKey },
  { label: "completion data.id", id: data.id },
].filter((c) => c.id);

const sigBaseLink = await broker.inference.getChatSignatureDownloadLink(PROVIDER, "PLACEHOLDER");
const sigBase = sigBaseLink.replace(/\/PLACEHOLDER$/, "");
console.log("\n  signature base URL:", sigBase);

for (const c of candidates) {
  const url = `${sigBase}/${c.id}?model=${encodeURIComponent(model)}`;
  console.log(`\n=== probe [${c.label}] ===`);
  console.log("  URL:", url);
  const r = await fetch(url);
  console.log(`  status: ${r.status} ${r.statusText}`);
  const body = await r.text();
  console.log(`  body: ${body.slice(0, 400)}`);
}

// Test the official SDK call with correct chatID
console.log("\n=== try processResponse with correct chatID ===");
try {
  const ok = await broker.inference.responseProcessor.processResponse(PROVIDER, chatID);
  console.log(`  processResponse returned: ${ok}`);
} catch (err) {
  console.log(`  processResponse threw: ${(err as Error).message}`);
}
