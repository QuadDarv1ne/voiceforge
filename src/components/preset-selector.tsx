"use client";

import * as React from "react";
import {
  BookOpen,
  Newspaper,
  Mic2,
  GraduationCap,
  Megaphone,
  Heart,
  Zap,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface PresetConfig {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  rate: number;
  pitch: number;
  volume: number;
  accent: string;
}

/**
 * Voice presets — pre-configured rate/pitch/volume combinations
 * for common use cases (audiobook, news, podcast, etc.)
 */
export const VOICE_PRESETS: PresetConfig[] = [
  {
    id: "default",
    label: "По умолчанию",
    description: "Сбалансированные настройки 1.0×",
    icon: <RotateCcw className="h-4 w-4" />,
    rate: 1.0,
    pitch: 1.0,
    volume: 1.0,
    accent: "bg-muted text-muted-foreground",
  },
  {
    id: "audiobook",
    label: "Аудиокнига",
    description: "Спокойный темп 0.9×, мягкий тон",
    icon: <BookOpen className="h-4 w-4" />,
    rate: 0.9,
    pitch: 0.95,
    volume: 1.0,
    accent: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  },
  {
    id: "news",
    label: "Новости",
    description: "Чёткая дикторская речь 1.0×",
    icon: <Newspaper className="h-4 w-4" />,
    rate: 1.0,
    pitch: 1.0,
    volume: 1.0,
    accent: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  },
  {
    id: "podcast",
    label: "Подкаст",
    description: "Дружелюбный темп 1.05×, выше тон",
    icon: <Mic2 className="h-4 w-4" />,
    rate: 1.05,
    pitch: 1.1,
    volume: 1.0,
    accent: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  },
  {
    id: "study",
    label: "Учеба",
    description: "Медленный темп 0.8× для запоминания",
    icon: <GraduationCap className="h-4 w-4" />,
    rate: 0.8,
    pitch: 1.0,
    volume: 1.0,
    accent: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  },
  {
    id: "announcement",
    label: "Объявление",
    description: "Громко 1.1×, уверенный тон",
    icon: <Megaphone className="h-4 w-4" />,
    rate: 1.1,
    pitch: 1.05,
    volume: 1.0,
    accent: "bg-red-500/15 text-red-600 dark:text-red-400",
  },
  {
    id: "bedtime",
    label: "Сказка",
    description: "Тихо 0.85×, низкий тон",
    icon: <Heart className="h-4 w-4" />,
    rate: 0.85,
    pitch: 0.85,
    volume: 0.85,
    accent: "bg-pink-500/15 text-pink-600 dark:text-pink-400",
  },
  {
    id: "fast",
    label: "Быстро",
    description: "Ускоренный темп 1.5×",
    icon: <Zap className="h-4 w-4" />,
    rate: 1.5,
    pitch: 1.0,
    volume: 1.0,
    accent: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400",
  },
];

interface PresetSelectorProps {
  currentRate: number;
  currentPitch: number;
  currentVolume: number;
  onApply: (preset: PresetConfig) => void;
  className?: string;
}

export function PresetSelector({
  currentRate,
  currentPitch,
  currentVolume,
  onApply,
  className,
}: PresetSelectorProps) {
  // Detect which preset is currently active (within rounding tolerance)
  const activePresetId = React.useMemo(() => {
    const match = VOICE_PRESETS.find(
      (p) =>
        Math.abs(p.rate - currentRate) < 0.01 &&
        Math.abs(p.pitch - currentPitch) < 0.01 &&
        Math.abs(p.volume - currentVolume) < 0.01,
    );
    return match?.id;
  }, [currentRate, currentPitch, currentVolume]);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">
          Пресеты
        </span>
        {activePresetId && activePresetId !== "default" && (
          <span className="text-[10px] text-muted-foreground">
            Активен:{" "}
            <span className="font-medium text-foreground">
              {VOICE_PRESETS.find((p) => p.id === activePresetId)?.label}
            </span>
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {VOICE_PRESETS.map((preset) => {
          const isActive = preset.id === activePresetId;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onApply(preset)}
              title={preset.description}
              className={cn(
                "group flex flex-col items-start gap-1 rounded-lg border p-2 text-left transition-all",
                "hover:border-primary/40 hover:bg-accent/50",
                isActive
                  ? "border-primary bg-accent"
                  : "border-border bg-card",
              )}
            >
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-md",
                    preset.accent,
                  )}
                >
                  {preset.icon}
                </span>
                <span className="text-xs font-semibold">{preset.label}</span>
              </div>
              <span className="text-[10px] leading-tight text-muted-foreground line-clamp-2">
                {preset.description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
