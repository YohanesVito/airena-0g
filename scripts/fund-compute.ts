import { createZGComputeNetworkBroker } from "@0glabs/0g-serving-broker";
import { ethers } from "ethers";

// Min ledger balance to create one is 3 0G. Default to 4 for headroom.
const DEPOSIT_OG = Number(process.env.DEPOSIT_OG ?? 4);
const RPC = process.env.NEXT_PUBLIC_RPC_URL ?? "https://evmrpc-testnet.0g.ai";
const PROVIDER = process.env.COMPUTE_PROVIDER_ADDRESS;
const PK = process.env.PRIVATE_KEY;

if (!PK) throw new Error("PRIVATE_KEY missing in .env.local");
if (!PROVIDER) throw new Error("COMPUTE_PROVIDER_ADDRESS missing in .env.local");

const wallet = new ethers.Wallet(PK, new ethers.JsonRpcProvider(RPC));
console.log(`[fund-compute] wallet: ${wallet.address}`);

const walletBal = await wallet.provider!.getBalance(wallet.address);
console.log(`[fund-compute] wallet balance: ${ethers.formatEther(walletBal)} 0G`);

const broker = await createZGComputeNetworkBroker(wallet);

let hasLedger = false;
try {
  const ledger = await broker.ledger.getLedger();
  hasLedger = true;
  // ledger.totalBalance and ledger.availableBalance are bigints in neuron (1e18)
  console.log(
    `[fund-compute] existing ledger — total: ${ethers.formatEther(ledger.totalBalance)} 0G, available: ${ethers.formatEther(ledger.availableBalance)} 0G`
  );
} catch (err) {
  console.log(`[fund-compute] no ledger yet (${(err as Error).message.split("\n")[0]})`);
}

if (!hasLedger) {
  console.log(`[fund-compute] creating ledger with ${DEPOSIT_OG} 0G…`);
  await broker.ledger.addLedger(DEPOSIT_OG);
  console.log(`[fund-compute] ✓ ledger created`);
} else if (process.env.TOPUP === "1") {
  console.log(`[fund-compute] topping up by ${DEPOSIT_OG} 0G…`);
  await broker.ledger.depositFund(DEPOSIT_OG);
  console.log(`[fund-compute] ✓ deposit complete`);
} else {
  console.log(`[fund-compute] ledger already exists — set TOPUP=1 to add more`);
}

// Transfer some funds into the inference provider sub-account so requests work.
// MIN_TRANSFER_AMOUNT_OG = 1 0G in neuron.
const MIN_PROVIDER_FUND = ethers.parseEther("1");
const providers = await broker.ledger.getProvidersWithBalance("inference");
const existing = providers.find(([addr]) => addr.toLowerCase() === PROVIDER.toLowerCase());
const currentProviderBal = existing?.[1] ?? 0n;
console.log(
  `[fund-compute] provider ${PROVIDER} sub-account balance: ${ethers.formatEther(currentProviderBal)} 0G`
);

if (currentProviderBal < MIN_PROVIDER_FUND) {
  console.log(`[fund-compute] transferring 1 0G to provider sub-account…`);
  await broker.ledger.transferFund(PROVIDER, "inference", MIN_PROVIDER_FUND);
  console.log(`[fund-compute] ✓ provider sub-account funded`);
}

const finalLedger = await broker.ledger.getLedger();
console.log(
  `\n[fund-compute] DONE — ledger total: ${ethers.formatEther(finalLedger.totalBalance)} 0G, available: ${ethers.formatEther(finalLedger.availableBalance)} 0G`
);
