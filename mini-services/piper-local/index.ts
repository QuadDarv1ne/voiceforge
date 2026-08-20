/**
 * piper-local mini-service
 *
 * HTTP-сервер на порту 3005, который запускает локальный Piper TTS
 * для офлайн-синтеза речи (без интернета).
 *
 * Модель: ru_RU-dmitri-medium (русский, мужской голос "Дмитрий")
 *
 * POST /synthesize
 *   body: { text: string, voice?: string }
 *   response: 200 + audio/wav binary, или 5xx + JSON error
 *
 * GET /health
 *   response: 200 + { ok: true, voices: string[] }
 *
 * GET /voices
 *   response: 200 + { voices: [{id, name, lang, gender}] }
 */

import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { spawn } from "node:child_process";
import { readFile, writeFile, unlink, readdir } from "node:fs/promises";
import { join, basename } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PIPER_PORT) || 3005;

// Path to the Piper binary — resolves to <project-root>/piper-tts/piper/piper.exe
const PIPER_BIN =
  process.env.PIPER_BIN ||
  join(__dirname, "..", "..", "piper-tts", "piper", "piper.exe");

// Path to voice models directory
const VOICES_DIR =
  process.env.PIPER_VOICES_DIR ||
  join(__dirname, "..", "..", "piper-tts", "voices");

interface VoiceInfo {
  id: string;
  name: string;
  lang: string;
  gender: string;
  path: string;
}

/** Scan the voices directory for available .onnx models */
async function getAvailableVoices(): Promise<VoiceInfo[]> {
  try {
    const files = await readdir(VOICES_DIR);
    const onnxFiles = files.filter((f) => f.endsWith(".onnx"));
    const voices: VoiceInfo[] = [];
    for (const file of onnxFiles) {
      // Parse voice name from file, e.g. "ru_RU-dmitri-medium.onnx"
      const base = basename(file, ".onnx");
      const parts = base.split("-");
      if (parts.length >= 2) {
        const langParts = parts[0].split("_");
        const voiceName = parts[1];
        // Known gender mapping for Piper voices
        const MALE_NAMES = new Set(["dmitri", "denis", "ruslan", "alan", "norman", "joe", "john", "ryan", "danny", "kusal", "bryce", "kareem", "jirka", "artur", "carlfm", "davefx", "thorsten", "pavoque", "karlsson"]);
        voices.push({
          id: base,
          name: voiceName,
          lang: parts[0],
          gender: MALE_NAMES.has(voiceName) ? "m" : "f",
          path: join(VOICES_DIR, file),
        });
      }
    }
    return voices;
  } catch {
    return [];
  }
}

