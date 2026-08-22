"use client";

import * as React from "react";

/**
 * Available Z.ai TTS voices.
 *
 * Each voice has a unique character — see the descriptions
 * to choose the right one for your use case.
 */
export const ZAI_VOICES = [
  {
    id: "tongtong",
    name: "TongTong",
    description: "Тёплый, дружелюбный (по умолчанию)",
    gender: "neutral",
    language: "multi",
  },
  {
    id: "chuichui",
    name: "ChuiChui",
    description: "Живой, энергичный",
    gender: "neutral",
    language: "multi",
  },
  {
    id: "xiaochen",
    name: "XiaoChen",
    description: "Спокойный, профессиональный",
    gender: "neutral",
    language: "multi",
  },
  {
    id: "jam",
    name: "Jam",
    description: "Английский акцент",
    gender: "neutral",
    language: "en",
  },
  {
    id: "kazi",
    name: "Kazi",
    description: "Чёткий, стандартный",
    gender: "neutral",
    language: "multi",
  },
  {
    id: "douji",
    name: "DouJi",
    description: "Естественный, плавный",
    gender: "neutral",
    language: "multi",
  },
  {
    id: "luodo",
    name: "LuoDo",
    description: "Эмоциональный, выразительный",
    gender: "neutral",
    language: "multi",
  },
] as const;

export type ZaiVoice = (typeof ZAI_VOICES)[number]["id"];

interface UseZaiTtsOptions {
  /** Called when synthesis starts */
  onStart?: () => void;
  /** Called when synthesis completes successfully */
  onSuccess?: (audioBlob: Blob, audioUrl: string) => void;
  /** Called on synthesis error */
  onError?: (error: string) => void;
  /** Called when synthesis finishes (success or error) */
  onFinally?: () => void;
}

interface UseZaiTtsReturn {
  /** Whether synthesis is in progress */
  loading: boolean;
  /** Last generated audio Blob (null if none or error) */
  audioBlob: Blob | null;
  /** Object URL for the last audio Blob (auto-revoked on new synthesis) */
  audioUrl: string | null;
  /** Last error message (null if no error) */
  error: string | null;
  /** Synthesize text and return audio Blob */
  synthesize: (params: {
    text: string;
    voice?: ZaiVoice;
    speed?: number;
    format?: "wav" | "pcm";
  }) => Promise<Blob | null>;
  /** Download the last synthesized audio */
  download: (filename?: string) => void;
  /** Revoke current audio URL and clear state */
  clear: () => void;
}

/**
 * React hook for Z.ai Text-to-Speech synthesis.
 *
 * Provides a clean API for synthesizing speech from text using
 * the /api/tts endpoint. Handles audio Blob creation, object URL
 * lifecycle, and error handling.
 *
 * @example
 * const tts = useZaiTts({
 *   onSuccess: (blob, url) => {
 *     const audio = new Audio(url);
 *     audio.play();
 *   }
 * });
 *
 * // Synthesize and play
 * await tts.synthesize({
 *   text: "Привет, мир!",
 *   voice: "tongtong",
 *   speed: 1.0,
 *   format: "wav"
 * });
 *
 * // Download last audio
 * tts.download("my-audio.wav");
 */
export function useZaiTts(options: UseZaiTtsOptions = {}): UseZaiTtsReturn {
  const { onStart, onSuccess, onError, onFinally } = options;
  const callbacksRef = React.useRef({ onStart, onSuccess, onError, onFinally });

  React.useEffect(() => {
    callbacksRef.current = { onStart, onSuccess, onError, onFinally };
  }, [onStart, onSuccess, onError, onFinally]);

  const [loading, setLoading] = React.useState(false);
  const [audioBlob, setAudioBlob] = React.useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // Track current URL in a ref so the unmount cleanup can revoke it
  // without calling setState (which triggers a React warning).
  const audioUrlRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    audioUrlRef.current = audioUrl;
  }, [audioUrl]);

  const synthesize = React.useCallback(
    async (params: {
      text: string;
      voice?: ZaiVoice;
      speed?: number;
      format?: "wav" | "pcm";
    }): Promise<Blob | null> => {
      const { text, voice = "tongtong", speed = 1.0, format = "wav" } = params;

      if (!text.trim()) {
        const err = "Text is required";
        setError(err);
        callbacksRef.current.onError?.(err);
        return null;
      }

      if (text.length > 1024) {
        const err = `Text too long (${text.length} > 1024 chars)`;
        setError(err);
        callbacksRef.current.onError?.(err);
        return null;
      }

      setLoading(true);
      setError(null);
      callbacksRef.current.onStart?.();

      try {
        const response = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: text.trim(), voice, speed, format }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(
            errData.error || `HTTP ${response.status}: ${response.statusText}`,
          );
        }

        const blob = await response.blob();

        // Revoke previous URL to prevent memory leak
        setAudioUrl((prevUrl) => {
          if (prevUrl) URL.revokeObjectURL(prevUrl);
          return null;
        });

        const url = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioUrl(url);
        callbacksRef.current.onSuccess?.(blob, url);

        return blob;
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        setError(errorMessage);
        callbacksRef.current.onError?.(errorMessage);
        return null;
      } finally {
        setLoading(false);
        callbacksRef.current.onFinally?.();
      }
    },
    [],
  );

  const download = React.useCallback(
    (filename?: string) => {
      if (!audioUrl) return;
      const a = document.createElement("a");
      a.href = audioUrl;
      a.download = filename || `tts-${Date.now()}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    },
    [audioUrl],
  );

  const clear = React.useCallback(() => {
    setAudioUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setAudioBlob(null);
    setError(null);
  }, []);

  // Cleanup on unmount — revoke the object URL without calling setState
  React.useEffect(() => {
    return () => {
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    };
  }, []);

  return {
    loading,
    audioBlob,
    audioUrl,
    error,
    synthesize,
    download,
    clear,
  };
}
