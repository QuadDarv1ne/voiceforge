import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/tts/stream
 *
 * Streaming Text-to-Speech endpoint using z-ai-web-dev-sdk.
 *
 * Returns audio as a stream of binary chunks (PCM format only).
 * Use this for real-time playback of long text — the client receives
 * audio chunks as they are generated, without waiting for full synthesis.
 *
 * @example
 * // Client-side: fetch and play stream
 * const response = await fetch('/api/tts/stream', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({ text: 'Длинный текст...', voice: 'tongtong' })
 * });
 *
 * const reader = response.body!.getReader();
 * while (true) {
 *   const { done, value } = await reader.read();
 *   if (done) break;
 *   // Process PCM chunk: value is Uint8Array
 *   audioPlayer.feed(value);
 * }
 *
 * @requires ~/.z-ai-config with Z.AI credentials
 * @note Streaming only supports PCM format (not WAV)
 */

const MAX_TEXT_LENGTH = 1024;
const VALID_VOICES = [
  "tongtong",
  "chuichui",
  "xiaochen",
  "jam",
  "kazi",
  "douji",
  "luodo",
] as const;

interface StreamTtsRequestBody {
  text: string;
  voice?: string;
  speed?: number;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as StreamTtsRequestBody;

    // Validate text
    if (!body.text || typeof body.text !== "string" || body.text.trim().length === 0) {
      return NextResponse.json(
        { error: "Text is required" },
        { status: 400 },
      );
    }

    if (body.text.length > MAX_TEXT_LENGTH) {
      return NextResponse.json(
        {
          error: `Text exceeds maximum length of ${MAX_TEXT_LENGTH} characters`,
        },
        { status: 400 },
      );
    }

    const voice = body.voice && VALID_VOICES.includes(body.voice as (typeof VALID_VOICES)[number])
      ? body.voice
      : "tongtong";

    const speed = Number(body.speed ?? 1.0);
    if (Number.isNaN(speed) || speed < 0.5 || speed > 2.0) {
      return NextResponse.json(
        { error: "Speed must be between 0.5 and 2.0" },
        { status: 400 },
      );
    }

    // Generate streaming audio via z-ai SDK
    const ZAIModule = await import("z-ai-web-dev-sdk");
    const ZAI = ZAIModule.default;
    const zai = await ZAI.create();

    // stream=true requires response_format="pcm"
    const response = await zai.audio.tts.create({
      input: body.text.trim(),
      voice: voice,
      speed: speed,
      response_format: "pcm",
      stream: true,
    });

    if (!response.body) {
      throw new Error("SDK returned no response body for streaming");
    }

    // Convert ReadableStream to Node.js Readable for Next.js response
    const stream = response.body as unknown as ReadableStream<Uint8Array>;
    const nodeStream = new ReadableStream({
      async start(controller) {
        const reader = stream.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
              controller.enqueue(value);
            }
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        } finally {
          reader.releaseLock();
        }
      },
    });

    return new NextResponse(nodeStream, {
      status: 200,
      headers: {
        "Content-Type": "audio/pcm",
        "Transfer-Encoding": "chunked",
        "Cache-Control": "no-cache",
        "X-Voice": voice,
        "X-Speed": speed.toString(),
        "X-Format": "pcm",
        "X-Sample-Rate": "24000",
        "X-Note": "PCM 16-bit mono 24kHz. Wrap in WAV header for playback.",
      },
    });
  } catch (error) {
    console.error("[TTS Stream API] Error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    return NextResponse.json(
      {
        error: "Failed to stream speech",
        details: errorMessage,
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: "/api/tts/stream",
    method: "POST",
    description: "Streaming Text-to-Speech (PCM chunks in real-time)",
    format: "pcm",
    sampleRate: "24000 Hz",
    channels: 1,
    bitsPerSample: 16,
    note: "Wrap PCM in WAV header on client for playback. See examples/stream-playback.ts",
  });
}
