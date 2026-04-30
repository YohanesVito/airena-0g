"use client";

import { connectorsForWallets, RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { injectedWallet, metaMaskWallet } from "@rainbow-me/rainbowkit/wallets";
import { WagmiProvider, createConfig, http } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { defineChain } from "viem";
import "@rainbow-me/rainbowkit/styles.css";

// 0G Mainnet (Aristotle, chain 16661) — deployed 2026-04-30
export const zgMainnet = defineChain({
  id: 16661,
  name: "0G-Mainnet",
  nativeCurrency: { name: "0G", symbol: "0G", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://evmrpc.0g.ai"] },
  },
  blockExplorers: {
    default: { name: "ChainScan", url: "https://chainscan.0g.ai" },
  },
  testnet: false,
});

// Re-export under the old name so existing imports keep working — both names
// point at the active deployment chain (mainnet).
export const zgGalileo = zgMainnet;

// We avoid getDefaultConfig because it always wires up a WalletConnect
// connector — which silently breaks the read transport when no projectId
// is configured. MetaMask + injected only is enough for the demo.
const connectors = connectorsForWallets(
  [
    {
      groupName: "Wallets",
      wallets: [metaMaskWallet, injectedWallet],
    },
  ],
  {
    appName: "Airena",
    // projectId is required by the type but unused without WalletConnect.
    projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "0g-airena",
  }
);

const config = createConfig({
  chains: [zgMainnet],
  connectors,
  transports: {
    [zgMainnet.id]: http("https://evmrpc.0g.ai"),
  },
  // ssr: false — keeping reads purely client-side avoids a hydration race
  // where the server-rendered "no data" state sticks around even after the
  // client transport is wired up.
  ssr: false,
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: "#00F0FF",
            accentColorForeground: "#000",
            borderRadius: "medium",
          })}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
