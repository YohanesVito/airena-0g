/**
 * GET /api/price/history?hours=4 — Recent BTC price points from CoinGecko.
 * Returns { data: [{ time: <unix-seconds>, value: <usd> }, ...] } shaped for
 * lightweight-charts. Cached at the edge for 30s.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const hours = Math.min(24, Math.max(1, Number(url.searchParams.get("hours")) || 4));

  try {
    // days=1 gives 5-minute interval data (CoinGecko free tier)
    const res = await fetch(
      "https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=1",
      { next: { revalidate: 30 } }
    );
    if (!res.ok) {
      return Response.json({ error: "CoinGecko market_chart failed" }, { status: 502 });
    }
    const json = (await res.json()) as { prices: [number, number][] };

    // Trim to the last `hours` of data
    const cutoffMs = Date.now() - hours * 60 * 60 * 1000;
    const data = json.prices
      .filter(([ts]) => ts >= cutoffMs)
      .map(([ts, price]) => ({
        time: Math.floor(ts / 1000),
        value: Math.round(price * 100) / 100,
      }));

    return Response.json({ data });
  } catch (error) {
    console.error("[/api/price/history] Error:", error);
    return Response.json({ error: "Internal error fetching BTC history" }, { status: 500 });
  }
}
