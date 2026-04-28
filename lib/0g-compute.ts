import { createZGComputeNetworkBroker } from "@0glabs/0g-serving-broker";
import { ethers } from "ethers";

// ============ Config ============

const TESTNET_RPC = process.env.NEXT_PUBLIC_RPC_URL || "https://evmrpc-testnet.0g.ai";
const COMPUTE_PROVIDER = process.env.COMPUTE_PROVIDER_ADDRESS || "";
const MODEL = "qwen-2.5-7b-instruct";

// ============ Types ============

export interface TEEAttestation {
  // Set when TEE verification succeeded and we successfully fetched the
  // signature payload. Useful for surfacing a "verified" badge in the UI.
  signature: string;       // hex-encoded ECDSA signature over `signedText`
  signer: string;          // recovered/expected signing address (TEE signer)
  signedText: string;      // exact bytes the provider signed (commitment)
  chatID: string;          // ZG-Res-Key value, lookup key on the provider
  verified: boolean;       // result of broker.processResponse
}

export interface BotPrediction {
  priceLow: number;
  priceHigh: number;
  reasoning: string;
  tee?: TEEAttestation;
}

interface LLMResponse {
  id: string;
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

// ============ System Prompt ============

function buildSystemPrompt(botStrategy: string): string {
  return `You are a BTC price prediction agent for the Airena platform. Your strategy:

${botStrategy}

RULES:
- You MUST output ONLY valid JSON, no other text
- Format: { "priceLow": number, "priceHigh": number, "reasoning": "string" }
- priceLow and priceHigh must be in USD (e.g., 103500.00)
- priceLow must be less than priceHigh
- Tighter ranges score higher IF correct, but wrong predictions score 0
- reasoning: 2-3 sentences explaining your analysis
- Do NOT include any markdown formatting, code blocks, or extra text`;
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
 * Generic 0G Compute inference call. Returns the raw LLM `content` string
 * plus a TEE attestation (when verifiable). Callers parse `content` into
 * their own structured shape.
 *
 * Used by both runBotInference (bot strategy → price range) and the Judge AI
 * in lib/0g-judge.ts (recent volatility → candidate zones).
 */
export async function runZGInference(
  systemPrompt: string,
  userPrompt: string,
  opts?: { temperature?: number; maxTokens?: number; logTag?: string }
): Promise<{ content: string; tee?: TEEAttestation }> {
  const signer = getSigner();
  const broker = await createZGComputeNetworkBroker(signer);

  const { endpoint, model } = await broker.inference.requestProcessor.getServiceMetadata(
    COMPUTE_PROVIDER
  );

  const tag = opts?.logTag ?? "0G Compute";
  console.log(`[${tag}] endpoint=${endpoint} model=${model}`);

  const headers = await broker.inference.requestProcessor.getRequestHeaders(COMPUTE_PROVIDER);

  const response = await fetch(`${endpoint}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      model: model || MODEL,
      temperature: opts?.temperature ?? 0.7,
      max_tokens: opts?.maxTokens ?? 300,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`0G Compute inference failed: ${response.status} — ${errorText}`);
  }

  // The provider's signature endpoint is keyed by the ZG-Res-Key response
  // header, NOT the OpenAI completion id. Falling back to data.id will give
  // a 400 chat_id_not_found from the signature lookup.
  const chatID = response.headers.get("ZG-Res-Key") ?? "";
  const data: LLMResponse = await response.json();
  const content = data.choices[0]?.message?.content;

  if (!content) {
    throw new Error("Empty response from 0G Compute");
  }

  let tee: TEEAttestation | undefined;
  if (chatID) {
    try {
      const verified = await broker.inference.responseProcessor.processResponse(
        COMPUTE_PROVIDER,
        chatID
      );
      const sigRes = await fetch(
        `${endpoint}/signature/${chatID}?model=${encodeURIComponent(model || MODEL)}`
      );
      if (sigRes.ok) {
        const sigData = (await sigRes.json()) as {
          text: string;
          signature: string;
          signing_address: string;
        };
        tee = {
          signature: sigData.signature,
          signer: sigData.signing_address,
          signedText: sigData.text,
          chatID,
          verified: !!verified,
        };
        console.log(
          `[${tag}] TEE ${verified ? "✓ verified" : "✗ unverified"} (signer ${sigData.signing_address})`
        );
      }
    } catch (err) {
      console.warn(`[${tag}] TEE attestation capture failed: ${err}`);
    }
  }

  return { content, tee };
}

/**
 * Run a bot's strategy prompt through 0G Compute inference.
 * @param botPrompt The bot's strategy prompt (from 0G Storage)
 * @param btcPrice Current BTC price in USD
 * @param contextSuffix Optional extra context (e.g., judge zones) appended to system prompt
 * @returns Parsed prediction with price range, reasoning, and TEE attestation
 */
export async function runBotInference(
  botPrompt: string,
  btcPrice: number,
  contextSuffix?: string
): Promise<BotPrediction> {
  const sys = buildSystemPrompt(botPrompt) + (contextSuffix ?? "");
  const { content, tee } = await runZGInference(
    sys,
    `Current BTC price: $${btcPrice.toFixed(2)}. Predict the BTC price range in 1 hour from now. Output JSON only.`,
    { logTag: "Bot" }
  );
  const prediction = parsePrediction(content);
  return { ...prediction, tee };
}

// ============ Parsing ============

/**
 * Parse the LLM's JSON output into a structured prediction.
 * Handles common LLM output quirks (markdown code blocks, extra text).
 */
function parsePrediction(content: string): BotPrediction {
  // Strip markdown code blocks if present
  let cleaned = content.trim();
  cleaned = cleaned.replace(/```json\s*/gi, "").replace(/```\s*/g, "");

  // Try to find JSON in the output
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`Failed to parse prediction JSON from LLM output: ${content}`);
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);

    const priceLow = Number(parsed.priceLow);
    const priceHigh = Number(parsed.priceHigh);
    const reasoning = String(parsed.reasoning || "No reasoning provided");

    if (isNaN(priceLow) || isNaN(priceHigh)) {
      throw new Error("priceLow or priceHigh is not a valid number");
    }

    if (priceLow >= priceHigh) {
      throw new Error(`Invalid range: priceLow (${priceLow}) >= priceHigh (${priceHigh})`);
    }

    return { priceLow, priceHigh, reasoning };
  } catch (err) {
    throw new Error(`Failed to parse prediction: ${err}. Raw output: ${content}`);
  }
}

/**
 * Convert a USD price to cents (integer) for on-chain storage.
 * e.g., $103,500.00 → 10350000
 */
export function priceToCents(usdPrice: number): number {
  return Math.round(usdPrice * 100);
}
