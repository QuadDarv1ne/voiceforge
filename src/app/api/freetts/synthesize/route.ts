import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/freetts/synthesize
 *
 * Synthesizes speech using the freetts.ru engine.
 *
 * Request body:
 *   {
 *     "text": string,         // required, max 1024 chars
 *     "voice": string,        // required, voice hash id (e.g. "tOvhtxQAgtH")
 *   }
 *
 * New freetts.ru API flow (2026):
 *   1. POST /api/synthesis  →  { status: "pending", ... }
 *   2. Poll GET /api/history until a "done" entry with an audio URL appears
 *   3. Download the MP3 from the audio URL
 *
 * The old endpoint (POST /api/v2/s with {voice, text}) was removed.
 * Voice IDs are now hash strings (e.g. "tOvhtxQAgtH"), not "ru-RU066".
 *
 * Response: binary audio (MP3) or JSON error.
 */

const FREETTS_SYNTH_URL = "https://freetts.ru/api/synthesis";
const FREETTS_HISTORY_URL = "https://freetts.ru/api/history";

const BROWSER_HEADERS: Record<string, string> = {
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
  "Content-Type": "application/json",
  Origin: "https://freetts.ru",
  Referer: "https://freetts.ru/",
  "Sec-Ch-Ua":
    '"Chromium";v="120", "Not?A_Brand";v="24", "Google Chrome";v="120"',
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": '"Windows"',
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-origin",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

// U+2063 INVISIBLE SEPARATOR — the frontend prepends this to the text;
// the synthesis API rejects the request without it.
const INVISIBLE_SEP = "\u2063";

interface SynthesisResponse {
  status: string;
  message?: string;
  data?: unknown;
}

interface HistoryEntry {
  id: number;
  name: string;
  text: string;
  url: string;
  status: string;
}

/**
 * Strategy 1 — new freetts.ru API: POST synthesis, poll history, download.
 */
async function tryNewApi(
  body: { voice: string; text: string },
): Promise<{ ok: true; mp3: Buffer } | { ok: false; reason: string }> {
  try {
    // 1. Start the synthesis job
    const synthRes = await fetch(FREETTS_SYNTH_URL, {
      method: "POST",
      headers: BROWSER_HEADERS,
      body: JSON.stringify({
        voiceid: body.voice,
        text: INVISIBLE_SEP + body.text,
      }),
      redirect: "follow",
    });

    if (!synthRes.ok) {
      return { ok: false, reason: `synthesis HTTP ${synthRes.status}` };
    }

    const synthJson = (await synthRes.json()) as SynthesisResponse;
    if (synthJson.status === "error") {
      return {
        ok: false,
        reason: synthJson.message || "synthesis returned error",
      };
    }

    // 2. Poll history until our job is done (freetts synthesizes asynchronously)
    const deadline = Date.now() + 50000; // max 50s wait
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 2000));

      const histRes = await fetch(FREETTS_HISTORY_URL, {
        headers: BROWSER_HEADERS,
        signal: AbortSignal.timeout(15000),
      });
      if (!histRes.ok) continue;

      const histJson = (await histRes.json()) as {
        status: string;
        data?: HistoryEntry[];
      };
      if (histJson.status !== "success" || !Array.isArray(histJson.data)) {
        continue;
      }

      // Find the newest entry matching our voice + text
      const match = histJson.data.find(
        (e) =>
          e.status === "done" &&
          e.name &&
          e.url &&
          e.text === body.text,
      );
      if (match?.url) {
        // 3. Download the MP3
        const audioRes = await fetch(match.url, {
          headers: {
            "User-Agent": BROWSER_HEADERS["User-Agent"],
            Referer: "https://freetts.ru/",
          },
          signal: AbortSignal.timeout(30000),
        });
        if (!audioRes.ok) {
          return { ok: false, reason: `audio HTTP ${audioRes.status}` };
        }
        const mp3 = Buffer.from(await audioRes.arrayBuffer());
        if (mp3.length === 0) {
          return { ok: false, reason: "empty audio" };
        }
        return { ok: true, mp3 };
      }
    }

    return { ok: false, reason: "synthesis timed out (pending)" };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : "Network error",
    };
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, voice } = body;

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json(
        { error: "Text is required" },
        { status: 400 },
      );
    }
    if (!voice || typeof voice !== "string") {
      return NextResponse.json(
        { error: "Voice code is required (e.g. tOvhtxQAgtH)" },
        { status: 400 },
      );
    }
    if (text.length > 1024) {
      return NextResponse.json(
        {
          error:
            "Text exceeds 1024 characters (freetts.ru limit). Please shorten the text.",
        },
        { status: 400 },
      );
    }

    const payload = { voice, text: text.trim() };

    // Try the new freetts.ru API (synthesis + history polling)
    const result = await tryNewApi(payload);
    if (result.ok) {
      return new NextResponse(new Uint8Array(result.mp3), {
        status: 200,
        headers: {
          "Content-Type": "audio/mpeg",
          "Content-Length": result.mp3.length.toString(),
          "Content-Disposition": `attachment; filename="freetts-${Date.now()}.mp3"`,
          "Cache-Control": "no-cache",
          "X-Engine": "freetts.ru",
          "X-Strategy": "new-api",
        },
      });
    }
    console.log(`[freetts] new-api failed: ${result.reason}`);

    // All freetts strategies failed — try fallback to Z.ai SDK
    // so the user still gets audio
    try {
      const ZAI = (await import("z-ai-web-dev-sdk")).default;
      const zai = await ZAI.create();
      const fallbackRes = await zai.audio.tts.create({
        input: text.trim(),
        voice: "tongtong",
        speed: 1.0,
        response_format: "wav",
        stream: false,
      });
      const fallbackBuf = Buffer.from(
        new Uint8Array(await fallbackRes.arrayBuffer()),
      );
      return new NextResponse(new Uint8Array(fallbackBuf), {
        status: 200,
        headers: {
          "Content-Type": "audio/wav",
          "Content-Length": fallbackBuf.length.toString(),
          "Content-Disposition": `attachment; filename="tts-fallback-${Date.now()}.wav"`,
          "Cache-Control": "no-cache",
          "X-Engine": "z-ai-sdk",
          "X-Strategy": "freetts-unavailable-fallback",
          "X-Warning":
            "freetts.ru synthesis failed; used Z.ai SDK as fallback",
        },
      });
    } catch (fallbackErr) {
      console.error("[freetts] Z.ai fallback also failed:", fallbackErr);
    }

    // All strategies failed
    return NextResponse.json(
      {
        error: `freetts.ru synthesis failed (${result.reason}). Z.ai fallback also failed.`,
        suggestion:
          "Use the Web Speech API engine (browser native) instead. The freetts.ru voice catalogue is still available for browsing.",
      },
      { status: 502 },
    );
  } catch (error) {
    console.error("freetts synthesize error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to synthesize via freetts.ru",
      },
      { status: 500 },
    );
  }
}
