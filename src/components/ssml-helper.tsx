"use client";

import * as React from "react";
import { ChevronDown, ChevronUp, Tag, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { SSML_TAG_REFERENCE } from "@/lib/ssml";

interface SsmlHelperProps {
  onInsertTag: (tag: string) => void;
  className?: string;
}

export function SsmlHelper({ onInsertTag, className }: SsmlHelperProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className={cn("rounded-md border border-border bg-card/50", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 p-2 text-left transition-colors hover:bg-accent/50"
      >
        <span className="flex items-center gap-2 text-xs font-medium">
          <Tag className="h-3.5 w-3.5 text-primary" />
          SSML-теги для выразительности
          <Badge variant="secondary" className="h-4 text-[10px]">
            {SSML_TAG_REFERENCE.length}
          </Badge>
        </span>
        {open ? (
          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>
      {open && (
        <div className="border-t border-border p-2">
          <p className="mb-2 text-[11px] text-muted-foreground">
            Нажмите на тег, чтобы вставить его в текст. Работает только с
            движком Web Speech API.
          </p>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {SSML_TAG_REFERENCE.map((ref) => (
              <button
                key={ref.tag}
                type="button"
                onClick={() => onInsertTag(ref.tag)}
                className="group flex items-start gap-2 rounded-md border border-border bg-background/50 p-2 text-left transition-all hover:border-primary/40 hover:bg-accent/50"
              >
                <Plus className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground group-hover:text-primary" />
                <div className="min-w-0 flex-1">
                  <code className="text-[11px] font-mono text-primary break-all">
                    {ref.tag}
                  </code>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {ref.description}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
