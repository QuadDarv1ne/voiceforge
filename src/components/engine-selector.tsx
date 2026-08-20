"use client";

import * as React from "react";
import { AudioLines, Globe, Mic, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export type TTSEngine = "web-speech" | "z-ai" | "freetts";

interface EngineInfo {
  id: TTSEngine;
  label: string;
  description: string;
  icon: React.ReactNode;
  badge?: string;
  /** Accent color class for the icon container */
  accent: string;
}

const ENGINES: EngineInfo[] = [
  {
    id: "web-speech",
    label: "Web Speech",
    description: "Мгновенно в браузере, все 15 языков",
    icon: <Globe className="h-4 w-4" />,
    accent: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  },
  {
    id: "freetts",
    label: "FreeTTS.ru",
    description: "298 нейроголосов, MP3 скачивание",
    icon: <Mic className="h-4 w-4" />,
    badge: "NEW",
    accent: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  },
  {
    id: "z-ai",
    label: "Z.ai SDK",
    description: "Серверный движок, высокое качество",
    icon: <Sparkles className="h-4 w-4" />,
    accent: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  },
];

interface EngineSelectorProps {
  value: TTSEngine;
  onChange: (engine: TTSEngine) => void;
  className?: string;
}

export function EngineSelector({
  value,
  onChange,
  className,
}: EngineSelectorProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-2 sm:grid-cols-3",
        className,
      )}
      role="radiogroup"
      aria-label="Движок TTS"
    >
      {ENGINES.map((engine) => {
        const selected = engine.id === value;
        return (
          <button
            key={engine.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(engine.id)}
            className={cn(
              "group relative flex items-start gap-3 rounded-xl border p-3 text-left transition-all",
              "hover:border-primary/40 hover:bg-accent/50",
              selected
                ? "border-primary bg-accent glow-primary"
                : "border-border bg-card",
            )}
          >
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                engine.accent,
              )}
            >
              {engine.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "text-sm font-semibold",
                    selected ? "text-primary" : "text-foreground",
                  )}
                >
                  {engine.label}
                </span>
                {engine.badge && (
                  <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary">
                    {engine.badge}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                {engine.description}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function EngineBadge({ engine }: { engine: TTSEngine }) {
  const info = ENGINES.find((e) => e.id === engine);
  if (!info) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium",
        info.accent,
      )}
    >
      <AudioLines className="h-3 w-3" />
      {info.label}
    </span>
  );
}
