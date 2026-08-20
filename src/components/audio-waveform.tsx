"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface AudioWaveformProps {
  /** Whether audio is currently playing */
  active: boolean;
  /** Number of bars to render */
  bars?: number;
  /** Color class for active bars */
  colorClass?: string;
  /** Height of the waveform container */
  height?: number;
  className?: string;
}

/**
 * Animated audio waveform visualization.
 *
 * Uses CSS animations with staggered delays — no JS animation loop needed.
 * When `active` is true, bars animate with varying heights;
 * when inactive, bars fall back to a flat baseline.
 */
export function AudioWaveform({
  active,
  bars = 28,
  colorClass = "bg-primary",
  height = 32,
  className,
}: AudioWaveformProps) {
  // Pre-generate bar configs with pseudo-random heights/delays
  // (deterministic so SSR and client match)
  const barConfigs = React.useMemo(() => {
    const configs: { heightPct: number; delayMs: number; durationMs: number }[] =
      [];
    // Use a simple seeded pseudo-random for determinism
    let seed = 42;
    const rand = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    for (let i = 0; i < bars; i++) {
      configs.push({
        heightPct: 30 + rand() * 70, // 30-100%
        delayMs: Math.floor(rand() * 800),
        durationMs: 600 + Math.floor(rand() * 600),
      });
    }
    return configs;
  }, [bars]);

  return (
    <div
      className={cn(
        "flex items-center justify-center gap-[2px]",
        className,
      )}
      style={{ height }}
      aria-hidden="true"
    >
      {barConfigs.map((cfg, i) => (
        <span
          key={i}
          className={cn(
            "inline-block w-[3px] rounded-full transition-all",
            colorClass,
            active && "animate-waveform-bar",
          )}
          style={{
            height: active ? `${cfg.heightPct}%` : "20%",
            animationDelay: `${cfg.delayMs}ms`,
            animationDuration: `${cfg.durationMs}ms`,
            opacity: active ? 1 : 0.3,
          }}
        />
      ))}
    </div>
  );
}
