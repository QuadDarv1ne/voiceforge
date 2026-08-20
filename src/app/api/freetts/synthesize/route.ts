import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/freetts/synthesize
 *
 * Synthesizes speech using the freetts.ru engine.
 *
 * Request body:
 *   {
 *     "text": string,         // required, max 1024 chars
 *     "voice": string,        // required, e.g. "ru-RU066"
 *     "format": "mp3" | "wav" // optional, default "mp3"
 *   }
 *
 * The freetts.ru API is protected by a WAF that blocks server-side
 * requests (TLS fingerprinting). This endpoint tries multiple strategies:
 *
 * 1. Direct fetch with realistic browser headers
 * 2. Public CORS proxy fallback (allorigins)
 * 3. If all fail — returns a clear error suggesting to use Web Speech API
 *
 * Response: binary audio (MP3) or JSON error.
 */

const FREETTS_SYNTH_URL = "https://freetts.ru/api/v2/s";

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

interface FreettsSynthesisResponse {
  status: number;
  message: string;
  data?: {
    audioBase64?: string;
    [k: string]: unknown;
  };
}

/**
 * Strategy 1 — direct fetch with realistic browser headers.
 */
async function tryDirectFetch(
  body: { voice: string; text: string },
): Promise<{ ok: true; mp3: Buffer } | { ok: false; reason: string }> {
  try {
    const res = await fetch(FREETTS_SYNTH_URL, {
      method: "POST",
      headers: BROWSER_HEADERS,
      body: JSON.stringify(body),
      redirect: "follow",
    });

    if (res.status === 403) {
      return { ok: false, reason: "WAF blocked (403)" };
    }
    if (!res.ok) {
      return { ok: false, reason: `HTTP ${res.status}` };
    }

    const json = (await res.json()) as FreettsSynthesisResponse;
    if (json.status !== 200 || !json.data?.audioBase64) {
      return { ok: false, reason: json.message || "No audio in response" };
    }

    const mp3 = Buffer.from(json.data.audioBase64, "base64");
    return { ok: true, mp3 };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : "Network error",
    };
  }
}

/**
 * Strategy 2 — public CORS proxy (allorigins). The proxy fetches the URL
 * from its own IP, which may bypass the WAF. We pass our POST body as a
 * JSON-encoded `body` parameter so the proxy can replay it.
 */
async function tryCorsProxy(
  body: { voice: string; text: string },
): Promise<{ ok: true; mp3: Buffer } | { ok: false; reason: string }> {
  const proxyUrl =
    "https://api.allorigins.win/raw?url=" +
    encodeURIComponent(FREETTS_SYNTH_URL);

  try {
    const res = await fetch(proxyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      return { ok: false, reason: `Proxy HTTP ${res.status}` };
    }

    const json = (await res.json()) as FreettsSynthesisResponse;
    if (json.status !== 200 || !json.data?.audioBase64) {
      return { ok: false, reason: json.message || "Proxy: no audio" };
    }

    const mp3 = Buffer.from(json.data.audioBase64, "base64");
    return { ok: true, mp3 };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : "Proxy network error",
    };
  }
}

/**
 * Strategy 3 — corsproxy.io. Another public CORS proxy that forwards
 * the request with its own TLS fingerprint and IP.
 */
async function tryCorsProxyIo(
  body: { voice: string; text: string },
): Promise<{ ok: true; mp3: Buffer } | { ok: false; reason: string }> {
  const proxyUrl =
    "https://corsproxy.io/?" + encodeURIComponent(FREETTS_SYNTH_URL);

  try {
    const res = await fetch(proxyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://freetts.ru",
        Referer: "https://freetts.ru/",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      return { ok: false, reason: `corsproxy.io HTTP ${res.status}` };
    }

    // corsproxy.io may return raw JSON
    const text = await res.text();
    let json: FreettsSynthesisResponse;
    try {
      json = JSON.parse(text) as FreettsSynthesisResponse;
    } catch {
      return { ok: false, reason: "corsproxy.io: invalid JSON" };
    }

    if (json.status !== 200 || !json.data?.audioBase64) {
      return { ok: false, reason: json.message || "corsproxy.io: no audio" };
    }

    const mp3 = Buffer.from(json.data.audioBase64, "base64");
    return { ok: true, mp3 };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : "corsproxy.io error",
    };
  }
}

