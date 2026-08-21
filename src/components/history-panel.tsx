"use client";

import * as React from "react";
import {
  Clock,
  Download,
  Play,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export interface HistoryItem {
  id: string;
  text: string;
  langCode: string;
  langName: string;
  flag: string;
  voiceName?: string;
  /** TTS engine used for this entry (e.g. "web-speech", "freetts", "z-ai", "piper") */
  engine?: string;
  createdAt: number;
}

interface HistoryPanelProps {
  items: HistoryItem[];
  onReplay: (item: HistoryItem) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  className?: string;
}

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "только что";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} мин назад`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ч назад`;
  const day = Math.floor(hr / 24);
  return `${day} дн назад`;
}

export function HistoryPanel({
  items,
  onReplay,
  onRemove,
  onClear,
  className,
}: HistoryPanelProps) {
  const handleExportJson = React.useCallback(() => {
    if (items.length === 0) return;
    const blob = new Blob([JSON.stringify(items, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `voiceforge-history-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [items]);

  const handleExportCsv = React.useCallback(() => {
    if (items.length === 0) return;
    const header = ["id", "createdAt", "langCode", "langName", "voiceName", "text"];
    const escape = (s: string | number | undefined) => {
      const v = String(s ?? "");
      if (v.includes(",") || v.includes('"') || v.includes("\n")) {
        return `"${v.replace(/"/g, '""')}"`;
      }
      return v;
    };
    const lines = [header.join(",")];
    for (const it of items) {
      lines.push(
        [
          it.id,
          new Date(it.createdAt).toISOString(),
          it.langCode,
          it.langName,
          it.voiceName ?? "",
          it.text,
        ]
          .map(escape)
          .join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `voiceforge-history-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [items]);

  if (items.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border p-8 text-center",
          className,
        )}
      >
        <Clock className="h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">
          История пуста. Озвученные тексты появятся здесь.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-semibold text-muted-foreground">
          Недавние ({items.length})
        </h3>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExportJson}
            className="h-7 text-xs"
            title="Экспортировать в JSON"
          >
            <Download className="mr-1 h-3 w-3" />
            JSON
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExportCsv}
            className="h-7 text-xs"
            title="Экспортировать в CSV"
          >
            <Download className="mr-1 h-3 w-3" />
            CSV
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="h-7 text-xs text-muted-foreground hover:text-destructive"
            title="Очистить историю"
          >
            <Trash2 className="mr-1 h-3 w-3" />
            Очистить
          </Button>
        </div>
      </div>
      <ScrollArea className="h-72 rounded-lg border border-border bg-card/50">
        <div className="space-y-1 p-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="group flex items-start gap-3 rounded-md p-2 transition-colors hover:bg-accent/50"
            >
              <span className="text-lg leading-none mt-0.5" aria-hidden>
                {item.flag}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground line-clamp-2">
                  {item.text}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                  <span>{item.langName}</span>
                  <span aria-hidden>·</span>
                  <span>{formatRelative(item.createdAt)}</span>
                  {item.voiceName && (
                    <>
                      <span aria-hidden>·</span>
                      <span className="font-mono text-[10px]">
                        {item.voiceName}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => onReplay(item)}
                  aria-label="Воспроизвести снова"
                >
                  <Play className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => onRemove(item.id)}
                  aria-label="Удалить"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
