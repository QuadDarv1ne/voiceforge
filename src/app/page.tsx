"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  AudioLines,
  Download,
  Pause,
  Play,
  RotateCcw,
  Square,
  Volume2,
  Gauge,
  Music2,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Wand2,
  Mic,
  Upload,
  HardDriveDownload,
  User,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSelector } from "@/components/language-selector";
import { VoiceSelector } from "@/components/voice-selector";
import {
  EngineSelector,
  EngineBadge,
  type TTSEngine,
} from "@/components/engine-selector";
import { FreettsVoicePicker } from "@/components/freetts-voice-picker";
import { CompareEnginesDialog } from "@/components/compare-engines-dialog";
import { AudioWaveform } from "@/components/audio-waveform";
import { PresetSelector, type PresetConfig } from "@/components/preset-selector";
import { TextStats } from "@/components/text-stats";
import { SsmlHelper } from "@/components/ssml-helper";
import { HistoryPanel, type HistoryItem } from "@/components/history-panel";
import { useSpeechSynthesis } from "@/hooks/use-speech-synthesis";
import { ZAI_VOICES, type ZaiVoice } from "@/hooks/use-zai-tts";
import {
  LANGUAGES,
  getLanguageByCode,
  getDefaultLanguage,
} from "@/lib/languages";
import { FREETTS_DEFAULT_VOICE } from "@/lib/freetts-voices";
import { parseSSML } from "@/lib/ssml";

const MAX_CHARS = 5000;
const HISTORY_STORAGE_KEY = "voiceforge:history";
const HISTORY_MAX = 20;

