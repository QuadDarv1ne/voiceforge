import { NextResponse } from "next/server";

/**
 * GET /api/piper/voices
 *
 * Returns the list of locally available Piper TTS voices
 * (scanned from the piper-tts/voices directory by the mini-service).
 *
 * Requires the piper-local mini-service running on port 3005.
 */
export async function GET() {
  try {
    const res = await fetch("http://localhost:3005/voices", {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      return NextResponse.json(
        { voices: [], available: false, error: `HTTP ${res.status}` },
        { status: 503 },
      );
    }
    const data = await res.json();
    return NextResponse.json({
      voices: data.voices ?? [],
      available: true,
    });
  } catch {
    return NextResponse.json(
      {
        voices: [],
        available: false,
        hint: "Start the piper-local mini-service: cd mini-services/piper-local && bun run dev",
      },
      { status: 503 },
    );
  }
}