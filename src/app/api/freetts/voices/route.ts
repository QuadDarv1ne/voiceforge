import { NextResponse } from "next/server";
import {
  FREETTS_LANGUAGES,
  FREETTS_VOICES,
  type FreeTtsLanguage,
  type FreeTtsVoice,
} from "@/lib/freetts-voices";

/**
 * GET /api/freetts/voices
 *
 * Returns the freetts.ru voice catalogue.
 * Tries to fetch the live catalogue from https://freetts.ru/api/list first.
 * Falls back to the static snapshot if the live API is unavailable.
 *
 * Optional query params:
 *   - lang=<code>   Filter voices by language code (e.g. "ru", "en")
 */

// In-memory cache for the live catalogue (refreshed every 10 minutes)
let cachedVoices: FreeTtsVoice[] | null = null;
let cachedLangs: FreeTtsLanguage[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

interface FreettsListResponse {
  status: string;
  message: string;
  data: {
    voices: { id: string; lang: string; name: string; sex: string }[];
    langs: { code: string; name: string }[];
  } | false;
}

async function fetchLiveCatalogue(): Promise<{
  voices: FreeTtsVoice[];
  langs: FreeTtsLanguage[];
} | null> {
  const now = Date.now();
  if (cachedVoices && cachedLangs && now - cacheTime < CACHE_TTL) {
    return { voices: cachedVoices, langs: cachedLangs };
  }

  try {
    const res = await fetch("https://freetts.ru/api/list", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "ru-RU,ru;q=0.9",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;

    const json = (await res.json()) as FreettsListResponse;
    if (json.status !== "success" || !json.data) return null;

    const voices: FreeTtsVoice[] = json.data.voices.map((v) => ({
      code: v.id,
      name: v.name,
      gender: v.sex === "m" ? "m" : "f",
      lang: v.lang,
    }));

    const langs: FreeTtsLanguage[] = json.data.langs.map((l) => ({
      code: l.code,
      name: l.name,
    }));

    cachedVoices = voices;
    cachedLangs = langs;
    cacheTime = now;

    return { voices, langs };
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const langFilter = url.searchParams.get("lang");

  // Try live catalogue first, fall back to static
  const live = await fetchLiveCatalogue();
  const voices = live?.voices ?? FREETTS_VOICES;
  const langs = live?.langs ?? FREETTS_LANGUAGES;

  if (langFilter) {
    const lang = langs.find((l) => l.code === langFilter) ?? null;
    const filtered = voices.filter((v) =>
      v.lang ? v.lang.startsWith(langFilter) : (v.code.includes(langFilter) || v.code.startsWith(langFilter)),
    );
    return NextResponse.json({
      language: lang,
      voices: filtered,
      total: filtered.length,
      source: live ? "live" : "static",
    });
  }

  return NextResponse.json({
    languages: langs,
    voices,
    total: voices.length,
    source: live ? "live" : "static",
  });
}
