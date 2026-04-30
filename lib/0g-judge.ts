/**
 * 0G Judge — a single-shot AI inference that runs once per round to propose
 * candidate prediction zones for the bots. The Judge sees recent BTC volatility
 * + trend; the bots are then nudged to align their predictions with one of the
 * Judge's zones, but can deviate based on their own strategy.
 *
 * Demo narrative: "0G Compute powers BOTH a Judge AI and the trading bots —
 * the Judge frames the market, the bots pick within. Two layers of TEE-
 * verifiable AI inference, all on 0G."
 */
import { runZGInference, type TEEAttestation } from "./0g-compute";

export interface JudgeZone {
  label: string;       // "Bullish breakout", "Sideways", etc.
  priceLow: number;    // USD
  priceHigh: number;   // USD
}

export interface JudgeOutput {
  zones: JudgeZone[];
  reasoning: string;
  tee?: TEEAttestation;
}

// ============ Prompts ============

const JUDGE_SYSTEM_PROMPT = `You are the Airena Judge AI — a market analyst that proposes 3 candidate prediction zones for AI trading bots.

The bots will pick a price range within (or near) one of your zones. Your job is to frame the plausible 1-hour outcomes given recent BTC price action.

OUTPUT FORMAT (JSON only, no markdown, no commentary):
{
  "zones": [
    { "label": "Bullish breakout", "priceLow": 78000, "priceHigh": 78900 },
    { "label": "Sideways", "priceLow": 77400, "priceHigh": 78100 },
    { "label": "Bearish dip", "priceLow": 76800, "priceHigh": 77500 }
  ],
  "reasoning": "2-3 sentence summary of the market context and zone choices."
}

RULES:
- Output ONLY valid JSON. No markdown fences, no extra text.
- Exactly 3 zones.
- Each zone's width = 0.7% to 1.5% of current BTC price.
  Example at \$77,000: each zone width \$540 – \$1,155.
- priceLow MUST be strictly less than priceHigh (rangeWidth > 0).
- Adjacent zones MAY overlap by up to 30%, but should NOT be identical.
- Together the zones should cover a 3%–5% band around the current price
  (e.g. at \$77,000 the outermost low to outermost high should span \$2,300 – \$3,850).
- Labels are 1-3 words describing the scenario.
- Use USD decimal numbers (e.g. 77500.50), no commas, no currency symbols.`;

function buildJudgeUserPrompt(btcPrice: number, recentPrices: number[]): string {
  const samples = recentPrices.length > 0 ? recentPrices : [btcPrice];
  const high = Math.max(...samples);
  const low = Math.min(...samples);
  const first = samples[0];
  const last = samples[samples.length - 1];
  const trendPct = first > 0 ? ((last - first) / first) * 100 : 0;
  const tail = samples.slice(-6).map((p) => `$${p.toFixed(0)}`).join(", ");

  return `Current BTC: $${btcPrice.toFixed(2)}
Recent window high: $${high.toFixed(0)}
Recent window low:  $${low.toFixed(0)}
Window trend:        ${trendPct >= 0 ? "+" : ""}${trendPct.toFixed(2)}%
Last 6 samples:      ${tail}

Propose 3 prediction zones for BTC over the next 1 hour. Output JSON only.`;
}

// ============ Parsing ============

function parseJudgeOutput(content: string): { zones: JudgeZone[]; reasoning: string } {
  const cleaned = content.trim().replace(/```json\s*/gi, "").replace(/```\s*/g, "");
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`No JSON object in judge output: ${content.slice(0, 200)}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (err) {
    throw new Error(`Judge output not valid JSON: ${err}. Raw: ${content.slice(0, 200)}`);
  }

  const obj = parsed as { zones?: unknown; reasoning?: unknown };
  if (!Array.isArray(obj.zones)) {
    throw new Error("Judge output missing `zones` array");
  }

  const zones: JudgeZone[] = obj.zones.map((z, i) => {
    const zo = z as { label?: unknown; priceLow?: unknown; priceHigh?: unknown };
    const priceLow = Number(zo.priceLow);
    const priceHigh = Number(zo.priceHigh);
    if (!Number.isFinite(priceLow) || !Number.isFinite(priceHigh)) {
      throw new Error(`Zone ${i} has non-numeric prices: ${JSON.stringify(z)}`);
    }
    if (priceLow >= priceHigh) {
      throw new Error(`Zone ${i} priceLow >= priceHigh: ${JSON.stringify(z)}`);
    }
    return {
      label: String(zo.label ?? `Zone ${i + 1}`).slice(0, 32),
      priceLow,
      priceHigh,
    };
  });

  return {
    zones,
    reasoning: String(obj.reasoning ?? "").slice(0, 600),
  };
}

// ============ Public API ============

/**
 * Run the Judge AI to produce candidate prediction zones for a round.
 *
 * @param btcPrice      Current BTC price (USD)
 * @param recentPrices  Recent BTC samples for context (optional but recommended)
 */
export async function runJudgeInference(
  btcPrice: number,
  recentPrices: number[] = []
): Promise<JudgeOutput> {
  // Retry up to 3x: transient TLS disconnects to the compute provider are
  // common and a single failure shouldn't lose the whole judge layer.
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const { content, tee } = await runZGInference(
        JUDGE_SYSTEM_PROMPT,
        buildJudgeUserPrompt(btcPrice, recentPrices),
        { logTag: `Judge#${attempt}`, temperature: 0.6, maxTokens: 400 }
      );
      const parsed = parseJudgeOutput(content);
      return { ...parsed, tee };
    } catch (err) {
      lastErr = err;
      console.warn(`[Judge] attempt ${attempt}/3 failed:`, err instanceof Error ? err.message : err);
      if (attempt < 3) await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
  throw lastErr;
}

/**
 * Render a Judge's zones as a string fragment to inject into a bot's system
 * prompt — encourages alignment without forcing it.
 */
export function renderZonesForBotPrompt(zones: JudgeZone[]): string {
  if (zones.length === 0) return "";
  const lines = zones
    .map(
      (z, i) =>
        `  ${i + 1}. ${z.label}: $${z.priceLow.toFixed(2)} – $${z.priceHigh.toFixed(2)}`
    )
    .join("\n");
  return `\n\nThe Judge AI has proposed these candidate zones for this round:\n${lines}\n\nLean toward picking a range that aligns with one of these zones, but you may deviate if your strategy strongly disagrees. Always justify your choice in your reasoning.`;
}