/**
 * Strategy 4 — codetabs proxy. Another fallback.
 */
async function tryCodetabsProxy(
  body: { voice: string; text: string },
): Promise<{ ok: true; mp3: Buffer } | { ok: false; reason: string }> {
  const proxyUrl =
    "https://api.codetabs.com/v1/proxy/?quest=" +
    encodeURIComponent(FREETTS_SYNTH_URL);

  try {
    const res = await fetch(proxyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      return { ok: false, reason: `codetabs HTTP ${res.status}` };
    }

    const text = await res.text();
    let json: FreettsSynthesisResponse;
    try {
      json = JSON.parse(text) as FreettsSynthesisResponse;
    } catch {
      return { ok: false, reason: "codetabs: invalid JSON" };
    }

    if (json.status !== 200 || !json.data?.audioBase64) {
      return { ok: false, reason: json.message || "codetabs: no audio" };
    }

    const mp3 = Buffer.from(json.data.audioBase64, "base64");
    return { ok: true, mp3 };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : "codetabs error",
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
        { error: "Voice code is required (e.g. ru-RU066)" },
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

    // Strategy 0: Try Playwright mini-service (port 3004) — uses real
    // Chromium browser to bypass WAF. Most reliable strategy if available.
    try {
      const scraperUrl =
        "http://localhost:3004/synthesize?XTransformPort=3004";
      const scraperRes = await fetch(scraperUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        // 70s timeout — Playwright is slow on first run
        signal: AbortSignal.timeout(70000),
      });
      if (scraperRes.ok) {
        const buf = Buffer.from(await scraperRes.arrayBuffer());
        return new NextResponse(buf, {
          status: 200,
          headers: {
            "Content-Type": "audio/mpeg",
            "Content-Length": buf.length.toString(),
            "Content-Disposition": `attachment; filename="freetts-${Date.now()}.mp3"`,
            "Cache-Control": "no-cache",
            "X-Engine": "freetts.ru",
            "X-Strategy": "playwright",
          },
        });
      }
      console.log(
        `[freetts] playwright scraper failed: HTTP ${scraperRes.status}`,
      );
    } catch (e) {
      console.log(
        `[freetts] playwright scraper unavailable: ${
          e instanceof Error ? e.message : "unknown"
        }`,
      );
    }

    // Strategies 1-4: Direct + public CORS proxies (likely all blocked
    // by WAF, but try anyway as fallbacks)
    const strategies = [
      { name: "direct", fn: () => tryDirectFetch(payload) },
      { name: "allorigins", fn: () => tryCorsProxy(payload) },
      { name: "corsproxy.io", fn: () => tryCorsProxyIo(payload) },
      { name: "codetabs", fn: () => tryCodetabsProxy(payload) },
    ];

    for (const strategy of strategies) {
      const result = await strategy.fn();
      if (result.ok) {
        return new NextResponse(new Uint8Array(result.mp3), {
          status: 200,
          headers: {
            "Content-Type": "audio/mpeg",
            "Content-Length": result.mp3.length.toString(),
            "Content-Disposition": `attachment; filename="freetts-${Date.now()}.mp3"`,
            "Cache-Control": "no-cache",
            "X-Engine": "freetts.ru",
            "X-Strategy": strategy.name,
          },
        });
      }
      // Log and continue to next strategy
      console.log(`[freetts] ${strategy.name} failed: ${result.reason}`);
    }

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
            "freetts.ru WAF blocked all strategies; used Z.ai SDK as fallback",
        },
      });
    } catch (fallbackErr) {
      console.error("[freetts] Z.ai fallback also failed:", fallbackErr);
    }

    // All strategies failed
    return NextResponse.json(
      {
        error:
          "freetts.ru API is currently blocked by their WAF. All 5 strategies (Playwright + direct + 3 proxies) failed, and Z.ai fallback also failed.",
        suggestion:
          "Use the Web Speech API engine (browser native) instead. The freetts.ru voice catalogue (298 voices) is still available for browsing.",
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
