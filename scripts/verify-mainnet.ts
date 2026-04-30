/**
 * Read-only mainnet readiness probe — answers three questions before we
 * commit any 0G to a mainnet deployment:
 *
 *   1. Can we reach 0G mainnet RPC and read chain state?
 *   2. Are there 0G Compute providers live on mainnet, with TEE acknowledged
 *      and running a Qwen-class chat model?
 *   3. Is the mainnet 0G Storage indexer reachable, and how does it respond
 *      compared to testnet (sync-lag wise)?
 *
 * No PRIVATE_KEY required. No on-chain writes. Costs nothing.
 *
 * Usage: bun run scripts/verify-mainnet.ts
 */
import { createZGComputeNetworkReadOnlyBroker } from "@0glabs/0g-serving-broker";
import { ethers } from "ethers";

const MAINNET_RPC = "https://evmrpc.0g.ai";
const MAINNET_CHAIN_ID = 16661;
const MAINNET_INDEXER = "https://indexer-storage-turbo.0g.ai";
const MAINNET_EXPLORER = "https://chainscan.0g.ai";

// Reference: what we use on testnet
const TESTNET_PROVIDER = "0xa48f01287233509FD694a22Bf840225062E67836";
const TESTNET_SIGNER = "0x83df4B8EbA7c0B3B740019b8c9a77fF77D508cF";

interface Verdict {
  rpcReachable: boolean;
  chainId: number | null;
  blockHeight: number | null;
  computeProviders: ProviderSummary[];
  qwenProviderFound: boolean;
  storageIndexerReachable: boolean;
  storageIndexerStatus: string | null;
}

interface ProviderSummary {
  address: string;
  serviceType: string;
  url: string;
  model: string;
  verifiability: string;
  teeSignerAddress: string;
  teeSignerAcknowledged: boolean;
  inputPricePerToken: bigint;
  outputPricePerToken: bigint;
  isQwen: boolean;
  isTee: boolean;
  matchesTestnetProvider: boolean;
}

const verdict: Verdict = {
  rpcReachable: false,
  chainId: null,
  blockHeight: null,
  computeProviders: [],
  qwenProviderFound: false,
  storageIndexerReachable: false,
  storageIndexerStatus: null,
};

console.log(`\n=== 0G Mainnet readiness probe ===`);
console.log(`RPC:     ${MAINNET_RPC}`);
console.log(`Chain:   expected ${MAINNET_CHAIN_ID}`);
console.log(`Indexer: ${MAINNET_INDEXER}\n`);

// ============ 1. RPC reachability ============
console.log("[1/3] checking mainnet RPC…");
try {
  const provider = new ethers.JsonRpcProvider(MAINNET_RPC);
  const network = await provider.getNetwork();
  const block = await provider.getBlockNumber();
  verdict.rpcReachable = true;
  verdict.chainId = Number(network.chainId);
  verdict.blockHeight = block;
  console.log(`  ✓ chainId: ${verdict.chainId}, block: ${verdict.blockHeight}`);
  if (verdict.chainId !== MAINNET_CHAIN_ID) {
    console.log(`  ⚠ unexpected chainId — wanted ${MAINNET_CHAIN_ID}`);
  }
} catch (err) {
  console.log(`  ✗ RPC unreachable: ${err instanceof Error ? err.message : err}`);
}

// ============ 2. 0G Compute providers ============
console.log("\n[2/3] listing 0G Compute providers on mainnet…");
try {
  const broker = await createZGComputeNetworkReadOnlyBroker(MAINNET_RPC, MAINNET_CHAIN_ID);
  // includeUnacknowledged=true to see ALL providers (acknowledged + not)
  const services = await broker.inference.listServiceWithDetail(0, 50, true);
  console.log(`  ✓ ${services.length} provider(s) returned`);

  for (const svc of services) {
    // ServiceWithDetail wraps ServiceStructOutput. The shape isn't documented
    // tightly, so probe defensively.
    const s = svc as unknown as Record<string, unknown> & {
      provider?: string;
      serviceType?: string;
      url?: string;
      model?: string;
      verifiability?: string;
      teeSignerAddress?: string;
      teeSignerAcknowledged?: boolean;
      inputPrice?: bigint;
      outputPrice?: bigint;
    };
    const inner = (svc as any)[0] !== undefined ? svc : (svc as any).service ?? svc;
    const get = (key: string, idx: number): unknown =>
      (inner as any)[key] ?? (svc as any)[idx];

    const address = String(get("provider", 0) ?? "");
    const serviceType = String(get("serviceType", 1) ?? "");
    const url = String(get("url", 2) ?? "");
    const inputPrice = BigInt((get("inputPrice", 3) as bigint | string | number) ?? 0);
    const outputPrice = BigInt((get("outputPrice", 4) as bigint | string | number) ?? 0);
    const model = String(get("model", 6) ?? "");
    const verifiability = String(get("verifiability", 7) ?? "");
    const teeSignerAddress = String(get("teeSignerAddress", 9) ?? "");
    const teeSignerAcknowledged = Boolean(get("teeSignerAcknowledged", 10));

    const isQwen = /qwen/i.test(model);
    const isTee = /TeeML|tee/i.test(verifiability) || teeSignerAcknowledged;

    const summary: ProviderSummary = {
      address,
      serviceType,
      url,
      model,
      verifiability,
      teeSignerAddress,
      teeSignerAcknowledged,
      inputPricePerToken: inputPrice,
      outputPricePerToken: outputPrice,
      isQwen,
      isTee,
      matchesTestnetProvider: address.toLowerCase() === TESTNET_PROVIDER.toLowerCase(),
    };
    verdict.computeProviders.push(summary);
    if (isQwen && teeSignerAcknowledged) verdict.qwenProviderFound = true;

    console.log(
      `    ${address.slice(0, 10)}… · ${serviceType} · ${model || "(no model)"} · ` +
        `verif=${verifiability || "?"} · ack=${teeSignerAcknowledged ? "✓" : "✗"}` +
        (summary.matchesTestnetProvider ? " · ★ same as testnet provider" : "")
    );
  }
} catch (err) {
  console.log(`  ✗ broker init / listService failed: ${err instanceof Error ? err.message : err}`);
}

