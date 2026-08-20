"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface SpeechSynthesisVoiceInfo {
  name: string;
  lang: string;
  default: boolean;
  localService: boolean;
  voiceURI: string;
}

export interface UseSpeechSynthesisOptions {
  /** Called when playback starts */
  onStart?: () => void;
  /** Called when playback ends */
  onEnd?: () => void;
  /** Called on playback error */
  onError?: (error: SpeechSynthesisErrorEvent) => void;
  /** Called on pause */
  onPause?: () => void;
  /** Called on resume */
  onResume?: () => void;
}

export interface SpeakParams {
  /** Text to speak */
  text: string;
  /** BCP 47 language tag, e.g. "ru-RU" */
  lang?: string;
  /** Voice URI from the available voices list */
  voiceURI?: string;
  /** Speech rate, 0.1 to 10 (default 1) */
  rate?: number;
  /** Speech pitch, 0 to 2 (default 1) */
  pitch?: number;
  /** Speech volume, 0 to 1 (default 1) */
  volume?: number;
}

export interface UseSpeechSynthesisReturn {
  /** Whether the browser supports the Web Speech API */
  supported: boolean;
  /** List of voices available in the browser */
  voices: SpeechSynthesisVoiceInfo[];
  /** Whether speech is currently being spoken */
  speaking: boolean;
  /** Whether speech is currently paused */
  paused: boolean;
  /** Start speaking */
  speak: (params: SpeakParams) => void;
  /** Speak multiple SSML segments sequentially */
  speakSegments: (
    segments: import("@/lib/ssml").SpeechSegment[],
    baseParams: Omit<SpeakParams, "text">,
  ) => void;
  /** Pause playback */
  pause: () => void;
  /** Resume playback */
  resume: () => void;
  /** Stop and clear the queue */
  cancel: () => void;
}

/**
 * React hook around the browser SpeechSynthesis API.
 *
 * The Web Speech API is natively available in all modern browsers
 * and supports a wide range of languages including Russian, English,
 * Chinese, Spanish, French, German, Japanese, Korean, Arabic, etc.
 */
