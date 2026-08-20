"use client";

import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SpeechSynthesisVoiceInfo } from "@/hooks/use-speech-synthesis";

interface VoiceSelectorProps {
  voices: SpeechSynthesisVoiceInfo[];
  value: string | undefined;
  onChange: (voiceURI: string) => void;
  /** BCP 47 language code, e.g. "ru-RU" — used to highlight best matches */
  langCode?: string;
}

export function VoiceSelector({
  voices,
  value,
  onChange,
  langCode,
}: VoiceSelectorProps) {
  // Sort: voices matching the language first, then alphabetical
  const sortedVoices = React.useMemo(() => {
    const langPrefix = langCode?.split("-")[0];
    return [...voices].sort((a, b) => {
      const aMatchesLang = langCode && a.lang === langCode;
      const bMatchesLang = langCode && b.lang === langCode;
      const aMatchesPrefix = langPrefix && a.lang.startsWith(langPrefix);
      const bMatchesPrefix = langPrefix && b.lang.startsWith(langPrefix);
      const aScore = aMatchesLang ? 2 : aMatchesPrefix ? 1 : 0;
      const bScore = bMatchesLang ? 2 : bMatchesPrefix ? 1 : 0;
      if (aScore !== bScore) return bScore - aScore;
      return a.name.localeCompare(b.name);
    });
  }, [voices, langCode]);

  // If the selected voice is not in the filtered list, reset to first
  React.useEffect(() => {
    if (sortedVoices.length > 0 && !value) {
      onChange(sortedVoices[0].voiceURI);
    }
  }, [sortedVoices, value, onChange]);

  if (sortedVoices.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
        Нет доступных голосов в этом браузере.
      </div>
    );
  }

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Выберите голос" />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {sortedVoices.map((v) => {
          const matchesLang = langCode && v.lang === langCode;
          return (
            <SelectItem key={v.voiceURI} value={v.voiceURI}>
              <span className="flex items-center gap-2">
                <span className="font-medium">{v.name}</span>
                <span className="text-xs text-muted-foreground">({v.lang})</span>
                {matchesLang && (
                  <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                    match
                  </span>
                )}
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
