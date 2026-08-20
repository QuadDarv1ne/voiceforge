"use client";

import * as React from "react";
import { AudioLines, Download, Loader2, Play, Square } from "lucide-react";
import { useZaiTts, ZAI_VOICES, type ZaiVoice } from "@/hooks/use-zai-tts";
import { formatBytes, formatDuration, estimateDurationSeconds } from "@/lib/audio-utils";

interface ZaiTtsPlayerProps {
  /** Initial text (optional) */
  initialText?: string;
  /** Initial voice (optional) */
  initialVoice?: ZaiVoice;
  /** Initial speed (optional, 0.5-2.0) */
  initialSpeed?: number;
  /** CSS class for the root element */
  className?: string;
  /** Called when audio is successfully generated */
  onAudioGenerated?: (blob: Blob, url: string) => void;
}

/**
 * Minimal TTS player component for Z.ai SDK integration.
 *
 * Features:
 * - Text input
 * - Voice selector (7 voices)
 * - Speed slider (0.5x - 2.0x)
 * - Synthesize button with loading state
 * - Audio player with download
 * - Error display
 *
 * @example
 * <ZaiTtsPlayer initialText="Привет, мир!" />
 */
export function ZaiTtsPlayer({
  initialText = "",
  initialVoice = "tongtong",
  initialSpeed = 1.0,
  className = "",
  onAudioGenerated,
}: ZaiTtsPlayerProps) {
  const [text, setText] = React.useState(initialText);
  const [voice, setVoice] = React.useState<ZaiVoice>(initialVoice);
  const [speed, setSpeed] = React.useState(initialSpeed);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  const tts = useZaiTts({
    onSuccess: (blob, url) => {
      onAudioGenerated?.(blob, url);
      // Auto-play after synthesis
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.src = url;
          audioRef.current.play().catch(() => {});
        }
      }, 100);
    },
  });

  const handleSynthesize = React.useCallback(() => {
    if (!text.trim() || tts.loading) return;
    tts.synthesize({ text, voice, speed, format: "wav" });
  }, [text, voice, speed, tts]);

  const handlePlayPause = React.useCallback(() => {
    if (!audioRef.current || !tts.audioUrl) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(() => {});
    }
  }, [isPlaying, tts.audioUrl]);

  const handleDownload = React.useCallback(() => {
    if (!tts.audioUrl) return;
    tts.download(`zai-tts-${voice}-${Date.now()}.wav`);
  }, [tts, voice]);

  const charCount = text.length;
  const charLimit = 1024;
  const isOverLimit = charCount > charLimit;

  const estimatedDuration = React.useMemo(() => {
    if (!tts.audioBlob) return null;
    const seconds = estimateDurationSeconds(tts.audioBlob.size);
    return seconds > 0 ? formatDuration(seconds) : null;
  }, [tts.audioBlob]);

  return (
    <div className={`zai-tts-player ${className}`}>
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
      />

      {/* Text input */}
      <div className="mb-4">
        <label
          htmlFor="zai-tts-text"
          className="mb-2 block text-sm font-medium"
        >
          Текст для озвучивания
        </label>
        <textarea
          id="zai-tts-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Введите текст..."
          className="min-h-[100px] w-full resize-y rounded-md border border-gray-300 p-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900"
          maxLength={1100}
        />
        <div className="mt-1 flex justify-between text-xs text-gray-500">
          <span>Максимум: 1024 символа</span>
          <span className={isOverLimit ? "text-red-500 font-medium" : ""}>
            {charCount} / {charLimit}
          </span>
        </div>
      </div>

      {/* Voice selector */}
      <div className="mb-4">
        <label
          htmlFor="zai-tts-voice"
          className="mb-2 block text-sm font-medium"
        >
          Голос
        </label>
        <select
          id="zai-tts-voice"
          value={voice}
          onChange={(e) => setVoice(e.target.value as ZaiVoice)}
          className="w-full rounded-md border border-gray-300 p-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900"
        >
          {ZAI_VOICES.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name} — {v.description}
            </option>
          ))}
        </select>
      </div>

      {/* Speed slider */}
      <div className="mb-4">
        <label
          htmlFor="zai-tts-speed"
          className="mb-2 block text-sm font-medium"
        >
          Скорость: <span className="font-mono">{speed.toFixed(1)}×</span>
        </label>
        <input
          id="zai-tts-speed"
          type="range"
          min="0.5"
          max="2.0"
          step="0.1"
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-gray-500">
          <span>0.5× (медленно)</span>
          <span>1.0×</span>
          <span>2.0× (быстро)</span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleSynthesize}
          disabled={tts.loading || !text.trim() || isOverLimit}
          className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {tts.loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Синтез...
            </>
          ) : (
            <>
              <AudioLines className="h-4 w-4" />
              Озвучить
            </>
          )}
        </button>

        {tts.audioUrl && (
          <>
            <button
              type="button"
              onClick={handlePlayPause}
              className="flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              {isPlaying ? (
                <>
                  <Square className="h-4 w-4" />
                  Стоп
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Играть
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              <Download className="h-4 w-4" />
              Скачать WAV
            </button>
          </>
        )}
      </div>

      {/* Audio player (if generated) */}
      {tts.audioUrl && (
        <div className="mb-4 rounded-md border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-900">
          <audio
            src={tts.audioUrl}
            controls
            className="w-full"
            style={{ height: "36px" }}
          />
          {tts.audioBlob && (
            <div className="mt-2 flex justify-between text-xs text-gray-500">
              <span>Размер: {formatBytes(tts.audioBlob.size)}</span>
              {estimatedDuration && (
                <span>Длительность: ~{estimatedDuration}</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Error display */}
      {tts.error && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
          <strong>Ошибка:</strong> {tts.error}
        </div>
      )}
    </div>
  );
}