// ============ 3. Storage indexer ============
console.log("\n[3/3] probing 0G Storage indexer on mainnet…");
try {
  const t0 = Date.now();
  // The indexer responds to JSON-RPC; calling /status endpoint isn't part of
  // the official API. Best probe: try a small `getStatus` via the SDK's first
  // selected node. For pure reachability we can do a HEAD on the base URL
  // and check the connectivity.
  const res = await fetch(MAINNET_INDEXER, { method: "GET" });
  const elapsed = Date.now() - t0;
  verdict.storageIndexerReachable = res.ok || res.status === 404; // 404 is fine — means server is up
  verdict.storageIndexerStatus = `HTTP ${res.status} in ${elapsed}ms`;
  console.log(`  ${verdict.storageIndexerReachable ? "✓" : "✗"} ${verdict.storageIndexerStatus}`);
  if (verdict.storageIndexerReachable) {
    console.log(
      `    note: HTTP-level reachability only. Real upload speed depends on` +
        ` mainnet storage node sync — would need a paid test upload to confirm.`
    );
  }
} catch (err) {
  console.log(`  ✗ indexer unreachable: ${err instanceof Error ? err.message : err}`);
}

// ============ Verdict ============
console.log("\n=== VERDICT ===");
const lines: string[] = [];

if (verdict.rpcReachable && verdict.chainId === MAINNET_CHAIN_ID) {
  lines.push(`✅ Mainnet RPC reachable (chainId ${verdict.chainId}, block ${verdict.blockHeight})`);
} else {
  lines.push(`❌ Mainnet RPC unreachable or wrong chainId — STOP, don't deploy`);
}

const ackProviders = verdict.computeProviders.filter((p) => p.teeSignerAcknowledged);
const qwenProviders = verdict.computeProviders.filter((p) => p.isQwen);
const ackQwenProviders = ackProviders.filter((p) => p.isQwen);

if (verdict.computeProviders.length === 0) {
  lines.push(`❌ No 0G Compute providers on mainnet — full mainnet path NOT viable`);
} else if (ackQwenProviders.length > 0) {
  lines.push(`✅ ${ackQwenProviders.length} TEE-acknowledged Qwen provider(s) — full mainnet PATH VIABLE`);
  for (const p of ackQwenProviders.slice(0, 3)) {
    lines.push(`   ${p.address} · ${p.model} · signer ${p.teeSignerAddress.slice(0, 10)}…`);
  }
} else if (ackProviders.length > 0) {
  lines.push(`⚠️  ${ackProviders.length} TEE-acknowledged provider(s), but none are Qwen — code change needed to use a different model`);
  for (const p of ackProviders.slice(0, 3)) lines.push(`   ${p.address} · ${p.model}`);
} else {
  lines.push(`⚠️  ${verdict.computeProviders.length} provider(s) listed, but none have TEE acknowledged — verifiability claim breaks on mainnet`);
}

if (verdict.storageIndexerReachable) {
  lines.push(`✅ Storage indexer reachable (${verdict.storageIndexerStatus})`);
} else {
  lines.push(`❌ Storage indexer unreachable — Storage on mainnet NOT viable`);
}

console.log(lines.join("\n"));

// ============ Recommendation ============
console.log("\n=== RECOMMENDATION ===");
if (!verdict.rpcReachable) {
  console.log("  STOP. Fix RPC first.");
} else if (ackQwenProviders.length > 0 && verdict.storageIndexerReachable) {
  console.log("  Option A (full mainnet) is VIABLE.");
  console.log("  Buy ~5 0G, redeploy contracts, register 2 bots, run a smoke round.");
  console.log("  Update .env.local with mainnet RPC + indexer + new contract addresses.");
} else if (verdict.storageIndexerReachable) {
  console.log("  Option B (hybrid) is the safe path:");
  console.log("    • Deploy contracts to mainnet (Chain integration)");
  console.log("    • Use mainnet Storage for prompts + traces (Storage integration)");
  console.log("    • Keep Compute on testnet for live AI inference");
  console.log("    • Document this clearly in README — still satisfies hackathon req #3");
} else {
  console.log("  Storage unreachable. Stay on testnet, document mainnet plan as roadmap.");
}

console.log(`\n[verify-mainnet] inspect any provider on the explorer:`);
console.log(`    ${MAINNET_EXPLORER}/address/<address>`);
