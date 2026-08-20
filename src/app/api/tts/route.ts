import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/tts
 *
 * Text-to-Speech endpoint using z-ai-web-dev-sdk.
 *
 * Generates high-quality speech audio from text input.
 * Supports multiple voices, adjustable speed, and WAV/PCM output formats.
 *
 * @example
 * // Request
 * fetch('/api/tts', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({
 *     text: 'Привет, мир!',
 *     voice: 'tongtong',
 *     speed: 1.0,
 *     format: 'wav'
 *   })
 * })
 *
 * // Response: binary audio data (audio/wav)
 *
 * @requires ~/.z-ai-config or /etc/.z-ai-config or .env with Z.AI credentials
 */

const MAX_TEXT_LENGTH = 1024;
const VALID_VOICES = [
  "tongtong", // Тёплый, дружелюбный (по умолчанию)
  "chuichui", // Живой, энергичный
  "xiaochen", // Спокойный, профессиональный
  "jam", // Английский акцент
  "kazi", // Чёткий, стандартный
  "douji", // Естественный, плавный
  "luodo", // Эмоциональный, выразительный
] as const;

const VALID_FORMATS = ["wav", "pcm"] as const;
type TtsFormat = (typeof VALID_FORMATS)[number];
type TtsVoice = (typeof VALID_VOICES)[number];

interface TtsRequestBody {
  text: string;
  voice?: string;
  speed?: number;
  format?: string;
}

/**
 * Validate request body and return normalized parameters or error response.
 */
function validateRequest(body: TtsRequestBody):
  | {
      ok: true;
      text: string;
      voice: TtsVoice;
      speed: number;
      format: TtsFormat;
    }
  | { ok: false; error: string; status: number } {
  // Text validation
  if (!body.text || typeof body.text !== "string" || body.text.trim().length === 0) {
    return {
      ok: false,
      error: "Text is required",
      status: 400,
    };
  }

  if (body.text.length > MAX_TEXT_LENGTH) {
    return {
      ok: false,
      error: `Text exceeds maximum length of ${MAX_TEXT_LENGTH} characters (got ${body.text.length})`,
      status: 400,
    };
  }

  // Voice validation (default: tongtong)
  const voice = (body.voice && VALID_VOICES.includes(body.voice as TtsVoice)
    ? body.voice
    : "tongtong") as TtsVoice;

  // Speed validation (0.5 - 2.0, default: 1.0)
  const speedNum = Number(body.speed ?? 1.0);
  if (Number.isNaN(speedNum) || speedNum < 0.5 || speedNum > 2.0) {
    return {
      ok: false,
      error: "Speed must be between 0.5 and 2.0",
      status: 400,
    };
  }

  // Format validation (default: wav; mp3 deprecated in newer SDK)
  const format = (body.format && VALID_FORMATS.includes(body.format as TtsFormat)
    ? body.format
    : "wav") as TtsFormat;

  return {
    ok: true,
    text: body.text.trim(),
    voice,
    speed: speedNum,
    format,
  };
}

/**
 * Generate speech audio using z-ai-web-dev-sdk.
 *
 * The SDK reads configuration from:
 *   1. ./.z-ai-config (current working directory)
 *   2. ~/.z-ai-config (home directory)
 *   3. /etc/.z-ai-config (system-wide)
 *
 * Required config fields:
 *   - baseUrl: API endpoint (e.g. "https://internal-api.z.ai/v1")
 *   - apiKey: API key (e.g. "Z.ai")
 *   - token: JWT auth token from chat.z.ai
 *   - userId: User ID from chat.z.ai
 *   - chatId: Chat session ID from chat.z.ai
 */
async function generateSpeech(
  text: string,
  voice: TtsVoice,
  speed: number,
  format: TtsFormat,
): Promise<Buffer> {
  // Dynamic import — server-side only
  const ZAIModule = await import("z-ai-web-dev-sdk");
  const ZAI = ZAIModule.default;

  // Create SDK instance (reads config from .z-ai-config)
  const zai = await ZAI.create();

  // Generate TTS audio
  // Note: stream=true only supports PCM; wav requires stream=false
  const response = await zai.audio.tts.create({
    input: text,
    voice: voice,
    speed: speed,
    response_format: format,
    stream: false,
  });

  // SDK returns a standard Response object
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(new Uint8Array(arrayBuffer));
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as TtsRequestBody;
    const validation = validateRequest(body);

    if (!validation.ok) {
      return NextResponse.json(
        { error: validation.error },
        { status: validation.status },
      );
    }

    const audioBuffer = await generateSpeech(
      validation.text,
      validation.voice,
      validation.speed,
      validation.format,
    );

    const contentType =
      validation.format === "wav" ? "audio/wav" : "audio/pcm";

    return new NextResponse(new Uint8Array(audioBuffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": audioBuffer.length.toString(),
        "Content-Disposition": `attachment; filename="tts-${Date.now()}.${validation.format}"`,
        "Cache-Control": "no-cache",
        "X-Voice": validation.voice,
        "X-Speed": validation.speed.toString(),
        "X-Format": validation.format,
      },
    });
  } catch (error) {
    console.error("[TTS API] Error:", error);

    // Provide helpful error messages for common issues
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes("Configuration file not found")) {
      return NextResponse.json(
        {
          error: "Z.ai SDK configuration not found",
          hint: "Create ~/.z-ai-config with baseUrl, apiKey, token, userId, chatId. See .env.example for template.",
          docs: "https://chat.z.ai → DevTools → Application → LocalStorage",
        },
        { status: 500 },
      );
    }

    if (errorMessage.includes("401") || errorMessage.includes("403")) {
      return NextResponse.json(
        {
          error: "Z.ai authentication failed",
          hint: "Token in ~/.z-ai-config is invalid or expired. Get a fresh token from chat.z.ai.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        error: "Failed to generate speech",
        details: errorMessage,
      },
      { status: 500 },
    );
  }
}

/**
 * GET /api/tts
 * Returns API documentation and available voices.
 */
export async function GET() {
  return NextResponse.json({
    endpoint: "/api/tts",
    method: "POST",
    description: "Text-to-Speech synthesis using z-ai-web-dev-sdk",
    voices: VALID_VOICES,
    formats: VALID_FORMATS,
    limits: {
      maxTextLength: MAX_TEXT_LENGTH,
      speedRange: "0.5 - 2.0",
    },
    example: {
      text: "Привет, мир!",
      voice: "tongtong",
      speed: 1.0,
      format: "wav",
    },
  });
}
