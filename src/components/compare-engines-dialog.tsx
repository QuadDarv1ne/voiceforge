"use client";

import * as React from "react";
import {
  AudioLines,
  Loader2,
  Play,
  Pause,
  Download,
  X,
  Sparkles,
  Globe,
  Mic,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CompareResult {
  engine: "web-speech" | "z-ai" | "freetts";
  label: string;
  icon: React.ReactNode;
  accent: string;
  status: "idle" | "loading" | "ready" | "error";
  audioUrl?: string;
  error?: string;
  duration?: number;
}

interface CompareEnginesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  text: string;
  langCode: string;
  voiceURI?: string;
  freettsVoice?: string;
  freettsLangCode: string;
  rate: number;
  pitch: number;
  volume: number;
}

export function CompareEnginesDialog({
  open,
  onOpenChange,
  text,
  langCode,
  voiceURI,
  freettsVoice,
  freettsLangCode,
  rate,
  pitch,
  volume,
}: CompareEnginesDialogProps) {
  const [results, setResults] = React.useState<CompareResult[]>([]);
  const audioRefs = React.useRef<Record<string, HTMLAudioElement | null>>({});

  const trimmedText = text.trim();
  const canCompare = trimmedText.length > 0 && trimmedText.length <= 1024;

  const engines: CompareResult[] = React.useMemo(
    () => [
      {
        engine: "web-speech",
        label: "Web Speech API",
        icon: <Globe className="h-4 w-4" />,
        accent: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
        status: "idle" as const,
      },
      {
        engine: "z-ai",
        label: "Z.ai SDK",
        icon: <Sparkles className="h-4 w-4" />,
        accent: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
        status: "idle" as const,
      },
      {
        engine: "freetts",
        label: "FreeTTS.ru",
        icon: <Mic className="h-4 w-4" />,
        accent: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
        status: "idle" as const,
      },
    ],
    [],
  );

  // Reset on open
  React.useEffect(() => {
    if (open) {
      setResults(engines.map((e) => ({ ...e })));
    }
  }, [open, engines]);

  const runCompare = React.useCallback(async () => {
    if (!canCompare) return;

    // Mark all as loading
    setResults(engines.map((e) => ({ ...e, status: "loading" })));

    // Run Z.ai and freetts in parallel (Web Speech can't be captured to audio easily)
    const tasks: Promise<void>[] = [];

    // Z.ai task
    tasks.push(
      (async () => {
        try {
          const res = await fetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: trimmedText,
              voice: "tongtong",
              speed: rate,
              format: "wav",
            }),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || `HTTP ${res.status}`);
          }
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          setResults((prev) =>
            prev.map((r) =>
              r.engine === "z-ai"
                ? {
                    ...r,
                    status: "ready",
                    audioUrl: url,
                  }
                : r,
            ),
          );
        } catch (e) {
          setResults((prev) =>
            prev.map((r) =>
              r.engine === "z-ai"
                ? {
                    ...r,
                    status: "error",
                    error: e instanceof Error ? e.message : "Unknown error",
                  }
                : r,
            ),
          );
        }
      })(),
    );

    // FreeTTS task (only if language supported)
    if (freettsLangCode) {
      tasks.push(
        (async () => {
          try {
            const res = await fetch("/api/freetts/synthesize", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                text: trimmedText,
                voice: freettsVoice,
              }),
            });
            if (!res.ok) {
              const err = await res.json().catch(() => ({}));
              throw new Error(err.error || `HTTP ${res.status}`);
            }
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const actualEngine = res.headers.get("X-Engine") || "freetts.ru";
            const strategy = res.headers.get("X-Strategy") || "unknown";
            setResults((prev) =>
              prev.map((r) =>
                r.engine === "freetts"
                  ? {
                      ...r,
                      status: "ready",
                      audioUrl: url,
                      // If fallback happened, show that in the label
                      label:
                        strategy.includes("fallback")
                          ? `FreeTTS.ru → ${actualEngine}`
                          : `FreeTTS.ru (${strategy})`,
                    }
                  : r,
              ),
            );
          } catch (e) {
            setResults((prev) =>
              prev.map((r) =>
                r.engine === "freetts"
                  ? {
                      ...r,
                      status: "error",
                      error: e instanceof Error ? e.message : "Unknown error",
                    }
                  : r,
              ),
            );
          }
        })(),
      );
    } else {
      // No freetts for this language
      setResults((prev) =>
        prev.map((r) =>
          r.engine === "freetts"
            ? {
                ...r,
                status: "error",
                error: "Язык не поддерживается freetts.ru",
              }
            : r,
        ),
      );
    }

    // Web Speech can't easily capture audio — show as informational
    setResults((prev) =>
      prev.map((r) =>
        r.engine === "web-speech"
          ? {
              ...r,
              status: "error",
              error:
                "Web Speech API не может быть записан в аудио-файл. Используйте основной интерфейс для прослушивания.",
            }
          : r,
      ),
    );

    await Promise.allSettled(tasks);
  }, [
    canCompare,
    engines,
    trimmedText,
    rate,
    freettsLangCode,
    freettsVoice,
  ]);

  // Cleanup URLs on close
  React.useEffect(() => {
    if (!open) {
      results.forEach((r) => {
        if (r.audioUrl) URL.revokeObjectURL(r.audioUrl);
      });
    }
  }, [open, results]);

  const handleDownload = (r: CompareResult) => {
    if (!r.audioUrl) return;
    const a = document.createElement("a");
    a.href = r.audioUrl;
    a.download = `voiceforge-compare-${r.engine}-${Date.now()}.${
      r.engine === "z-ai" ? "wav" : "mp3"
    }`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AudioLines className="h-5 w-5 text-primary" />
            Сравнение движков TTS
          </DialogTitle>
          <DialogDescription>
            Озвучить один и тот же текст тремя движками и сравнить качество.
            Текст: &laquo;{trimmedText.slice(0, 80)}
            {trimmedText.length > 80 ? "…" : ""}&raquo;
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-2 px-1">
          <Badge variant="secondary">
            {trimmedText.length} символов
          </Badge>
          <Button
            onClick={runCompare}
            disabled={!canCompare || results.some((r) => r.status === "loading")}
            className="brand-gradient glow-primary"
            size="sm"
          >
            {results.some((r) => r.status === "loading") ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            {results.some((r) => r.status === "loading")
              ? "Синтез..."
              : "Сравнить все движки"}
          </Button>
        </div>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-3 pb-2">
            {results.map((r) => (
              <Card key={r.engine} className="border-border/60">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                        r.accent,
                      )}
                    >
                      {r.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <h4 className="text-sm font-semibold">
                            {r.label}
                          </h4>
                          {r.duration && (
                            <p className="text-xs text-muted-foreground">
                              {r.duration.toFixed(1)} сек
                            </p>
                          )}
                        </div>
                        {r.status === "ready" && (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7"
                              onClick={() => {
                                const audio = audioRefs.current[r.engine];
                                if (audio) {
                                  if (audio.paused) audio.play();
                                  else audio.pause();
                                }
                              }}
                            >
                              <Play className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7"
                              onClick={() => handleDownload(r)}
                            >
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>

                      <div className="mt-2">
                        {r.status === "idle" && (
                          <p className="text-xs text-muted-foreground">
                            Нажмите «Сравнить все движки»
                          </p>
                        )}
                        {r.status === "loading" && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Синтезируем...
                          </div>
                        )}
                        {r.status === "ready" && r.audioUrl && (
                          <audio
                            ref={(el) => {
                              audioRefs.current[r.engine] = el;
                            }}
                            src={r.audioUrl}
                            controls
                            className="w-full"
                            style={{ height: "32px" }}
                            onLoadedMetadata={(e) => {
                              const dur = e.currentTarget.duration;
                              if (dur && !Number.isNaN(dur)) {
                                setResults((prev) =>
                                  prev.map((rr) =>
                                    rr.engine === r.engine
                                      ? { ...rr, duration: dur }
                                      : rr,
                                  ),
                                );
                              }
                            }}
                          />
                        )}
                        {r.status === "error" && (
                          <p className="text-xs text-destructive flex items-start gap-1.5">
                            <X className="h-3 w-3 mt-0.5 shrink-0" />
                            <span>{r.error}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>

        <div className="text-xs text-muted-foreground border-t border-border pt-3">
          💡 Совет: Web Speech API не может быть записан в файл — это
          ограничение браузера. Используйте основной интерфейс для
          прослушивания через Web Speech.
        </div>
      </DialogContent>
    </Dialog>
  );
}
