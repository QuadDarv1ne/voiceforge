"use client";

import * as React from "react";
import {
  Check,
  Heart,
  Search,
  User,
  UserRound,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  getFreeTtsVoicesByLang,
  type FreeTtsVoice,
} from "@/lib/freetts-voices";

const FAV_STORAGE_KEY = "voiceforge:freetts-favorites";

interface FreettsVoicePickerProps {
  /** ISO 639-1 language code from freetts (e.g. "ru", "en") */
  freettsLangCode: string;
  value: string;
  onChange: (voiceCode: string) => void;
}

type GenderFilter = "all" | "m" | "f" | "fav";

function loadFavorites(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(FAV_STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(arr);
  } catch {
    return new Set();
  }
}

function saveFavorites(favs: Set<string>) {
  try {
    localStorage.setItem(
      FAV_STORAGE_KEY,
      JSON.stringify(Array.from(favs)),
    );
  } catch {}
}

export function FreettsVoicePicker({
  freettsLangCode,
  value,
  onChange,
}: FreettsVoicePickerProps) {
  const [genderFilter, setGenderFilter] = React.useState<GenderFilter>("all");
  const [search, setSearch] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [favorites, setFavorites] = React.useState<Set<string>>(
    new Set(),
  );

  // Load favorites on mount
  React.useEffect(() => {
    setFavorites(loadFavorites());
  }, []);

  // Toggle favorite (preserved across language switches)
  const toggleFavorite = React.useCallback(
    (code: string, e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setFavorites((prev) => {
        const next = new Set(prev);
        if (next.has(code)) next.delete(code);
        else next.add(code);
        saveFavorites(next);
        return next;
      });
    },
    [],
  );

  const voices = React.useMemo<FreeTtsVoice[]>(() => {
    if (!freettsLangCode) return [];
    return getFreeTtsVoicesByLang(freettsLangCode);
  }, [freettsLangCode]);

  const filteredVoices = React.useMemo(() => {
    let list = voices;
    if (genderFilter === "fav") {
      list = list.filter((v) => favorites.has(v.code));
    } else if (genderFilter !== "all") {
      list = list.filter((v) => v.gender === genderFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (v) =>
          v.name.toLowerCase().includes(q) ||
          v.code.toLowerCase().includes(q),
      );
    }
    return list;
  }, [voices, genderFilter, search, favorites]);

  // Reset voice selection when language changes
  React.useEffect(() => {
    if (
      voices.length > 0 &&
      value &&
      !voices.some((v) => v.code === value)
    ) {
      onChange(voices[0].code);
    } else if (voices.length > 0 && !value) {
      onChange(voices[0].code);
    }
  }, [voices, value, onChange]);

  if (!freettsLangCode) {
    return (
      <div className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
        Для этого языка нет голосов freetts.ru. Используйте Web Speech API.
      </div>
    );
  }

  if (voices.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
        Нет голосов freetts.ru для этого языка.
      </div>
    );
  }

  const selectedVoice = voices.find((v) => v.code === value);
  const favCount = voices.filter((v) => favorites.has(v.code)).length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Badge variant="secondary" className="h-6">
          {voices.length} голосов
        </Badge>
        <div className="flex items-center gap-1 rounded-md border border-border bg-card p-0.5">
          {(
            [
              { id: "all", label: "Все", icon: null },
              { id: "m", label: "Муж", icon: <UserRound className="h-3 w-3" /> },
              { id: "f", label: "Жен", icon: <User className="h-3 w-3" /> },
              { id: "fav", label: `${favCount || ""}`, icon: <Heart className="h-3 w-3" /> },
            ] as { id: GenderFilter; label: string; icon: React.ReactNode }[]
          ).map((g) => (
            <Button
              key={g.id}
              type="button"
              variant={genderFilter === g.id ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setGenderFilter(g.id)}
              className="h-6 gap-1 px-2 text-xs"
              title={
                g.id === "fav" ? "Избранные голоса" : g.label
              }
            >
              {g.icon}
              {g.label}
            </Button>
          ))}
        </div>
      </div>

      <Select value={value} onValueChange={onChange} open={open} onOpenChange={setOpen}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Выберите голос">
            {selectedVoice && (
              <span className="flex items-center gap-2">
                {selectedVoice.gender === "m" ? (
                  <UserRound className="h-4 w-4 text-blue-500" />
                ) : (
                  <User className="h-4 w-4 text-pink-500" />
                )}
                <span className="font-medium">{selectedVoice.name}</span>
                <span className="text-xs text-muted-foreground">
                  ({selectedVoice.code})
                </span>
                {favorites.has(selectedVoice.code) && (
                  <Heart className="h-3 w-3 fill-red-500 text-red-500" />
                )}
              </span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-96">
          {/* Search box inside the dropdown */}
          <div className="border-b border-border p-2 sticky top-0 bg-popover z-10">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Поиск среди ${voices.length} голосов...`}
                className="h-8 pl-7 pr-7 text-xs"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              />
              {search && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSearch("");
                  }}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
          <ScrollArea className="h-72">
            <div className="space-y-0.5 p-1">
              {filteredVoices.length === 0 && (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  {genderFilter === "fav"
                    ? "Нет избранных голосов для этого языка"
                    : "Ничего не найдено"}
                </div>
              )}
              {filteredVoices.map((v) => (
                <SelectItem
                  key={v.code}
                  value={v.code}
                  className="flex items-center gap-2 py-2"
                >
                  <span className="flex items-center gap-2 w-full">
                    {v.gender === "m" ? (
                      <UserRound className="h-4 w-4 text-blue-500 shrink-0" />
                    ) : (
                      <User className="h-4 w-4 text-pink-500 shrink-0" />
                    )}
                    <span className="font-medium">{v.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {v.code}
                    </span>
                    {v.code === value && (
                      <Check className="h-3 w-3 text-primary" />
                    )}
                    <button
                      type="button"
                      onClick={(e) => toggleFavorite(v.code, e)}
                      className={cn(
                        "ml-auto shrink-0 p-1 rounded transition-colors",
                        favorites.has(v.code)
                          ? "text-red-500 hover:text-red-600"
                          : "text-muted-foreground hover:text-red-500",
                      )}
                      title={
                        favorites.has(v.code)
                          ? "Убрать из избранного"
                          : "Добавить в избранное"
                      }
                    >
                      <Heart
                        className={cn(
                          "h-3 w-3",
                          favorites.has(v.code) && "fill-current",
                        )}
                      />
                    </button>
                  </span>
                </SelectItem>
              ))}
            </div>
          </ScrollArea>
        </SelectContent>
      </Select>

      {selectedVoice && (
        <p className="text-xs text-muted-foreground">
          Движок:{" "}
          <span className="font-medium text-foreground">freetts.ru</span>{" "}
          · Выбран голос:{" "}
          <span className="font-medium text-foreground">
            {selectedVoice.name}
          </span>{" "}
          ({selectedVoice.gender === "m" ? "мужской" : "женский"})
        </p>
      )}
    </div>
  );
}
