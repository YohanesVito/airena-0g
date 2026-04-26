import { createZGComputeNetworkBroker } from "@0glabs/0g-serving-broker";
import { ethers } from "ethers";

// ============ Config ============

const TESTNET_RPC = process.env.NEXT_PUBLIC_RPC_URL || "https://evmrpc-testnet.0g.ai";
const COMPUTE_PROVIDER = process.env.COMPUTE_PROVIDER_ADDRESS || "";
const MODEL = "qwen-2.5-7b-instruct";

// ============ Types ============

export interface BotPrediction {
  priceLow: number;
  priceHigh: number;
  reasoning: string;
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
 * Run a bot's strategy prompt through 0G Compute inference.
 * @param botPrompt The bot's strategy prompt (from 0G Storage)
 * @param btcPrice Current BTC price in USD
 * @returns Parsed prediction with price range and reasoning
 */
export async function runBotInference(
  botPrompt: string,
  btcPrice: number
): Promise<BotPrediction> {
  const signer = getSigner();

  // 1. Initialize broker (auto-detects testnet contracts)
  const broker = await createZGComputeNetworkBroker(signer);

  // 2. Get service metadata (endpoint + model)
  const { endpoint, model } = await broker.inference.requestProcessor.getServiceMetadata(
    COMPUTE_PROVIDER
  );

  console.log(`[0G Compute] Using endpoint: ${endpoint}, model: ${model}`);

  // 3. Generate single-use auth headers
  const headers = await broker.inference.requestProcessor.getRequestHeaders(
    COMPUTE_PROVIDER
  );

  // 4. Call inference
  const response = await fetch(`${endpoint}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify({
      messages: [
        {
          role: "system",
          content: buildSystemPrompt(botPrompt),
        },
        {
          role: "user",
          content: `Current BTC price: $${btcPrice.toFixed(2)}. Predict the BTC price range in 1 hour from now. Output JSON only.`,
        },
      ],
      model: model || MODEL,
      temperature: 0.7,
      max_tokens: 300,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`0G Compute inference failed: ${response.status} — ${errorText}`);
  }

  const data: LLMResponse = await response.json();
  const content = data.choices[0]?.message?.content;

  if (!content) {
    throw new Error("Empty response from 0G Compute");
  }

  // 5. Parse prediction from LLM output
  const prediction = parsePrediction(content);

  // 6. TEE verification — verify the response is genuine
  const chatID = data.id;
  try {
    await broker.inference.responseProcessor.processResponse(
      COMPUTE_PROVIDER,
      chatID
    );
    console.log(`[0G Compute] TEE verification passed for chat ${chatID}`);
  } catch (err) {
    console.warn(`[0G Compute] TEE verification warning: ${err}`);
    // Don't throw — continue with the prediction even if TEE verify has issues
  }

  return prediction;
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