export function useSpeechSynthesis(
  options: UseSpeechSynthesisOptions = {},
): UseSpeechSynthesisReturn {
  const { onStart, onEnd, onError, onPause, onResume } = options;
  const callbacksRef = useRef({ onStart, onEnd, onError, onPause, onResume });

  // Keep callbacks ref up to date without re-subscribing listeners
  useEffect(() => {
    callbacksRef.current = { onStart, onEnd, onError, onPause, onResume };
  }, [onStart, onEnd, onError, onPause, onResume]);

  // Hydration-safe: starts as false on both server and client.
  // The real value is set in a useEffect after hydration to avoid
  // server/client HTML mismatches (e.g. "Web Speech not supported" banner).
  const [supported, setSupported] = useState<boolean>(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoiceInfo[]>([]);
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const supportedNow =
      typeof window !== "undefined" && "speechSynthesis" in window;
    // Set after hydration so server and client HTML render identically
    if (!supportedNow) return;
    setSupported(true);

    const synth = window.speechSynthesis;

    const updateVoices = () => {
      const list = synth.getVoices();
      setVoices(
        list.map((v) => ({
          name: v.name,
          lang: v.lang,
          default: v.default,
          localService: v.localService,
          voiceURI: v.voiceURI,
        })),
      );
    };

    updateVoices();
    // Some browsers populate voices asynchronously
    synth.addEventListener("voiceschanged", updateVoices);

    const handleStart = () => {
      setSpeaking(true);
      setPaused(false);
      callbacksRef.current.onStart?.();
    };
    const handleEnd = () => {
      setSpeaking(false);
      setPaused(false);
      callbacksRef.current.onEnd?.();
    };
    const handlePause = () => {
      setPaused(true);
      callbacksRef.current.onPause?.();
    };
    const handleResume = () => {
      setPaused(false);
      callbacksRef.current.onResume?.();
    };
    // "error" is not in lib.dom overloads for SpeechSynthesis —
    // attach it as a plain EventListener and cast the event inside.
    const handleError = (e: Event) => {
      setSpeaking(false);
      setPaused(false);
      callbacksRef.current.onError?.(e as SpeechSynthesisErrorEvent);
    };
    synth.addEventListener("error", handleError as EventListener);

    synth.addEventListener("start", handleStart);
    synth.addEventListener("end", handleEnd);
    synth.addEventListener("pause", handlePause);
    synth.addEventListener("resume", handleResume);

    return () => {
      synth.removeEventListener("voiceschanged", updateVoices);
      synth.removeEventListener("start", handleStart);
      synth.removeEventListener("end", handleEnd);
      synth.removeEventListener("pause", handlePause);
      synth.removeEventListener("resume", handleResume);
      synth.removeEventListener("error", handleError);
      synth.cancel();
    };
  }, []);

  const speak = useCallback(
    (params: SpeakParams) => {
      if (!supported) return;
      const synth = window.speechSynthesis;
      // Clear any pending speech
      synth.cancel();

      const utterance = new SpeechSynthesisUtterance(params.text);
      if (params.lang) utterance.lang = params.lang;
      if (params.voiceURI) {
        const voice = synth
          .getVoices()
          .find((v) => v.voiceURI === params.voiceURI);
        if (voice) utterance.voice = voice;
      }
      if (params.rate !== undefined) utterance.rate = params.rate;
      if (params.pitch !== undefined) utterance.pitch = params.pitch;
      if (params.volume !== undefined) utterance.volume = params.volume;

      synth.speak(utterance);
    },
    [supported],
  );

  /**
   * Speak multiple segments sequentially with pauses between them.
   * Each segment can have its own pitch/rate/volume multipliers
   * (used for SSML-like tags: <emphasis>, <soft>, etc.).
   */
  const speakSegments = useCallback(
    (
      segments: import("@/lib/ssml").SpeechSegment[],
      baseParams: {
        lang?: string;
        voiceURI?: string;
        rate?: number;
        pitch?: number;
        volume?: number;
      },
    ) => {
      if (!supported || segments.length === 0) return;
      const synth = window.speechSynthesis;
      synth.cancel();

      let chainStarted = false;
      for (const seg of segments) {
        // Insert pause via setTimeout if needed
        if (seg.pauseBeforeMs && seg.pauseBeforeMs > 0 && chainStarted) {
          // Use a silent utterance as a pause — setTimeout doesn't work
          // reliably with speech synthesis queue
          // Instead we use a tiny utterance with volume 0
          const pauseUtterance = new SpeechSynthesisUtterance(" ");
          pauseUtterance.volume = 0;
          pauseUtterance.rate = 0.1; // very slow = longer pause
          // Estimate pause duration via rate: 1000ms / (rate * 100) ≈ pauseMs
          // Actually for " " character at rate 0.1 it pauses ~1s, so scale:
          pauseUtterance.rate = Math.max(
            0.1,
            Math.min(10, 1000 / seg.pauseBeforeMs),
          );
          synth.speak(pauseUtterance);
        }

        if (seg.text.length === 0) continue;

        const utterance = new SpeechSynthesisUtterance(seg.text);
        if (baseParams.lang) utterance.lang = baseParams.lang;
        if (baseParams.voiceURI) {
          const voice = synth
            .getVoices()
            .find((v) => v.voiceURI === baseParams.voiceURI);
          if (voice) utterance.voice = voice;
        }
        utterance.rate = (baseParams.rate ?? 1) * (seg.rateMultiplier ?? 1);
        utterance.pitch = (baseParams.pitch ?? 1) * (seg.pitchMultiplier ?? 1);
        utterance.volume = (baseParams.volume ?? 1) * (seg.volumeMultiplier ?? 1);
        synth.speak(utterance);
        chainStarted = true;
      }
    },
    [supported],
  );

  const pause = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.pause();
  }, [supported]);

  const resume = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.resume();
  }, [supported]);

  const cancel = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
    setPaused(false);
  }, [supported]);

  return {
    supported,
    voices,
    speaking,
    paused,
    speak,
    speakSegments,
    pause,
    resume,
    cancel,
  };
}
