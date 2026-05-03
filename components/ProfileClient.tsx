"use client";

import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { shortenAddress } from "@/hooks/useContracts";
import BetHistory from "@/components/BetHistory";

export default function ProfileClient() {
  const { address, isConnected } = useAccount();

  if (!isConnected || !address) {
    return (
      <main className="container section">
        <h1 className="section-title mb-2">Profile</h1>
        <p className="section-subtitle font-mono">
          Your bet history, ready-to-claim winnings, and refund-eligible bets.
        </p>

        <div className="glass-card" style={{ padding: 56, textAlign: "center" }}>
          <p className="font-display text-sm" style={{ letterSpacing: 1, marginBottom: 16 }}>
            CONNECT WALLET TO VIEW PROFILE
          </p>
          <p className="font-mono text-xs text-muted mb-4">
            Your bets across recent rounds will load once your wallet is connected.
          </p>
          <div className="flex justify-center mt-4">
            <ConnectButton />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="container section">
      <h1 className="section-title mb-2">Profile</h1>
      <p className="section-subtitle font-mono">
        {shortenAddress(address)} · betting history across recent rounds
      </p>

      <BetHistory address={address} />
    </main>
  );
}
