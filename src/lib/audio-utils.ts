/**
 * Audio format utilities for Z.ai TTS integration.
 *
 * The Z.ai SDK supports two output formats:
 * - WAV: includes header, ready for playback in any audio player
 * - PCM: raw audio data, requires WAV header for playback
 *
 * When using streaming mode (stream=true), only PCM is supported.
 * This module provides utilities to wrap PCM data in a WAV header.
 */

export interface WavHeaderOptions {
  /** Sample rate in Hz (Z.ai uses 24000) */
  sampleRate?: number;
  /** Number of channels (1 = mono, 2 = stereo) */
  channels?: number;
  /** Bits per sample (16 = standard PCM) */
  bitsPerSample?: number;
}

const DEFAULT_WAV_OPTIONS: Required<WavHeaderOptions> = {
  sampleRate: 24000,
  channels: 1,
  bitsPerSample: 16,
};

/**
 * Convert raw PCM audio data to a WAV Blob by prepending a RIFF header.
 *
 * @param pcm - Raw PCM audio data (16-bit signed little-endian by default)
 * @param options - WAV header options
 * @returns Blob with audio/wav MIME type
 *
 * @example
 * const pcmBuffer = await fetch('/api/tts/stream', {...})
 *   .then(r => r.arrayBuffer());
 * const wavBlob = pcmToWav(new Uint8Array(pcmBuffer));
 * const url = URL.createObjectURL(wavBlob);
 * new Audio(url).play();
 */
export function pcmToWav(
  pcm: Uint8Array,
  options: WavHeaderOptions = {},
): Blob {
  const { sampleRate, channels, bitsPerSample } = {
    ...DEFAULT_WAV_OPTIONS,
    ...options,
  };

  const dataLength = pcm.length;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  // RIFF header
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeString(view, 8, "WAVE");

  // fmt chunk
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, 1, true); // audio format = PCM
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, (sampleRate * channels * bitsPerSample) / 8, true); // byte rate
  view.setUint16(32, (channels * bitsPerSample) / 8, true); // block align
  view.setUint16(34, bitsPerSample, true);

  // data chunk
  writeString(view, 36, "data");
  view.setUint32(40, dataLength, true);

  // Copy PCM data after header
  const bytes = new Uint8Array(buffer, 44);
  bytes.set(pcm);

  return new Blob([buffer], { type: "audio/wav" });
}

/**
 * Convert PCM ArrayBuffer to WAV Blob.
 * Convenience wrapper around pcmToWav.
 */
export function pcmBufferToWav(
  pcmBuffer: ArrayBuffer,
  options?: WavHeaderOptions,
): Blob {
  return pcmToWav(new Uint8Array(pcmBuffer), options);
}

/**
 * Concatenate multiple PCM chunks and convert to a single WAV Blob.
 * Useful for streaming TTS where audio arrives in chunks.
 *
 * @param chunks - Array of PCM ArrayBuffer chunks
 * @param options - WAV header options
 * @returns Combined WAV Blob
 *
 * @example
 * const chunks: ArrayBuffer[] = [];
 * const reader = response.body.getReader();
 * while (true) {
 *   const { done, value } = await reader.read();
 *   if (done) break;
 *   chunks.push(value.buffer);
 * }
 * const wavBlob = concatPcmToWav(chunks);
 */
export function concatPcmToWav(
  chunks: ArrayBuffer[],
  options?: WavHeaderOptions,
): Blob {
  // Calculate total length
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);

  // Combine all chunks
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    const bytes = new Uint8Array(chunk);
    combined.set(bytes, offset);
    offset += bytes.length;
  }

  return pcmToWav(combined, options);
}

/**
 * Write a string to a DataView at a given offset.
 */
function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/**
 * Format bytes as human-readable string.
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Estimate audio duration in seconds from byte count.
 *
 * @param bytes - PCM/WAV byte count
 * @param sampleRate - Sample rate in Hz (default: 24000)
 * @param channels - Number of channels (default: 1)
 * @param bitsPerSample - Bits per sample (default: 16)
 * @returns Estimated duration in seconds
 */
export function estimateDurationSeconds(
  bytes: number,
  sampleRate = 24000,
  channels = 1,
  bitsPerSample = 16,
): number {
  // Subtract 44 bytes for WAV header if present
  const pcmBytes = Math.max(0, bytes - 44);
  const bytesPerSecond = (sampleRate * channels * bitsPerSample) / 8;
  return pcmBytes / bytesPerSecond;
}

/**
 * Format duration in seconds as "Mm Ss" or "Ss".
 */
export function formatDuration(seconds: number): string {
  if (seconds <= 0) return "0с";
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  if (mins === 0) return `${secs}с`;
  return `${mins}м ${secs.toString().padStart(2, "0")}с`;
}
