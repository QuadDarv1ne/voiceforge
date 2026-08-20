import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/piper
 *
 * Synthesizes speech using local Piper TTS (offline, no internet needed).
 * Uses the "ru_RU-dmitri-medium" voice model (Дмитрий, Russian male).
 *
 * Request body:
 *   {
 *     "text": string,         // required, max 5000 chars
 *     "voice": string,        // optional, default "dmitri"
 *   }
 *
 * Response: binary audio (WAV) or JSON error.
 *
 * Requires the piper-local mini-service running on port 3005:
 *   cd mini-services/piper-local && bun run dev
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, voice = "dmitri" } = body;

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json(
        { error: "Text is required" },
        { status: 400 },
      );
    }
    if (text.length > 5000) {
      return NextResponse.json(
        {
          error: `Text exceeds 5000 characters (Piper local limit). Currently: ${text.length}`,
        },
        { status: 400 },
      );
    }

    const res = await fetch("http://localhost:3005/synthesize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text.trim(), voice }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json(
        {
          error: `Piper local service error: ${err.error || `HTTP ${res.status}`}`,
          hint: "Make sure the piper-local mini-service is running: cd mini-services/piper-local && bun run dev",
        },
        { status: 502 },
      );
    }

    const buf = Buffer.from(new Uint8Array(await res.arrayBuffer()));

    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "audio/wav",
        "Content-Length": buf.length.toString(),
        "Content-Disposition": `attachment; filename="piper-${voice}-${Date.now()}.wav"`,
        "Cache-Control": "no-cache",
        "X-Engine": "piper-local",
        "X-Voice": voice,
      },
    });
  } catch (error) {
    console.error("Piper API Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to synthesize via Piper",
        hint: "Is the piper-local mini-service running on port 3005?",
      },
      { status: 500 },
    );
  }
}

/**
 * GET /api/piper/health
 * Checks if the local Piper service is available.
 */
export async function GET() {
  try {
    const res = await fetch("http://localhost:3005/health", {
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = await res.json();
      return NextResponse.json({
        available: true,
        ...data,
      });
    }
    return NextResponse.json({ available: false }, { status: 503 });
  } catch {
    return NextResponse.json(
      {
        available: false,
        hint: "Start the piper-local mini-service: cd mini-services/piper-local && bun run dev",
      },
      { status: 503 },
    );
  }
}
