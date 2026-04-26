import { Indexer, MemData } from "@0gfoundation/0g-ts-sdk";
import { ethers } from "ethers";

// ============ Config ============

const TESTNET_RPC = process.env.NEXT_PUBLIC_RPC_URL || "https://evmrpc-testnet.0g.ai";
const INDEXER_RPC = process.env.INDEXER_RPC || "https://indexer-storage-testnet-turbo.0g.ai";
const FLOW_CONTRACT = "0x0460aA47b41a66694c0a73f667a1b795A5ED3556"; // Testnet flow contract

// ============ Types ============

export interface StorageResult {
  rootHash: string;
  txHash: string;
}

export interface BotPromptData {
  name: string;
  prompt: string;
  createdAt: number;
}

export interface ReasoningTraceData {
  botId: number;
  roundId: number;
  priceLow: number;
  priceHigh: number;
  reasoning: string;
  timestamp: number;
}

// ============ Core Functions ============

/**
 * Get an ethers signer from the server's private key.
 */
function getSigner(): ethers.Wallet {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("PRIVATE_KEY not set in environment");
  }
  const provider = new ethers.JsonRpcProvider(TESTNET_RPC);
  return new ethers.Wallet(privateKey, provider);
}

/**
 * Store bot prompt data on 0G Storage.
 * @param data Bot name and strategy prompt
 * @returns rootHash to be saved on-chain in BotRegistry
 */
export async function storeBotPrompt(data: BotPromptData): Promise<StorageResult> {
  const jsonStr = JSON.stringify(data);
  const bytes = new TextEncoder().encode(jsonStr);

  return uploadToStorage(bytes);
}

/**
 * Store reasoning trace after AI inference on 0G Storage.
 * @param data Reasoning trace with prediction details
 * @returns rootHash to be saved on-chain in BettingPool
 */
export async function storeReasoningTrace(data: ReasoningTraceData): Promise<StorageResult> {
  const jsonStr = JSON.stringify(data);
  const bytes = new TextEncoder().encode(jsonStr);

  return uploadToStorage(bytes);
}

/**
 * Retrieve data from 0G Storage by rootHash.
 * @param rootHash The root hash returned from a previous upload
 * @returns The stored data as a string
 */
export async function retrieveFromStorage(rootHash: string): Promise<string> {
  const indexer = new Indexer(INDEXER_RPC);

  const [blob, error] = await indexer.downloadToBlob(rootHash);

  if (error) {
    throw new Error(`Failed to download from 0G Storage: ${error.message}`);
  }

  return await blob.text();
}

/**
 * Retrieve and parse bot prompt data from 0G Storage.
 */
export async function getBotPrompt(rootHash: string): Promise<BotPromptData> {
  const data = await retrieveFromStorage(rootHash);
  return JSON.parse(data) as BotPromptData;
}

/**
 * Retrieve and parse reasoning trace from 0G Storage.
 */
export async function getReasoningTrace(rootHash: string): Promise<ReasoningTraceData> {
  const data = await retrieveFromStorage(rootHash);
  return JSON.parse(data) as ReasoningTraceData;
}

// ============ Internal ============

/**
 * Upload raw bytes to 0G Storage via the Indexer.
 */
async function uploadToStorage(data: Uint8Array): Promise<StorageResult> {
  const signer = getSigner();
  const indexer = new Indexer(INDEXER_RPC);
  const file = new MemData(data);

  const [result, error] = await indexer.upload(
    file,
    TESTNET_RPC,
    signer,
    undefined, // uploadOpts
    undefined, // retryOpts
  );

  if (error) {
    throw new Error(`Failed to upload to 0G Storage: ${error.message}`);
  }

  // Handle both single and split upload results
  const uploadResult = result as { txHash: string; rootHash: string; txSeq: number };

  return {
    rootHash: uploadResult.rootHash,
    txHash: uploadResult.txHash,
  };
}
