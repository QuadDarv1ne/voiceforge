import { NextResponse } from "next/server";
import {
  FREETTS_LANGUAGES,
  FREETTS_VOICES,
  getFreeTtsVoicesByLang,
} from "@/lib/freetts-voices";

/**
 * GET /api/freetts/voices
 *
 * Returns the static freetts.ru voice catalogue.
 * Optional query params:
 *   - lang=<code>   Filter voices by language code (e.g. "ru", "en")
 *
 * Response:
 *   { languages: FreeTtsLanguage[], voices: FreeTtsVoice[] }
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const langFilter = url.searchParams.get("lang");

  if (langFilter) {
    return NextResponse.json({
      language: FREETTS_LANGUAGES.find((l) => l.code === langFilter) ?? null,
      voices: getFreeTtsVoicesByLang(langFilter),
      total: getFreeTtsVoicesByLang(langFilter).length,
    });
  }

  return NextResponse.json({
    languages: FREETTS_LANGUAGES,
    voices: FREETTS_VOICES,
    total: FREETTS_VOICES.length,
  });
}
