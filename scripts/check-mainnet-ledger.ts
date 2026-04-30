import { createZGComputeNetworkBroker } from "@0glabs/0g-serving-broker";
import { ethers } from "ethers";

const wallet = new ethers.Wallet(
  process.env.PRIVATE_KEY!,
  new ethers.JsonRpcProvider("https://evmrpc.0g.ai")
);
const broker = await createZGComputeNetworkBroker(wallet);

const ledger = await broker.ledger.getLedger();
console.log("ledger total:     " + ethers.formatEther(ledger.totalBalance) + " 0G");
console.log("ledger available: " + ethers.formatEther(ledger.availableBalance) + " 0G");

const providers = await broker.ledger.getProvidersWithBalance("inference");
for (const [addr, balance, pendingRefund] of providers) {
  console.log("  provider " + addr + ":");
  console.log("    balance:        " + ethers.formatEther(balance) + " 0G");
  console.log("    pendingRefund:  " + ethers.formatEther(pendingRefund) + " 0G");
}
