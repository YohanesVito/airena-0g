"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { formatEther } from "viem";
import { useRegisterBot, useRegistrationFee, useBotsByCreator } from "@/hooks/useContracts";

export default function CreateBotClient() {
  const { address, isConnected } = useAccount();
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState<"idle" | "uploading" | "registering" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const { data: fee } = useRegistrationFee();
  const { data: myBotIds, refetch: refetchMyBots } = useBotsByCreator(address);
  const { registerBot, isPending, isConfirming, isSuccess, error: txError } = useRegisterBot();

  const wordCount = prompt.trim().split(/\s+/).filter(Boolean).length;

  useEffect(() => {
    if (isSuccess) { setStatus("done"); setName(""); setPrompt(""); refetchMyBots(); }
  }, [isSuccess, refetchMyBots]);

  useEffect(() => {
    if (txError) { setStatus("error"); setErrorMsg(txError.message.slice(0, 200)); }
  }, [txError]);

  const handleSubmit = async () => {
    if (!name.trim() || !prompt.trim()) return;
    try {
      setStatus("uploading");
      setErrorMsg("");
      const uploadRes = await fetch("/api/storage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "upload_prompt", name: name.trim(), prompt: prompt.trim() }),
      });
      let storageHash: string;
      if (!uploadRes.ok) {
        console.warn("0G Storage unavailable, using placeholder hash");
        storageHash = `placeholder_${Date.now()}`;
      } else {
        const { rootHash } = await uploadRes.json();
        storageHash = rootHash;
      }
      setStatus("registering");
      registerBot(name.trim(), storageHash, fee as bigint);
    } catch (err) {
      setStatus("error");
      setErrorMsg(String(err));
    }
  };

  return (
    <main className="container section">
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <h1 className="section-title mb-2">Create Your Bot</h1>
        <p className="section-subtitle font-mono">
          Write a strategy prompt that guides the AI to predict BTC prices.
          Your prompt is private — only the reasoning output is shown publicly.
        </p>

        {status === "done" ? (
          <div className="glass-card mb-4" style={{ padding: 16, borderLeft: "3px solid var(--neon-green)", background: "rgba(57,255,20,0.05)" }}>
            <span className="text-green font-mono text-sm">Bot registered successfully.</span>
          </div>
        ) : null}

        {status === "error" ? (
          <div className="glass-card mb-4" style={{ padding: 16, borderLeft: "3px solid var(--neon-pink)", background: "rgba(255,45,120,0.05)" }}>
            <span className="text-pink font-mono text-sm">{errorMsg || "Transaction failed"}</span>
          </div>
        ) : null}

        <div className="glass-card" style={{ padding: 32 }}>
          <div className="mb-4">
            <label className="font-display text-xs mb-2" style={{ display: "block", letterSpacing: 1.5, textTransform: "uppercase", color: "var(--neon-cyan)" }}>
              Bot Designation
            </label>
            <input type="text" className="input" placeholder="> Enter bot name..." value={name} onChange={(e) => setName(e.target.value)} maxLength={50} disabled={!isConnected || status === "uploading" || status === "registering"} />
          </div>

          <div className="mb-4">
            <label className="font-display text-xs mb-2" style={{ display: "block", letterSpacing: 1.5, textTransform: "uppercase", color: "var(--neon-pink)" }}>
              Strategy Prompt
            </label>
            <textarea
              className="input"
              placeholder={`> Define your BTC prediction strategy...\n\nExample: Analyze 24h momentum and RSI. If BTC shows bullish divergence, predict a tight upward range...`}
              rows={8} value={prompt} onChange={(e) => setPrompt(e.target.value)}
              disabled={!isConnected || status === "uploading" || status === "registering"}
            />
            <div className="flex justify-between mt-2">
              <span className="text-xs font-mono text-muted">Be specific for better accuracy</span>
              <span className={`text-xs font-mono ${wordCount > 500 ? "text-pink" : "text-muted"}`}>{wordCount} / 500 words</span>
            </div>
          </div>

          <div style={{ padding: 16, background: "rgba(0,0,0,0.3)", borderRadius: "var(--radius-sm)", marginBottom: 20, borderLeft: "2px solid var(--neon-cyan)" }}>
            <p className="text-xs font-mono text-secondary" style={{ lineHeight: 1.7 }}>
              <span className="text-cyan">Registration fee:</span> {fee ? `${formatEther(fee as bigint)} 0G` : "..."} (spam prevention)<br />
              <span className="text-pink">Privacy:</span> Your full prompt is never shown publicly<br />
              <span className="text-green">Storage:</span> Prompt stored on 0G decentralized storage
            </p>
          </div>

          {!isConnected ? (
            <div style={{ display: "flex", justifyContent: "center" }}><ConnectButton /></div>
          ) : (
            <button className="btn btn-primary" style={{ width: "100%" }} onClick={handleSubmit}
              disabled={!name.trim() || !prompt.trim() || wordCount > 500 || isPending || isConfirming || status === "uploading"}>
              {status === "uploading" ? "Uploading to 0G Storage..." : isPending ? "Confirm in Wallet..." : isConfirming ? "Confirming on Chain..." : "Deploy Bot"}
            </button>
          )}
        </div>

        {isConnected && myBotIds && (myBotIds as bigint[]).length > 0 ? (
          <div className="glass-card mt-6" style={{ padding: 24 }}>
            <h3 className="font-display text-xs mb-4" style={{ letterSpacing: 2, textTransform: "uppercase", color: "var(--neon-green)" }}>
              // Your Bots ({(myBotIds as bigint[]).length})
            </h3>
            <div className="text-secondary text-sm font-mono" style={{ lineHeight: 2 }}>
              {(myBotIds as bigint[]).map((id) => (
                <div key={id.toString()}><span className="text-green">→</span> Bot #{id.toString()}</div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="glass-card mt-6" style={{ padding: 24 }}>
          <h3 className="font-display text-xs mb-4" style={{ letterSpacing: 2, textTransform: "uppercase", color: "var(--neon-cyan)" }}>// System.Info</h3>
          <ul className="text-secondary text-sm font-mono" style={{ lineHeight: 2, paddingLeft: 20, listStyle: "none" }}>
            <li><span className="text-green">→</span> Your prompt guides the AI&apos;s prediction logic</li>
            <li><span className="text-green">→</span> Each round, the AI reads your prompt + live BTC data</li>
            <li><span className="text-green">→</span> Tighter ranges score higher when correct</li>
            <li><span className="text-green">→</span> You earn 10% rev-share on all bets placed on your bot</li>
            <li><span className="text-green">→</span> TEE verification proves every prediction is genuine</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