/** Find a voice model by name (e.g. "dmitri") or full id */
async function findVoice(voiceId: string): Promise<VoiceInfo | null> {
  const voices = await getAvailableVoices();
  // Try exact id match first
  const exact = voices.find((v) => v.id === voiceId);
  if (exact) return exact;
  // Try name match
  const byName = voices.find(
    (v) => v.name === voiceId || v.id.includes(voiceId),
  );
  return byName ?? null;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

/** Run piper.exe to synthesize text to a WAV file */
async function runPiper(
  modelPath: string,
  configPath: string,
  text: string,
): Promise<{ ok: true; buffer: Buffer } | { ok: false; error: string }> {
  const outFile = join(tmpdir(), `piper-${randomUUID()}.wav`);
  const inFile = join(tmpdir(), `piper-input-${randomUUID()}.txt`);

  return new Promise((resolve) => {
    (async () => {
      try {
        await writeFile(inFile, text, "utf-8");
      } catch (e) {
        resolve({
          ok: false,
          error: `Failed to write input: ${e instanceof Error ? e.message : String(e)}`,
        });
        return;
      }

      const args = [
        "-m", modelPath,
        "-c", configPath,
        "-f", outFile,
        "--quiet",
      ];

      const proc = spawn(PIPER_BIN, args, {
        stdio: ["pipe", "pipe", "pipe"],
      });

      // Feed text via stdin
      proc.stdin.write(text);
      proc.stdin.end();

      let stderr = "";
      proc.stderr.on("data", (d) => (stderr += d.toString()));

      // 30-second timeout
      const timer = setTimeout(() => {
        proc.kill("SIGKILL");
        resolve({ ok: false, error: "Piper timeout (30s)" });
      }, 30000);

      proc.on("close", async (code) => {
        clearTimeout(timer);
        if (code !== 0) {
          try { await unlink(inFile); } catch {}
          try { await unlink(outFile); } catch {}
          resolve({
            ok: false,
            error: `Piper exit ${code}: ${stderr.trim()}`,
          });
          return;
        }
        try {
          const buffer = await readFile(outFile);
          await unlink(inFile);
          await unlink(outFile);
          resolve({ ok: true, buffer });
        } catch (e) {
          resolve({
            ok: false,
            error: `Failed to read output: ${e instanceof Error ? e.message : String(e)}`,
          });
        }
      });

      proc.on("error", (e) => {
        clearTimeout(timer);
        resolve({
          ok: false,
          error: `Spawn failed: ${e.message}. Is piper.exe at ${PIPER_BIN}?`,
        });
      });
    })();
  });
}

const server = createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check
  if (req.method === "GET" && req.url === "/health") {
    const voices = await getAvailableVoices();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        ok: true,
        service: "piper-local",
        port: PORT,
        piperBin: PIPER_BIN,
        voicesAvailable: voices.length,
      }),
    );
    return;
  }

  // List available voices
  if (req.method === "GET" && req.url === "/voices") {
    const voices = await getAvailableVoices();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ voices }));
    return;
  }

  // Synthesize
  if (req.method === "POST" && req.url === "/synthesize") {
    try {
      const raw = await readBody(req);
      const parsed = JSON.parse(raw);
      const text = parsed.text;
      const voiceId = parsed.voice || "dmitri";

      if (!text || typeof text !== "string" || text.trim().length === 0) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "text is required" }));
        return;
      }
      if (text.length > 5000) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({ error: `Text too long (${text.length} > 5000)` }),
        );
        return;
      }

      const voice = await findVoice(voiceId);
      if (!voice) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: `Voice "${voiceId}" not found`,
            available: (await getAvailableVoices()).map((v) => v.id),
          }),
        );
        return;
      }

      const configPath = voice.path + ".json";
      console.log(
        `[piper-local] synth voice=${voice.id} text="${text.substring(0, 50)}..."`,
      );

      const result = await runPiper(voice.path, configPath, text);

      if (result.ok) {
        res.writeHead(200, {
          "Content-Type": "audio/wav",
          "Content-Length": result.buffer.length.toString(),
          "Content-Disposition": `attachment; filename="piper-${voice.name}.wav"`,
          "Cache-Control": "no-cache",
          "X-Engine": "piper-local",
          "X-Voice": voice.id,
        });
        res.end(result.buffer);
        console.log(`[piper-local] OK ${result.buffer.length} bytes`);
      } else {
        res.writeHead(502, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: result.error }));
        console.error(`[piper-local] FAIL: ${result.error}`);
      }
    } catch (e) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: e instanceof Error ? e.message : "Internal error",
        }),
      );
    }
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, () => {
  console.log(`[piper-local] HTTP server on http://localhost:${PORT}`);
  console.log(`[piper-local] Piper binary: ${PIPER_BIN}`);
  console.log(`[piper-local] Voices dir: ${VOICES_DIR}`);
});

process.on("SIGTERM", () => {
  console.log("[piper-local] shutting down...");
  server.close(() => process.exit(0));
});
process.on("SIGINT", () => {
  console.log("[piper-local] shutting down...");
  server.close(() => process.exit(0));
});
