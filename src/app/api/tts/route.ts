import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/tts
 *
 * Generates high-quality speech audio using the z-ai-web-dev-sdk.
 * Used for downloading audio files (the Web Speech API cannot easily
 * capture audio output, so we rely on a server-side TTS engine for
 * downloadable content).
 *
 * Request body:
 *   {
 *     "text": string,         // required, max 1024 characters
 *     "voice": string,        // optional, default "tongtong"
 *     "speed": number,        // optional, 0.5 - 2.0, default 1.0
 *     "format": "wav" | "mp3" | "pcm"  // optional, default "mp3"
 *   }
 *
 * Response: binary audio data with appropriate Content-Type.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, voice = "tongtong", speed = 1.0, format = "mp3" } = body;

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json(
        { error: "Text is required" },
        { status: 400 },
      );
    }

    if (text.length > 1024) {
      return NextResponse.json(
        {
          error:
            "Text exceeds the maximum length of 1024 characters. For longer texts, please split into chunks.",
        },
        { status: 400 },
      );
    }

    // Validate speed
    const speedNum = Number(speed);
    if (Number.isNaN(speedNum) || speedNum < 0.5 || speedNum > 2.0) {
      return NextResponse.json(
        { error: "Speed must be between 0.5 and 2.0" },
        { status: 400 },
      );
    }

    // Validate format — z-ai SDK currently supports only "wav" and "pcm"
    // (mp3 was deprecated in newer SDK versions)
    const validFormats = ["wav", "pcm"];
    let formatToUse = format;
    if (!validFormats.includes(formatToUse)) {
      // Default to wav for download compatibility
      formatToUse = "wav";
    }

    // Import ZAI SDK (server-side only)
    const ZAI = (await import("z-ai-web-dev-sdk")).default;
    const zai = await ZAI.create();

    const response = await zai.audio.tts.create({
      input: text.trim(),
      voice: String(voice),
      speed: speedNum,
      response_format: formatToUse,
      stream: false,
    });

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(new Uint8Array(arrayBuffer));

    const contentType =
      formatToUse === "wav" ? "audio/wav" : "audio/pcm";

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": buffer.length.toString(),
        "Content-Disposition": `attachment; filename="tts-${Date.now()}.${formatToUse}"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("TTS API Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate speech audio",
      },
      { status: 500 },
    );
  }
}
