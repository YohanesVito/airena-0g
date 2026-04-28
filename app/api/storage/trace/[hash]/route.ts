import { retrieveFromStorage } from "@/lib/0g-storage";

/**
 * GET /api/storage/trace/<rootHash>
 *
 * Retrieves a reasoning trace by 0G Storage rootHash and returns the parsed
 * JSON. Reasoning traces are immutable, so the response is cached aggressively.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ hash: string }> }
) {
  const { hash } = await params;
  if (!hash || !hash.startsWith("0x")) {
    return Response.json({ error: "invalid rootHash" }, { status: 400 });
  }

  try {
    const raw = await retrieveFromStorage(hash);
    const trace = JSON.parse(raw);
    return Response.json(
      { trace },
      {
        headers: {
          // Aggressive cache: traces never change once written.
          "Cache-Control": "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800",
        },
      }
    );
  } catch (err) {
    console.error("[/api/storage/trace] Error:", err);
    return Response.json(
      { error: String(err) },
      { status: 502 }
    );
  }
}
