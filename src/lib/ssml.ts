/**
 * Lightweight SSML-like tag processor for Web Speech API.
 *
 * The Web Speech API doesn't support real SSML, but we can implement
 * a small subset by splitting the text and adjusting pitch/rate on
 * each SpeechSynthesisUtterance.
 *
 * Supported tags:
 *   <pause ms="500" />            — silent pause in milliseconds
 *   <emphasis>текст</emphasis>    — higher pitch and slightly slower
 *   <soft>текст</soft>            — lower pitch and slightly slower
 *   <loud>текст</loud>            — higher volume
 *   <whisper>текст</whisper>      — low volume, low pitch
 *   <slow>текст</slow>            — 0.7× speed
 *   <fast>текст</fast>            — 1.4× speed
 *
 * Example:
 *   "Привет <pause ms='300'/> мир! <emphasis>Важно</emphasis>."
 */

export interface SpeechSegment {
  text: string;
  /** Pause before this segment in milliseconds */
  pauseBeforeMs?: number;
  /** Pitch multiplier relative to base (1.0 = no change) */
  pitchMultiplier?: number;
  /** Rate multiplier relative to base (1.0 = no change) */
  rateMultiplier?: number;
  /** Volume multiplier relative to base (1.0 = no change) */
  volumeMultiplier?: number;
}

