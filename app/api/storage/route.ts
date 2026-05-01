import { NextRequest } from "next/server";
import { storeBotPrompt, retrieveFromStorage } from "@/lib/0g-storage";

// 0G Storage uploads + sync can take 30-90s; retrievals are usually under 5s
// but sync delays can stretch them. The 0G SDK requires Node APIs.
export const maxDuration = 120;
export const runtime = "nodejs";

/**
 * POST /api/storage — Upload data to 0G Storage
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case "upload_prompt": {
        const { name, prompt } = body;
        if (!name || !prompt) {
          return Response.json({ error: "name and prompt are required" }, { status: 400 });
        }

        const result = await storeBotPrompt({
          name,
          prompt,
          createdAt: Date.now(),
        });

        return Response.json({
          rootHash: result.rootHash,
          txHash: result.txHash,
        });
      }

      case "retrieve": {
        const { rootHash } = body;
        if (!rootHash) {
          return Response.json({ error: "rootHash is required" }, { status: 400 });
        }

        const data = await retrieveFromStorage(rootHash);
        return Response.json({ data: JSON.parse(data) });
      }

      default:
        return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error("[/api/storage] Error:", error);
    return Response.json({ error: String(error) }, { status: 500 });
  }
}
