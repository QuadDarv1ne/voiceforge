"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { LANGUAGES, type LanguageConfig } from "@/lib/languages";

interface LanguageSelectorProps {
  value: string;
  onChange: (code: string) => void;
  className?: string;
}

export function LanguageSelector({
  value,
  onChange,
  className,
}: LanguageSelectorProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2",
        className,
      )}
      role="radiogroup"
      aria-label="Выбор языка"
    >
      {LANGUAGES.map((lang: LanguageConfig) => {
        const selected = lang.code === value;
        return (
          <button
            key={lang.code}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(lang.code)}
            className={cn(
              "group relative flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all",
              "hover:border-primary/40 hover:bg-accent/50",
              selected
                ? "border-primary bg-accent glow-primary"
                : "border-border bg-card",
            )}
          >
            <div className="flex w-full items-center justify-between">
              <span className="text-2xl leading-none" aria-hidden>
                {lang.flag}
              </span>
              {selected && (
                <Check className="h-4 w-4 text-primary" aria-hidden />
              )}
            </div>
            <div className="space-y-0.5 min-w-0 w-full">
              <div
                className={cn(
                  "text-sm font-semibold truncate w-full",
                  selected ? "text-primary" : "text-foreground",
                )}
              >
                {lang.nativeName}
              </div>
              <div className="text-[11px] text-muted-foreground truncate w-full">
                {lang.name}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
