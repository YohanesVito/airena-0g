import { NextRequest } from "next/server";

/**
 * GET /api/price — Fetch current BTC price from CoinGecko.
 * Returns { price: number, priceInCents: number, timestamp: number }
 */
export async function GET() {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
      { next: { revalidate: 30 } } // Cache for 30 seconds
    );

    if (!res.ok) {
      return Response.json(
        { error: "Failed to fetch BTC price from CoinGecko" },
        { status: 502 }
      );
    }

    const data = await res.json();
    const price = data.bitcoin.usd;

    return Response.json({
      price,
      priceInCents: Math.round(price * 100),
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("[/api/price] Error:", error);
    return Response.json(
      { error: "Internal error fetching BTC price" },
      { status: 500 }
    );
  }
}