const TAG_PATTERNS: {
  regex: RegExp;
  apply: (segment: Partial<SpeechSegment>) => Partial<SpeechSegment>;
}[] = [
  // <pause ms="500" /> or <pause ms='500'/>
  {
    regex: /<pause\s+ms=["']?(\d+)["']?\s*\/?>/i,
    apply: (seg) => ({ ...seg, pauseBeforeMs: 0 }), // handled separately
  },
];

interface TagRule {
  openTag: RegExp;
  closeTag: RegExp;
  modifiers: Partial<SpeechSegment>;
}

const TAG_RULES: TagRule[] = [
  {
    openTag: /<emphasis>/i,
    closeTag: /<\/emphasis>/i,
    modifiers: {
      pitchMultiplier: 1.3,
      rateMultiplier: 0.9,
    },
  },
  {
    openTag: /<soft>/i,
    closeTag: /<\/soft>/i,
    modifiers: {
      pitchMultiplier: 0.8,
      rateMultiplier: 0.85,
    },
  },
  {
    openTag: /<loud>/i,
    closeTag: /<\/loud>/i,
    modifiers: {
      volumeMultiplier: 1.5,
      pitchMultiplier: 1.1,
    },
  },
  {
    openTag: /<whisper>/i,
    closeTag: /<\/whisper>/i,
    modifiers: {
      volumeMultiplier: 0.3,
      pitchMultiplier: 0.7,
    },
  },
  {
    openTag: /<slow>/i,
    closeTag: /<\/slow>/i,
    modifiers: {
      rateMultiplier: 0.7,
    },
  },
  {
    openTag: /<fast>/i,
    closeTag: /<\/fast>/i,
    modifiers: {
      rateMultiplier: 1.4,
    },
  },
];

/**
 * Parse text with SSML-like tags into speech segments.
 * Returns array of segments with adjusted parameters.
 */
export function parseSSML(
  text: string,
  baseParams: { rate?: number; pitch?: number; volume?: number } = {},
): SpeechSegment[] {
  const segments: SpeechSegment[] = [];

  // First, extract pause tags and split text by them
  const pauseRegex = /<pause\s+ms=["']?(\d+)["']?\s*\/?>/gi;
  const parts: { text: string; pauseMs: number }[] = [];
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = pauseRegex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push({
        text: text.slice(lastIdx, match.index),
        pauseMs: 0,
      });
    }
    parts.push({
      text: "",
      pauseMs: parseInt(match[1], 10) || 0,
    });
    lastIdx = match.index + match[0].length;
  }
  if (lastIdx < text.length) {
    parts.push({ text: text.slice(lastIdx), pauseMs: 0 });
  }

  if (parts.length === 0) {
    parts.push({ text, pauseMs: 0 });
  }

  // For each text part, parse inline tags (emphasis, soft, etc.)
  for (const part of parts) {
    if (part.text === "") {
      // Pure pause — attach to next segment
      if (segments.length > 0) {
        const last = segments[segments.length - 1];
        last.pauseBeforeMs = (last.pauseBeforeMs || 0) + part.pauseMs;
      } else {
        // Will be attached to the next segment
        segments.push({
          text: "",
          pauseBeforeMs: part.pauseMs,
        });
      }
      continue;
    }

    // Parse inline tags — find all tag occurrences
    type Range = { start: number; end: number; modifiers: Partial<SpeechSegment> };
    const ranges: Range[] = [];

    for (const rule of TAG_RULES) {
      let openMatch: RegExpExecArray | null;
      const openRegex = new RegExp(rule.openTag.source, "gi");
      const closeRegex = new RegExp(rule.closeTag.source, "gi");

      while ((openMatch = openRegex.exec(part.text)) !== null) {
        // Find matching close tag after open
        closeRegex.lastIndex = openMatch.index + openMatch[0].length;
        const closeMatch = closeRegex.exec(part.text);
        if (closeMatch) {
          ranges.push({
            start: openMatch.index,
            end: closeMatch.index + closeMatch[0].length,
            modifiers: rule.modifiers,
          });
        }
      }
    }

    if (ranges.length === 0) {
      // No tags — single segment with pause
      if (segments.length > 0 && segments[segments.length - 1].text === "") {
        // Attach to pending pause segment
        const pending = segments.pop()!;
        segments.push({
          text: part.text,
          pauseBeforeMs: pending.pauseBeforeMs,
        });
      } else {
        segments.push({
          text: part.text,
          pauseBeforeMs: part.pauseMs || undefined,
        });
      }
      continue;
    }

    // Sort ranges by start position
    ranges.sort((a, b) => a.start - b.start);

    // Build segments: plain text before, tagged text, plain text after
    let cursor = 0;
    const subSegments: SpeechSegment[] = [];

    for (const range of ranges) {
      // Plain text before the tag
      if (range.start > cursor) {
        subSegments.push({
          text: part.text.slice(cursor, range.start),
        });
      }
      // Tagged content (strip tags)
      const openTagLen = part.text
        .slice(range.start)
        .match(/>/)!.index! + 1;
      const innerStart = range.start + openTagLen;
      const closeTagStart = part.text
        .slice(innerStart)
        .match(/<\/[^>]+>/)!.index!;
      const innerText = part.text.slice(innerStart, innerStart + closeTagStart);

      subSegments.push({
        text: innerText,
        pitchMultiplier: range.modifiers.pitchMultiplier,
        rateMultiplier: range.modifiers.rateMultiplier,
        volumeMultiplier: range.modifiers.volumeMultiplier,
      });

      cursor = range.end;
    }

    // Plain text after last tag
    if (cursor < part.text.length) {
      subSegments.push({
        text: part.text.slice(cursor),
      });
    }

    // Attach pause to first sub-segment
    if (part.pauseMs > 0 && subSegments.length > 0) {
      subSegments[0].pauseBeforeMs = part.pauseMs;
    }

    segments.push(...subSegments);
  }

  // Filter out empty segments (but keep ones with pauses)
  return segments.filter((s) => s.text.length > 0 || s.pauseBeforeMs);
}

/**
 * Quick reference of supported tags for UI display.
 */
export const SSML_TAG_REFERENCE: {
  tag: string;
  description: string;
  example: string;
}[] = [
  {
    tag: "<pause ms='500' />",
    description: "Пауза 500мс",
    example: "Привет <pause ms='300'/> мир",
  },
  {
    tag: "<emphasis>...</emphasis>",
    description: "Акцент (выше тон)",
    example: "Это <emphasis>важно</emphasis>",
  },
  {
    tag: "<soft>...</soft>",
    description: "Мягко (ниже тон)",
    example: "<soft>Тихо говорю</soft>",
  },
  {
    tag: "<loud>...</loud>",
    description: "Громко",
    example: "<loud>Внимание!</loud>",
  },
  {
    tag: "<whisper>...</whisper>",
    description: "Шёпот",
    example: "<whisper>Секрет</whisper>",
  },
  {
    tag: "<slow>...</slow>",
    description: "Медленно (0.7×)",
    example: "<slow>Очень медленно</slow>",
  },
  {
    tag: "<fast>...</fast>",
    description: "Быстро (1.4×)",
    example: "<fast>Очень быстро</fast>",
  },
];