/** Format seconds as m:ss */
function formatTime(sec: number): string {
  if (!sec || isNaN(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** File extension for downloaded audio per TTS engine */
function getDownloadExtension(engine: TTSEngine): string {
  // freetts.ru returns MP3; Z.ai and Piper return WAV
  return engine === "freetts" ? "mp3" : "wav";
}

/**
 * Determine the correct file extension for download.
 * Uses the actual audio format when available (handles freetts fallback
 * to Piper/Z.ai which returns WAV instead of MP3).
 */
function resolveDownloadExtension(
  engine: TTSEngine,
  audioExt?: string,
): string {
  if (audioExt) return audioExt;
  return getDownloadExtension(engine);
}

export default function Home() {
  const defaultLang = getDefaultLanguage();

  // Core state
  const [langCode, setLangCode] = React.useState<string>(defaultLang.code);
  const [text, setText] = React.useState<string>(defaultLang.sample);
  const [voiceURI, setVoiceURI] = React.useState<string>("");
  const [freettsVoice, setFreettsVoice] = React.useState<string>(
    FREETTS_DEFAULT_VOICE.code,
  );
  const [zaiVoice, setZaiVoice] = React.useState<ZaiVoice>("tongtong");
  // Piper local voices ("dmitri" is the default Russian male voice)
  const [piperVoice, setPiperVoice] = React.useState<string>("dmitri");
  const [piperVoices, setPiperVoices] = React.useState<
    { id: string; name: string; lang: string; gender: string }[]
  >([]);
  const [engine, setEngine] = React.useState<TTSEngine>("web-speech");
  const [rate, setRate] = React.useState<number>(1.0);
  const [pitch, setPitch] = React.useState<number>(1.0);
  const [volume, setVolume] = React.useState<number>(1.0);
  const [history, setHistory] = React.useState<HistoryItem[]>([]);
  const [downloading, setDownloading] = React.useState<boolean>(false);
  const [freettsAudioUrl, setFreettsAudioUrl] = React.useState<string | null>(
    null,
  );
  // Tracks the actual audio format ("mp3" or "wav") of freettsAudioUrl,
  // which may differ from the selected engine when freetts falls back to
  // Piper/Z.ai (both return WAV instead of MP3).
  const [freettsAudioExt, setFreettsAudioExt] = React.useState<string>("wav");
  const freettsAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const [compareOpen, setCompareOpen] = React.useState(false);
  const [freettsPlaying, setFreettsPlaying] = React.useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = React.useState(0);
  const [audioDuration, setAudioDuration] = React.useState(0);
  // Tracks the last audio URL we triggered playback for, so the effect
  // restarts playback only for NEW audio, not for rate changes.
  const lastPlayedUrlRef = React.useRef<string>("");

  // Load available Piper voices when the piper engine is selected
  const [piperVoicesLoading, setPiperVoicesLoading] =
    React.useState(false);
  const [piperReloadKey, setPiperReloadKey] = React.useState(0);
  React.useEffect(() => {
    if (engine !== "piper") return;
    let cancelled = false;
    setPiperVoicesLoading(true);
    (async () => {
      try {
        const res = await fetch("/api/piper/voices");
        if (res.ok) {
          const json = await res.json();
          if (!cancelled && Array.isArray(json.voices)) {
            setPiperVoices(json.voices);
            // If current selection isn't available, pick the first
            // voice matching the current language (ru by default)
            const currentAvailable = json.voices.some(
              (v: { id: string }) => v.id === piperVoice,
            );
            if (!currentAvailable) {
              const ruVoice =
                json.voices.find((v: { id: string }) =>
                  v.id.startsWith("ru_RU"),
                ) ?? json.voices[0];
              if (ruVoice) setPiperVoice(ruVoice.id);
            }
          }
        }
      } catch {
        // mini-service not running — keep default voice
      } finally {
        if (!cancelled) setPiperVoicesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [engine, piperReloadKey]);

  // Auto-play when a new audio URL is set (freetts / z-ai engines)
  React.useEffect(() => {
    if (!freettsAudioUrl) return;
    const el = freettsAudioRef.current;
    if (!el) return;
    if (lastPlayedUrlRef.current !== freettsAudioUrl) {
      // New audio — load and play
      lastPlayedUrlRef.current = freettsAudioUrl;
      el.src = freettsAudioUrl;
      el.playbackRate = rate;
      el.play().catch(() => {
        /* user gesture required — user can press play manually */
      });
      setAudioCurrentTime(0);
      setAudioDuration(0);
    } else {
      // Same audio — just apply the new playback rate
      el.playbackRate = rate;
    }
  }, [freettsAudioUrl, rate]);

  // Revoke object URL on unmount to prevent memory leak
  const freettsAudioUrlRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    freettsAudioUrlRef.current = freettsAudioUrl;
  }, [freettsAudioUrl]);
  React.useEffect(() => {
    return () => {
      if (freettsAudioUrlRef.current) URL.revokeObjectURL(freettsAudioUrlRef.current);
    };
  }, []);

  // Load history from localStorage on mount
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as HistoryItem[];
        if (Array.isArray(parsed)) {
          setHistory(parsed.slice(0, HISTORY_MAX));
        }
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  // Persist history
  const persistHistory = React.useCallback((items: HistoryItem[]) => {
    setHistory(items);
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(items));
    } catch {
      // ignore quota errors
    }
  }, []);

  const addHistory = React.useCallback(
    (item: Omit<HistoryItem, "id" | "createdAt">) => {
      const newItem: HistoryItem = {
        ...item,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: Date.now(),
      };
      setHistory((prev) => {
        const next = [newItem, ...prev].slice(0, HISTORY_MAX);
        try {
          localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
    },
    [],
  );

  const removeHistory = React.useCallback((id: string) => {
    setHistory((prev) => {
      const next = prev.filter((i) => i.id !== id);
      try {
        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const clearHistory = React.useCallback(() => {
    persistHistory([]);
  }, [persistHistory]);

  const speech = useSpeechSynthesis({
    onError: (e) => {
      toast.error("Ошибка воспроизведения", {
        description: e.error || "Не удалось воспроизвести речь",
      });
    },
  });

  // Filter voices by language when language changes — pick a sensible default
  React.useEffect(() => {
    if (!speech.supported) return;
    const matching = speech.voices.filter((v) => v.lang === langCode);
    if (matching.length > 0) {
      // Prefer non-default if multiple, then first
      setVoiceURI(matching[0].voiceURI);
    } else {
      const prefix = langCode.split("-")[0];
      const prefixMatch = speech.voices.find((v) =>
        v.lang.startsWith(prefix),
      );
      if (prefixMatch) {
        setVoiceURI(prefixMatch.voiceURI);
      } else if (speech.voices.length > 0) {
        setVoiceURI(speech.voices[0].voiceURI);
      }
    }
  }, [langCode, speech.voices, speech.supported]);

  const currentLang = getLanguageByCode(langCode) ?? defaultLang;

  const charCount = text.length;
  const charLimitExceeded = charCount > MAX_CHARS;

  const handleSpeak = React.useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed) {
      toast.warning("Пустой текст", {
        description: "Введите текст для озвучивания",
      });
      return;
    }
    if (charLimitExceeded) {
      toast.warning("Слишком длинный текст", {
        description: `Максимум ${MAX_CHARS} символов`,
      });
      return;
    }

    // ---- FreeTTS.ru engine ----
    if (engine === "freetts") {
      if (!currentLang.freettsCode) {
        toast.error("Язык не поддерживается freetts.ru", {
          description: "Выберите Web Speech или Z.ai SDK для этого языка",
        });
        return;
      }
      if (trimmed.length > 1024) {
        toast.warning("Слишком длинный текст для freetts.ru", {
          description: `Максимум 1024 символа. Сейчас: ${trimmed.length}`,
        });
        return;
      }
      try {
        setDownloading(true);
        const res = await fetch("/api/freetts/synthesize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: trimmed,
            voice: freettsVoice,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${res.status}`);
        }
        const blob = await res.blob();
        // Read which strategy actually worked
        const actualEngine = res.headers.get("X-Engine") || "freetts.ru";
        const strategy = res.headers.get("X-Strategy") || "unknown";
        const isFallback = strategy.includes("fallback");
        // Determine actual audio format: freetts returns MP3, fallbacks return WAV
        const actualExt = isFallback ? "wav" : "mp3";

        // Revoke previous URL to avoid memory leak
        if (freettsAudioUrl) URL.revokeObjectURL(freettsAudioUrl);
        const url = URL.createObjectURL(blob);
        setFreettsAudioUrl(url);
        setFreettsAudioExt(actualExt);
        // Playback is triggered by the useEffect watching freettsAudioUrl
        if (isFallback) {
          toast.warning("Использован fallback", {
            description: `freetts.ru заблокирован WAF — использован Z.ai SDK (${strategy})`,
          });
        } else {
          toast.success("Синтез завершён", {
            description: `${actualEngine} · ${freettsVoice} · ${strategy}`,
          });
        }
        addHistory({
          text: trimmed,
          langCode,
          langName: currentLang.name,
          flag: currentLang.flag,
          engine: "freetts",
          voiceName: `${actualEngine}: ${freettsVoice}`,
        });
      } catch (e) {
        toast.error("Ошибка freetts.ru", {
          description:
            e instanceof Error ? e.message : "Неизвестная ошибка",
        });
      } finally {
        setDownloading(false);
      }
      return;
    }

    // ---- Z.ai SDK engine (server-side, plays after fetch) ----
    if (engine === "z-ai") {
      if (trimmed.length > 1024) {
        toast.warning("Слишком длинный текст для Z.ai", {
          description: `Максимум 1024 символа. Сейчас: ${trimmed.length}`,
        });
        return;
      }
      try {
        setDownloading(true);
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: trimmed,
            voice: zaiVoice,
            speed: rate,
            format: "wav",
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${res.status}`);
        }
        const blob = await res.blob();
        if (freettsAudioUrl) URL.revokeObjectURL(freettsAudioUrl);
        const url = URL.createObjectURL(blob);
        setFreettsAudioUrl(url);
        setFreettsAudioExt("wav");
        // Playback is triggered by the useEffect watching freettsAudioUrl
        toast.success("Синтез завершён", {
          description: `Z.ai SDK · ${zaiVoice}`,
        });
        addHistory({
          text: trimmed,
          langCode,
          langName: currentLang.name,
          flag: currentLang.flag,
          engine: "z-ai",
          voiceName: `z-ai: ${zaiVoice}`,
        });
      } catch (e) {
        toast.error("Ошибка Z.ai SDK", {
          description:
            e instanceof Error ? e.message : "Неизвестная ошибка",
        });
      } finally {
        setDownloading(false);
      }
      return;
    }

    // ---- Piper local engine (offline, server-side) ----
    if (engine === "piper") {
      if (trimmed.length > 5000) {
        toast.warning("Слишком длинный текст для Piper", {
          description: `Максимум 5000 символов. Сейчас: ${trimmed.length}`,
        });
        return;
      }
      try {
        setDownloading(true);
        const res = await fetch("/api/piper", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: trimmed,
            voice: piperVoice,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${res.status}`);
        }
        const blob = await res.blob();
        if (freettsAudioUrl) URL.revokeObjectURL(freettsAudioUrl);
        const url = URL.createObjectURL(blob);
        setFreettsAudioUrl(url);
        setFreettsAudioExt("wav");
        const voiceName = piperVoices.find((v) => v.id === piperVoice)?.name ?? piperVoice;
        toast.success("Синтез завершён (офлайн)", {
          description: `Piper · ${voiceName} · локальный движок`,
        });
        addHistory({
          text: trimmed,
          langCode,
          langName: currentLang.name,
          flag: currentLang.flag,
          engine: "piper",
          voiceName: `piper: ${voiceName} (offline)`,
        });
      } catch (e) {
        toast.error("Ошибка Piper", {
          description:
            e instanceof Error ? e.message : "Неизвестная ошибка",
        });
      } finally {
        setDownloading(false);
      }
      return;
    }

    // ---- Web Speech API engine (default) ----
    if (!speech.supported) {
      toast.error("Не поддерживается", {
        description: "Ваш браузер не поддерживает Web Speech API",
      });
      return;
    }
    // Check if text contains SSML-like tags
    const hasSsmlTags = /<(pause|emphasis|soft|loud|whisper|slow|fast)/.test(
      trimmed,
    );
    if (hasSsmlTags) {
      const segments = parseSSML(trimmed, { rate, pitch, volume });
      speech.speakSegments(segments, {
        lang: langCode,
        voiceURI: voiceURI || undefined,
        rate,
        pitch,
        volume,
      });
      toast.info("SSML-теги обработаны", {
        description: `${segments.length} сегментов · паузы и эмфаза применены`,
      });
    } else {
      speech.speak({
        text: trimmed,
        lang: langCode,
        voiceURI: voiceURI || undefined,
        rate,
        pitch,
        volume,
      });
    }
    addHistory({
      text: trimmed,
      langCode,
      langName: currentLang.name,
      flag: currentLang.flag,
      engine: "web-speech",
      voiceName: speech.voices.find((v) => v.voiceURI === voiceURI)?.name,
    });
  }, [
    engine,
    text,
    charLimitExceeded,
    currentLang,
    freettsVoice,
    piperVoice,
    piperVoices,
    freettsAudioUrl,
    rate,
    speech,
    langCode,
    voiceURI,
    zaiVoice,
    pitch,
    volume,
    addHistory,
  ]);

  // Keep a ref to the latest handleSpeak so we can trigger it from
  // history replay after switching the engine state.
  const handleSpeakRef = React.useRef(handleSpeak);
  React.useEffect(() => {
    handleSpeakRef.current = handleSpeak;
  }, [handleSpeak]);

  const handlePause = React.useCallback(() => {
    if (engine === "web-speech") {
      speech.pause();
    } else if (freettsAudioRef.current) {
      freettsAudioRef.current.pause();
    }
  }, [engine, speech]);

  const handleResume = React.useCallback(() => {
    if (engine === "web-speech") {
      speech.resume();
    } else if (freettsAudioRef.current) {
      freettsAudioRef.current.play().catch(() => {});
    }
  }, [engine, speech]);

  const handleStop = React.useCallback(() => {
    if (engine === "web-speech") {
      speech.cancel();
    } else if (freettsAudioRef.current) {
      freettsAudioRef.current.pause();
      freettsAudioRef.current.currentTime = 0;
    }
  }, [engine, speech]);

  const handleReplayFromHistory = React.useCallback(
    (item: HistoryItem) => {
      setText(item.text);
      setLangCode(item.langCode);
      const eng = (item.engine as TTSEngine) || "web-speech";
      if (eng !== "web-speech" && engine !== eng) {
        setEngine(eng);
      }
      // Defer so language/engine state updates apply before we speak
      setTimeout(() => {
        if (eng === "web-speech") {
          // Pick a browser voice matching the item's language
          const matching = speech.voices.filter(
            (v) => v.lang === item.langCode,
          );
          const prefix = item.langCode.split("-")[0];
          const voice =
            matching[0] ??
            speech.voices.find((v) => v.lang.startsWith(prefix)) ??
            speech.voices.find((v) => v.voiceURI === voiceURI);
          speech.speak({
            text: item.text,
            lang: item.langCode,
            voiceURI: voice?.voiceURI || undefined,
            rate,
            pitch,
            volume,
          });
        } else {
          // Server engines (freetts / z-ai / piper): re-synthesize with
          // the engine that was used to record the entry. handleSpeakRef
          // points to the latest handleSpeak after the engine state update.
          handleSpeakRef.current?.();
        }
      }, 100);
    },
    [engine, speech, voiceURI, rate, pitch, volume],
  );

  const handleDownload = React.useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed) {
      toast.warning("Пустой текст", {
        description: "Введите текст для скачивания",
      });
      return;
    }
    const maxDownloadChars = engine === "piper" ? 5000 : 1024;
    if (trimmed.length > maxDownloadChars) {
      toast.warning("Слишком длинный текст для скачивания", {
        description: `Максимум ${maxDownloadChars} символов для скачивания. Сейчас: ${trimmed.length}`,
      });
      return;
    }

    // If audio is already synthesized (freetts/z-ai/piper engine), download it directly
    if (
      freettsAudioUrl &&
      (engine === "freetts" || engine === "z-ai" || engine === "piper")
    ) {
      const a = document.createElement("a");
      a.href = freettsAudioUrl;
      a.download = `voiceforge-${engine}-${Date.now()}.${resolveDownloadExtension(engine, freettsAudioExt)}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success("Аудио скачано", {
        description: `Аудио · движок: ${engine}`,
      });
      return;
    }

    // Otherwise synthesize on-the-fly via Z.ai (default download engine)
    setDownloading(true);
    try {
      const endpoint =
        engine === "freetts" && currentLang.freettsCode
          ? "/api/freetts/synthesize"
          : engine === "piper"
            ? "/api/piper"
            : "/api/tts";
      const payload =
        engine === "freetts" && currentLang.freettsCode
          ? { text: trimmed, voice: freettsVoice }
          : engine === "piper"
            ? { text: trimmed, voice: piperVoice }
            : {
                text: trimmed,
                voice: zaiVoice,
                speed: rate,
                format: "wav",
              };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      // Determine actual format from response headers (handles freetts fallback)
      const strategy = res.headers.get("X-Strategy") || "";
      const isFallback = strategy.includes("fallback");
      const downloadExt =
        engine === "freetts" && !isFallback
          ? "mp3"
          : "wav";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `voiceforge-${Date.now()}.${downloadExt}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Аудио скачано", {
        description: `Аудио · движок: ${
          engine === "freetts" ? "freetts.ru" : "Z.ai SDK"
        }`,
      });
    } catch (e) {
      toast.error("Ошибка скачивания", {
        description: e instanceof Error ? e.message : "Неизвестная ошибка",
      });
    } finally {
      setDownloading(false);
    }
  }, [
    text,
    rate,
    engine,
    currentLang,
    freettsVoice,
    piperVoice,
    zaiVoice,
    freettsAudioUrl,
    freettsAudioExt,
  ]);

  const handleInsertSample = React.useCallback(() => {
    setText(currentLang.sample);
    toast.success("Образец вставлен", {
      description: currentLang.nativeName,
    });
  }, [currentLang]);

  // ---- File drag&drop / file input ----
  const handleFileContent = React.useCallback(
    (file: File) => {
      if (!file.type.startsWith("text/") && !file.name.match(/\.(txt|md|csv|json|log)$/i)) {
        toast.error("Неподдерживаемый файл", {
          description: `Тип: ${file.type || "неизвестно"}. Поддерживаются только текстовые файлы.`,
        });
        return;
      }
      if (file.size > 100_000) {
        toast.warning("Файл слишком большой", {
          description: `Размер: ${(file.size / 1024).toFixed(1)} КБ. Максимум 100 КБ.`,
        });
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const content = String(reader.result || "");
        setText(content.slice(0, MAX_CHARS));
        toast.success("Файл загружен", {
          description: `${file.name} · ${content.length} символов`,
        });
      };
      reader.onerror = () => {
        toast.error("Ошибка чтения файла");
      };
      reader.readAsText(file);
    },
    [],
  );

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const handleDrop = React.useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files?.[0];
      if (file) handleFileContent(file);
    },
    [handleFileContent],
  );

  const [isDragging, setIsDragging] = React.useState(false);

  // ---- Keyboard shortcuts ----
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip if focus is in input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        if (engine === "web-speech" && speech.speaking) {
          if (speech.paused) handleResume();
          else handlePause();
        } else {
          handleSpeak();
        }
      } else if (e.key === "Escape") {
        handleStop();
      } else if (e.key === "s" && e.shiftKey) {
        e.preventDefault();
        handleDownload();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    engine,
    speech.speaking,
    speech.paused,
    handleSpeak,
    handlePause,
    handleResume,
    handleStop,
    handleDownload,
  ]);

  return (
    <div
      className="relative flex min-h-screen flex-col"
      onDrop={handleDrop}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={(e) => {
        // Only reset if we leave the main container
        if (e.currentTarget === e.target) setIsDragging(false);
      }}
    >
      {/* Drag&drop overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary/10 backdrop-blur-sm pointer-events-none">
          <div className="rounded-2xl border-2 border-dashed border-primary bg-card/95 p-8 text-center shadow-2xl">
            <AudioLines className="mx-auto h-10 w-10 text-primary animate-pulse" />
            <p className="mt-3 text-lg font-semibold">
              Отпустите файл для загрузки
            </p>
            <p className="text-sm text-muted-foreground">
              Поддерживаются .txt, .md, .csv, .json
            </p>
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.md,.csv,.json,.log,text/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileContent(file);
          e.target.value = ""; // reset
        }}
      />

      {/* Background */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-grid" />
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[600px] overflow-hidden">
        <div className="absolute left-1/2 top-[-200px] h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]" />
      </div>

      <SonnerToaster richColors position="top-center" />

      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl brand-gradient glow-primary">
              <AudioLines className="h-5 w-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-bold tracking-tight">
                VoiceForge
              </span>
              <span className="text-[11px] text-muted-foreground">
                TTS · 15 языков
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="secondary"
              className="hidden sm:inline-flex h-7 gap-1.5"
            >
<Sparkles className="h-3 w-3" />
                v2.2
            </Badge>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto w-full max-w-7xl px-4 pt-12 pb-6 text-center sm:px-6 sm:pt-16">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Badge
            variant="outline"
            className="mb-4 inline-flex h-7 gap-1.5 border-primary/30 bg-primary/5 text-primary"
          >
            <Sparkles className="h-3 w-3" />
            Бесплатно · Без регистрации
          </Badge>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl">
            <span className="brand-gradient-text">
              Озвучивание текста
            </span>
            <br className="hidden sm:block" /> на 15 языках
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
            Бесплатный онлайн-сервис для синтеза речи. Поддержка русского,
            английского, китайского и других языков с настраиваемыми голосами,
            скоростью и тоном.
          </p>
        </motion.div>
      </section>

      {/* Main app */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-12 sm:px-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left: text editor + controls */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }}
            className="lg:col-span-2"
          >
            <Card className="overflow-hidden border-border/60 bg-card/80 backdrop-blur-sm">
              <CardContent className="p-5 sm:p-6">
                {/* Language selector */}
                <div className="mb-5 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">
                      1. Выберите язык
                    </Label>
                    <span className="text-xs text-muted-foreground">
                      {LANGUAGES.length} языков
                    </span>
                  </div>
                  <LanguageSelector value={langCode} onChange={setLangCode} />
                </div>

                {/* Textarea */}
                <div className="mb-5 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">
                      2. Введите текст
                    </Label>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        className="h-7 text-xs"
                        title="Загрузить текст из файла"
                      >
                        <Upload className="mr-1 h-3 w-3" />
                        Файл
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleInsertSample}
                        className="h-7 text-xs"
                      >
                        <Wand2 className="mr-1 h-3 w-3" />
                        Образец
                      </Button>
                    </div>
                  </div>
                  <Textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={`Введите текст на ${currentLang.nativeName}...`}
                    className="min-h-[160px] resize-y text-base leading-relaxed"
                    maxLength={MAX_CHARS + 100}
                  />
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      Текущий язык:{" "}
                      <span className="font-medium text-foreground">
                        {currentLang.flag} {currentLang.nativeName}
                      </span>
                    </span>
                    <span
                      className={
                        charLimitExceeded
                          ? "font-medium text-destructive"
                          : "text-muted-foreground"
                      }
                    >
                      {charCount} / {MAX_CHARS}
                    </span>
                  </div>

                  {/* SSML helper — only for Web Speech engine */}
                  {engine === "web-speech" && (
                    <SsmlHelper
                      className="mt-2"
                      onInsertTag={(tag) => {
                        // Insert tag at cursor position
                        const textarea = document.querySelector(
                          "textarea",
                        ) as HTMLTextAreaElement | null;
                        if (textarea) {
                          const start = textarea.selectionStart;
                          const end = textarea.selectionEnd;
                          const newText =
                            text.slice(0, start) + tag + text.slice(end);
                          setText(newText);
                          // Restore cursor after tag
                          setTimeout(() => {
                            textarea.focus();
                            textarea.selectionStart = textarea.selectionEnd =
                              start + tag.length;
                          }, 0);
                        } else {
                          setText(text + " " + tag);
                        }
                        toast.success("Тег вставлен", {
                          description: tag,
                        });
                      }}
                    />
                  )}
                </div>

                {/* Engine selector */}
                <div className="mb-5 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">
                      3. Движок синтеза
                    </Label>
                    <EngineBadge engine={engine} />
                  </div>
                  <EngineSelector value={engine} onChange={setEngine} />
                </div>

                {/* Voice + params — engine-specific */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">
                      4. Голос
                    </Label>
                    {engine === "freetts" ? (
                      <FreettsVoicePicker
                        freettsLangCode={currentLang.freettsCode}
                        value={freettsVoice}
                        onChange={setFreettsVoice}
                      />
                    ) : engine === "z-ai" ? (
                      <div className="space-y-2">
                        <Select
                          value={zaiVoice}
                          onValueChange={(v) => setZaiVoice(v as ZaiVoice)}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Выберите голос" />
                          </SelectTrigger>
                          <SelectContent className="max-h-72">
                            {ZAI_VOICES.map((v) => (
                              <SelectItem key={v.id} value={v.id}>
                                <span className="flex items-center gap-2">
                                  <span className="font-medium capitalize">
                                    {v.name}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {v.description}
                                  </span>
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          {ZAI_VOICES.find((v) => v.id === zaiVoice)
                            ?.description ?? "Стандартный голос Z.ai SDK"}
                          . Всего доступно {ZAI_VOICES.length} голосов.
                        </p>
                      </div>
                    ) : engine === "piper" ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <HardDriveDownload className="h-4 w-4 text-blue-500" />
                          <Badge variant="secondary" className="h-5 text-[10px]">
                            OFFLINE
                          </Badge>
                          {piperVoices.length > 0 ? (
                            <Select value={piperVoice} onValueChange={setPiperVoice}>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Выберите голос" />
                              </SelectTrigger>
                              <SelectContent className="max-h-72">
                                {piperVoices.map((v) => (
                                  <SelectItem key={v.id} value={v.id}>
                                    <span className="flex items-center gap-2">
                                      {v.gender === "m" ? (
                                        <UserRound className="h-4 w-4 text-blue-500" />
                                      ) : (
                                        <User className="h-4 w-4 text-pink-500" />
                                      )}
                                      <span className="font-medium capitalize">{v.name}</span>
                                      <span className="text-xs text-muted-foreground">({v.lang})</span>
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <div className="flex items-center gap-2">
                              <p className="text-xs text-muted-foreground">
                                {piperVoicesLoading
                                  ? "Загрузка списка голосов..."
                                  : "Mini-service не запущен или недоступен."}
                              </p>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() =>
                                  setPiperReloadKey((k) => k + 1)
                                }
                                disabled={piperVoicesLoading}
                                title="Повторить попытку подключения к piper-local"
                              >
                                <RotateCcw className="mr-1 h-3 w-3" />
                                Повторить
                              </Button>
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Локальный нейросетевой синтез (Piper TTS). Работает без
                          интернета. {piperVoices.length > 0 && `${piperVoices.length} голосов доступно.`}
                        </p>
                      </div>
                    ) : (
                      <>
                        <VoiceSelector
                          voices={speech.voices}
                          value={voiceURI}
                          onChange={setVoiceURI}
                          langCode={langCode}
                        />
                        {!speech.supported && (
                          <p className="text-xs text-destructive">
                            Браузер не поддерживает Web Speech API
                          </p>
                        )}
                      </>
                    )}
                  </div>
                  <div className="space-y-3">
                    <ParamSlider
                      icon={<Gauge className="h-4 w-4" />}
                      label="Скорость"
                      value={rate}
                      min={0.5}
                      max={2}
                      step={0.1}
                      onChange={setRate}
                      format={(v) => `${v.toFixed(1)}×`}
                    />
                    {engine === "web-speech" && (
                      <ParamSlider
                        icon={<Music2 className="h-4 w-4" />}
                        label="Тон"
                        value={pitch}
                        min={0}
                        max={2}
                        step={0.1}
                        onChange={setPitch}
                        format={(v) => v.toFixed(1)}
                      />
                    )}
                    {engine === "web-speech" && (
                      <ParamSlider
                        icon={<Volume2 className="h-4 w-4" />}
                        label="Громкость"
                        value={volume}
                        min={0}
                        max={1}
                        step={0.05}
                        onChange={setVolume}
                        format={(v) => `${Math.round(v * 100)}%`}
                      />
                    )}
                    {engine !== "web-speech" && (
                      <div className="rounded-md border border-dashed border-border bg-muted/20 p-3 text-xs text-muted-foreground">
                        <p className="font-medium text-foreground mb-1">
                          Параметры движка
                        </p>
                        {engine === "freetts" ? (
                          <p>
                            freetts.ru использует нейросетевые голоса
                            фиксированного тона. Регулировка скорости
                            применяется при воспроизведении.
                          </p>
                        ) : engine === "piper" ? (
                          <p>
                            Piper TTS генерирует аудио с фиксированными
                            параметрами модели. Регулировка скорости
                            применяется при воспроизведении через плеер.
                          </p>
                        ) : (
                          <p>
                            Z.ai SDK поддерживает только скорость (0.5–2.0×).
                            Тон и громкость не регулируются.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Voice presets — only for Web Speech */}
                {engine === "web-speech" && (
                  <div className="mt-4">
                    <PresetSelector
                      currentRate={rate}
                      currentPitch={pitch}
                      currentVolume={volume}
                      onApply={(p: PresetConfig) => {
                        setRate(p.rate);
                        setPitch(p.pitch);
                        setVolume(p.volume);
                        toast.success(`Пресет: ${p.label}`, {
                          description: p.description,
                        });
                      }}
                    />
                  </div>
                )}

                {/* Audio player for freetts/z-ai playback */}
                {freettsAudioUrl && engine !== "web-speech" && (
                  <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <Mic className="h-3.5 w-3.5" />
                        {freettsPlaying ? "Воспроизведение..." : "Аудио готово"}
                      </span>
<span className="text-[11px] text-muted-foreground">
                          Движок:{" "}
                          <span className="font-medium text-foreground">
                            {engine === "freetts"
                              ? "freetts.ru"
                              : engine === "piper"
                                ? "Piper (офлайн)"
                                : "Z.ai SDK"}
                          </span>
                        </span>
                    </div>
                    <audio
                      ref={freettsAudioRef}
                      src={freettsAudioUrl}
                      controls
                      className="w-full"
                      style={{ height: "36px" }}
                      onPlay={() => setFreettsPlaying(true)}
                      onPause={() => setFreettsPlaying(false)}
                      onEnded={() => setFreettsPlaying(false)}
                      onTimeUpdate={(e) => {
                        const el = e.currentTarget;
                        setAudioCurrentTime(el.currentTime);
                        if (el.duration && !isNaN(el.duration)) {
                          setAudioDuration(el.duration);
                        }
                      }}
                      onLoadedMetadata={(e) => {
                        const d = e.currentTarget.duration;
                        if (d && !isNaN(d)) setAudioDuration(d);
                      }}
                    />
                    {/* Custom progress bar synced to playback */}
                    {audioDuration > 0 && (
                      <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="tabular-nums">
                          {formatTime(audioCurrentTime)}
                        </span>
                        <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className="absolute inset-y-0 left-0 brand-gradient transition-[width] duration-150"
                            style={{
                              width: `${(audioCurrentTime / audioDuration) * 100}%`,
                            }}
                          />
                        </div>
                        <span className="tabular-nums">
                          {formatTime(audioDuration)}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Action buttons */}
                <div className="mt-6 flex flex-wrap items-center gap-2">
                  {engine === "web-speech" ? (
                    <>
                      {!speech.speaking ? (
                        <Button
                          size="lg"
                          onClick={handleSpeak}
                          disabled={!speech.supported || charLimitExceeded}
                          className="brand-gradient glow-primary hover:opacity-90"
                        >
                          <Play className="mr-2 h-4 w-4" />
                          Озвучить
                        </Button>
                      ) : speech.paused ? (
                        <Button
                          size="lg"
                          onClick={handleResume}
                          className="brand-gradient glow-primary hover:opacity-90"
                        >
                          <Play className="mr-2 h-4 w-4" />
                          Продолжить
                        </Button>
                      ) : (
                        <Button
                          size="lg"
                          onClick={handlePause}
                          className="brand-gradient glow-primary hover:opacity-90"
                        >
                          <Pause className="mr-2 h-4 w-4" />
                          Пауза
                        </Button>
                      )}
                      <Button
                        size="lg"
                        variant="outline"
                        onClick={handleStop}
                        disabled={!speech.speaking}
                      >
                        <Square className="mr-2 h-4 w-4" />
                        Стоп
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="lg"
                      onClick={handleSpeak}
                      disabled={downloading || charLimitExceeded || !text.trim()}
                      className="brand-gradient glow-primary hover:opacity-90"
                    >
                      {downloading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="mr-2 h-4 w-4" />
                      )}
                      {downloading
                        ? "Синтез..."
                        : engine === "freetts"
                          ? "Синтезировать через freetts.ru"
                          : engine === "piper"
                            ? "Синтезировать локально (Piper)"
                            : "Синтезировать через Z.ai"}
                    </Button>
                  )}
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={handleDownload}
                    disabled={
                      downloading ||
                      !text.trim() ||
                      (engine !== "web-speech" && engine !== "piper" && text.trim().length > 1024) ||
                      (engine === "web-speech" && text.trim().length > 1024)
                    }
                  >
                    {downloading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    Скачать аудио
                  </Button>
                  <Button
                    size="lg"
                    variant="ghost"
                    onClick={() => {
                      setRate(1);
                      setPitch(1);
                      setVolume(1);
                    }}
                    className="ml-auto"
                    aria-label="Сбросить параметры"
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Сброс
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => setCompareOpen(true)}
                    disabled={
                      !text.trim() || text.trim().length > 1024
                    }
                    title="Озвучить один текст тремя движками и сравнить"
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    Сравнить движки
                  </Button>
                </div>

                {/* Status line with waveform */}
                <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
                  {engine === "web-speech" ? (
                    speech.speaking && !speech.paused ? (
                      <>
                        <span className="flex h-2 w-2 animate-pulse rounded-full bg-primary" />
                        <span>Воспроизведение...</span>
                        <AudioWaveform active={true} height={20} bars={20} />
                      </>
                    ) : speech.paused ? (
                      <>
                        <Pause className="h-3 w-3" />
                        <span>Пауза</span>
                        <AudioWaveform active={false} height={20} bars={20} />
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-3 w-3" />
                        <span>Готово к воспроизведению</span>
                      </>
                    )
                  ) : downloading ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>Синтезируем аудио на сервере...</span>
                    </>
                  ) : freettsAudioUrl ? (
                    <>
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                      <span>Аудио готово</span>
                      <AudioWaveform
                        active={freettsPlaying}
                        height={20}
                        bars={20}
                      />
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-3 w-3" />
                      <span>Готово к синтезу</span>
                    </>
                  )}
                  {speech.voices.length > 0 && engine === "web-speech" && (
                    <>
                      <span aria-hidden>·</span>
                      <span>{speech.voices.length} голосов браузера</span>
                    </>
                  )}
                </div>

                {/* Text statistics */}
                <div className="mt-3 border-t border-border/60 pt-3">
                  <TextStats text={text} rate={rate} />
                </div>

                {/* Long text warning for download */}
                {text.trim().length > 1024 && (
                  <div className="mt-3 flex items-start gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/5 p-3 text-xs text-yellow-700 dark:text-yellow-400">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      Для скачивания аудио текст не должен превышать 1024 символа
                      (сейчас {text.trim().length}). Воспроизведение в браузере
                      работает с длинным текстом.
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            <CompareEnginesDialog
              open={compareOpen}
              onOpenChange={setCompareOpen}
              text={text}
              langCode={langCode}
              voiceURI={voiceURI}
              freettsVoice={freettsVoice}
              freettsLangCode={currentLang.freettsCode}
              zaiVoice={zaiVoice}
              piperVoice={piperVoice}
              rate={rate}
              pitch={pitch}
              volume={volume}
            />
          </motion.div>

          {/* Right: info + history */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="space-y-6"
          >
            {/* Quick info */}
            <Card className="border-border/60 bg-card/80 backdrop-blur-sm">
              <CardContent className="p-5">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Возможности
                </h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>
                      <span className="font-medium text-foreground">4 движка TTS</span>{" "}
                      — Web Speech, freetts.ru, Z.ai SDK, Piper (офлайн)
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>
                      <span className="font-medium text-foreground">298 нейроголосов</span>{" "}
                      freetts.ru на 57 языках
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>
                      <span className="font-medium text-foreground">15 языков</span>{" "}
                      в основном интерфейсе
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>
                      <span className="font-medium text-foreground">Скачивание аудио</span>{" "}
                      через любой движок
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>
                      <span className="font-medium text-foreground">История</span>{" "}
                      последних 20 озвучиваний
                    </span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* History */}
            <Card className="border-border/60 bg-card/80 backdrop-blur-sm">
              <CardContent className="p-5">
                <HistoryPanel
                  items={history}
                  onReplay={handleReplayFromHistory}
                  onRemove={removeHistory}
                  onClear={clearHistory}
                />
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Stats / bottom section */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4"
        >
          <StatCard value="298" label="Голосов" hint="freetts.ru" />
          <StatCard value="57" label="Языков" hint="freetts.ru" />
          <StatCard value="15" label="Языков" hint="в интерфейсе" />
          <StatCard value="4" label="Движка" hint="Web Speech · freetts · Z.ai · Piper" />
        </motion.section>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-border/60 bg-background/80 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-6 text-sm text-muted-foreground sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md brand-gradient">
                <AudioLines className="h-3 w-3 text-white" />
              </div>
              <span>VoiceForge — TTS на 15 языках</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono">
                  Space
                </kbd>
                <span className="text-[11px]">озвучить</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono">
                  Esc
                </kbd>
                <span className="text-[11px]">стоп</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono">
                  ⇧S
                </kbd>
                <span className="text-[11px]">скачать</span>
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span>Web Speech · freetts.ru · Z.ai SDK · Piper</span>
              <span className="hidden sm:inline">·</span>
              <span className="hidden sm:inline">Next.js 16 · TypeScript</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ---------- Helper components ---------- */

interface ParamSliderProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
}

function ParamSlider({
  icon,
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: ParamSliderProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          {icon}
          {label}
        </Label>
        <span className="text-xs font-medium text-foreground">
          {format(value)}
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(v[0])}
        className="[&_[role=slider]]:bg-primary"
      />
    </div>
  );
}

function StatCard({
  value,
  label,
  hint,
}: {
  value: string;
  label: string;
  hint?: string;
}) {
  return (
    <Card className="border-border/60 bg-card/80 backdrop-blur-sm">
      <CardContent className="p-4 text-center sm:p-5">
        <div className="text-2xl font-bold brand-gradient-text sm:text-3xl">
          {value}
        </div>
        <div className="mt-1 text-xs font-medium text-foreground sm:text-sm">
          {label}
        </div>
        {hint && (
          <div className="text-[11px] text-muted-foreground">{hint}</div>
        )}
      </CardContent>
    </Card>
  );
}
