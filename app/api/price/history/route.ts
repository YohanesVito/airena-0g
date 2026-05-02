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

    // Trim to the last `hours` of data, then dedupe by second-precision time.
    // CoinGecko sometimes appends a live "now" sample whose floored second
    // matches the previous binned sample — lightweight-charts rejects any
    // non-strictly-ascending series with "data must be asc ordered by time".
    // Last writer wins so the freshest price for that second is kept.
    const cutoffMs = Date.now() - hours * 60 * 60 * 1000;
    const dedup = new Map<number, number>();
    for (const [ts, price] of json.prices) {
      if (ts < cutoffMs) continue;
      dedup.set(Math.floor(ts / 1000), Math.round(price * 100) / 100);
    }
    const data = Array.from(dedup, ([time, value]) => ({ time, value }))
      .sort((a, b) => a.time - b.time);

    return Response.json({ data });
  } catch (error) {
    console.error("[/api/price/history] Error:", error);
    return Response.json({ error: "Internal error fetching BTC history" }, { status: 500 });
  }
}
