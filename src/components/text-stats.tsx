"use client";

import * as React from "react";
import { Clock, Type, Hash, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface TextStatsProps {
  text: string;
  rate: number;
  className?: string;
}

/**
 * Calculate estimated speech duration in seconds.
 *
 * Average speaking rate is ~150 words per minute at rate=1.0.
 * Higher `rate` values reduce duration proportionally.
 */
function estimateDurationSeconds(
  wordCount: number,
  rate: number,
): number {
  if (wordCount === 0) return 0;
  const wordsPerMinute = 150 * (rate || 1);
  return (wordCount / wordsPerMinute) * 60;
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return "0с";
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  if (mins === 0) return `${secs}с`;
  return `${mins}м ${secs.toString().padStart(2, "0")}с`;
}

export function TextStats({ text, rate, className }: TextStatsProps) {
  const stats = React.useMemo(() => {
    const trimmed = text.trim();
    const charCount = text.length;
    const charCountNoSpaces = text.replace(/\s/g, "").length;
    const wordCount = trimmed
      ? trimmed.split(/\s+/).filter(Boolean).length
      : 0;
    const sentenceCount = trimmed
      ? (trimmed.match(/[^.!?]+[.!?]+/g) || []).length || (trimmed ? 1 : 0)
      : 0;
    const duration = estimateDurationSeconds(wordCount, rate);
    return {
      charCount,
      charCountNoSpaces,
      wordCount,
      sentenceCount,
      duration,
    };
  }, [text, rate]);

  const items = [
    {
      icon: <Type className="h-3 w-3" />,
      label: "Символов",
      value: stats.charCount.toString(),
    },
    {
      icon: <Hash className="h-3 w-3" />,
      label: "Слов",
      value: stats.wordCount.toString(),
    },
    {
      icon: <FileText className="h-3 w-3" />,
      label: "Предлож.",
      value: stats.sentenceCount.toString(),
    },
    {
      icon: <Clock className="h-3 w-3" />,
      label: "Время",
      value: formatDuration(stats.duration),
      highlight: stats.duration > 0,
    },
  ];

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]",
        className,
      )}
    >
      {items.map((item, i) => (
        <span
          key={i}
          className={cn(
            "flex items-center gap-1 text-muted-foreground",
            item.highlight && "text-primary font-medium",
          )}
        >
          {item.icon}
          <span>{item.label}:</span>
          <span className="font-mono font-medium text-foreground">
            {item.value}
          </span>
        </span>
      ))}
    </div>
  );
}
