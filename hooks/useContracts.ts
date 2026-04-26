"use client";

import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useAccount } from "wagmi";
import { parseEther, formatEther } from "viem";
import { CONTRACTS, BOT_REGISTRY_ABI, BETTING_POOL_ABI } from "@/lib/contracts";

// ============ Contract addresses as viem Address ============

const botRegistryAddress = CONTRACTS.botRegistry as `0x${string}`;
const bettingPoolAddress = CONTRACTS.bettingPool as `0x${string}`;

// ============ BotRegistry Hooks ============

export function useBotCount() {
  return useReadContract({
    address: botRegistryAddress,
    abi: BOT_REGISTRY_ABI,
    functionName: "botCount",
  });
}

export function useRegistrationFee() {
  return useReadContract({
    address: botRegistryAddress,
    abi: BOT_REGISTRY_ABI,
    functionName: "registrationFee",
  });
}

export function useBot(botId: number) {
  return useReadContract({
    address: botRegistryAddress,
    abi: BOT_REGISTRY_ABI,
    functionName: "getBot",
    args: [BigInt(botId)],
    query: { enabled: botId > 0 },
  });
}

export function useActiveBots() {
  return useReadContract({
    address: botRegistryAddress,
    abi: BOT_REGISTRY_ABI,
    functionName: "getActiveBots",
  });
}

export function useBotsRange(start: number, limit: number) {
  return useReadContract({
    address: botRegistryAddress,
    abi: BOT_REGISTRY_ABI,
    functionName: "getBotsRange",
    args: [BigInt(start), BigInt(limit)],
    query: { enabled: start > 0 },
  });
}

export function useBotsByCreator(creator: string | undefined) {
  return useReadContract({
    address: botRegistryAddress,
    abi: BOT_REGISTRY_ABI,
    functionName: "getBotsByCreator",
    args: [creator as `0x${string}`],
    query: { enabled: !!creator },
  });
}

export function useRegisterBot() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const registerBot = (name: string, storageHash: string, fee: bigint) => {
    writeContract({
      address: botRegistryAddress,
      abi: BOT_REGISTRY_ABI,
      functionName: "registerBot",
      args: [name, storageHash],
      value: fee,
    });
  };

  return { registerBot, hash, isPending, isConfirming, isSuccess, error };
}

// ============ BettingPool Hooks ============

export function useRoundCount() {
  return useReadContract({
    address: bettingPoolAddress,
    abi: BETTING_POOL_ABI,
    functionName: "roundCount",
  });
}

export function useRound(roundId: number) {
  return useReadContract({
    address: bettingPoolAddress,
    abi: BETTING_POOL_ABI,
    functionName: "getRound",
    args: [BigInt(roundId)],
    query: { enabled: roundId > 0 },
  });
}

export function useRoundBots(roundId: number) {
  return useReadContract({
    address: bettingPoolAddress,
    abi: BETTING_POOL_ABI,
    functionName: "getRoundBots",
    args: [BigInt(roundId)],
    query: { enabled: roundId > 0 },
  });
}

export function usePrediction(roundId: number, botId: number) {
  return useReadContract({
    address: bettingPoolAddress,
    abi: BETTING_POOL_ABI,
    functionName: "getPrediction",
    args: [BigInt(roundId), BigInt(botId)],
    query: { enabled: roundId > 0 && botId > 0 },
  });
}

export function useBotPoolSize(roundId: number, botId: number) {
  return useReadContract({
    address: bettingPoolAddress,
    abi: BETTING_POOL_ABI,
    functionName: "botPoolSize",
    args: [BigInt(roundId), BigInt(botId)],
    query: { enabled: roundId > 0 && botId > 0 },
  });
}

export function useHasClaimed(roundId: number, address: string | undefined) {
  return useReadContract({
    address: bettingPoolAddress,
    abi: BETTING_POOL_ABI,
    functionName: "hasClaimed",
    args: [BigInt(roundId), address as `0x${string}`],
    query: { enabled: roundId > 0 && !!address },
  });
}

export function useCreatorEarnings(address: string | undefined) {
  return useReadContract({
    address: bettingPoolAddress,
    abi: BETTING_POOL_ABI,
    functionName: "creatorEarnings",
    args: [address as `0x${string}`],
    query: { enabled: !!address },
  });
}

export function usePlaceBet() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const placeBet = (roundId: number, botId: number, amount: string) => {
    writeContract({
      address: bettingPoolAddress,
      abi: BETTING_POOL_ABI,
      functionName: "placeBet",
      args: [BigInt(roundId), BigInt(botId)],
      value: parseEther(amount),
    });
  };

  return { placeBet, hash, isPending, isConfirming, isSuccess, error };
}

export function useClaimWinnings() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const claimWinnings = (roundId: number) => {
    writeContract({
      address: bettingPoolAddress,
      abi: BETTING_POOL_ABI,
      functionName: "claimWinnings",
      args: [BigInt(roundId)],
    });
  };

  return { claimWinnings, hash, isPending, isConfirming, isSuccess, error };
}

export function useWithdrawCreatorEarnings() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const withdraw = () => {
    writeContract({
      address: bettingPoolAddress,
      abi: BETTING_POOL_ABI,
      functionName: "withdrawCreatorEarnings",
    });
  };

  return { withdraw, hash, isPending, isConfirming, isSuccess, error };
}

// ============ Helpers ============

export const ROUND_STATUS = ["OPEN", "PREDICTING", "BETTING", "SETTLED"] as const;

export function formatRoundStatus(status: number): string {
  return ROUND_STATUS[status] ?? "UNKNOWN";
}

export function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function centsToUsd(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}
