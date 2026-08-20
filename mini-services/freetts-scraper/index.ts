/**
 * freetts-scraper mini-service
 *
 * HTTP-сервер на порту 3004, который запускает Python Playwright-скрипт
 * для обхода WAF freetts.ru. Главный Next.js API вызывает этот сервис
 * через `?XTransformPort=3004`.
 *
 * POST /synthesize
 *   body: { voice: string, text: string }
 *   response: 200 + audio/mpeg binary, или 5xx + JSON error
 *
 * GET /health
 *   response: 200 + { ok: true, playwright: bool }
 */

import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { spawn } from "node:child_process";
import { readFile, writeFile, mkdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";

const PORT = 3004;
const SCRIPT_PATH = new URL("./freetts_scraper.py", import.meta.url).pathname;
const PY_BIN = process.env.PYTHON_BIN || "python3";

interface SynthRequest {
  voice: string;
  text: string;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

async function runPythonScraper(
  voice: string,
  text: string,
): Promise<{ ok: true; buffer: Buffer } | { ok: false; error: string }> {
  const tempFile = join(tmpdir(), `freetts-${randomUUID()}.mp3`);

  return new Promise((resolve) => {
    const proc = spawn(PY_BIN, [SCRIPT_PATH, voice, text, tempFile], {
      env: { ...process.env, PYTHONUNBUFFERED: "1" },
    });

    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));

    // 60-second timeout — Playwright is slow
    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      resolve({ ok: false, error: "Playwright timeout (60s)" });
    }, 60000);

    proc.on("close", async (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        resolve({
          ok: false,
          error: `Python exit ${code}: ${stderr.trim() || stdout.trim()}`,
        });
        try {
          await unlink(tempFile);
        } catch {}
        return;
      }
      try {
        const buffer = await readFile(tempFile);
        await unlink(tempFile);
        resolve({ ok: true, buffer });
      } catch (e) {
        resolve({
          ok: false,
          error: `Failed to read temp file: ${e instanceof Error ? e.message : String(e)}`,
        });
      }
    });

    proc.on("error", (e) => {
      clearTimeout(timer);
      resolve({
        ok: false,
        error: `Spawn failed: ${e.message}. Is python3 + playwright installed?`,
      });
    });
  });
}

const server = createServer(async (req, res) => {
  // CORS for cross-origin requests from main app
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        ok: true,
        service: "freetts-scraper",
        port: PORT,
        python: PY_BIN,
      }),
    );
    return;
  }

  if (req.method === "POST" && req.url === "/synthesize") {
    try {
      const raw = await readBody(req);
      const parsed = JSON.parse(raw) as SynthRequest;

      if (!parsed.voice || typeof parsed.voice !== "string") {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "voice is required" }));
        return;
      }
      if (!parsed.text || typeof parsed.text !== "string") {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "text is required" }));
        return;
      }
      if (parsed.text.length > 1024) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: `Text too long (${parsed.text.length} > 1024)`,
          }),
        );
        return;
      }

      console.log(
        `[freetts-scraper] synth voice=${parsed.voice} text="${parsed.text.substring(0, 50)}..."`,
      );

      const result = await runPythonScraper(parsed.voice, parsed.text);

      if (result.ok) {
        res.writeHead(200, {
          "Content-Type": "audio/mpeg",
          "Content-Length": result.buffer.length.toString(),
          "Content-Disposition": `attachment; filename="freetts.mp3"`,
          "Cache-Control": "no-cache",
          "X-Engine": "freetts.ru",
          "X-Strategy": "playwright",
        });
        res.end(result.buffer);
        console.log(
          `[freetts-scraper] OK ${result.buffer.length} bytes`,
        );
      } else {
        res.writeHead(502, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: result.error }));
        console.error(`[freetts-scraper] FAIL: ${result.error}`);
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
  console.log(`[freetts-scraper] HTTP server on http://localhost:${PORT}`);
  console.log(`[freetts-scraper] Python script: ${SCRIPT_PATH}`);
  console.log(`[freetts-scraper] Python bin: ${PY_BIN}`);
});

process.on("SIGTERM", () => {
  console.log("[freetts-scraper] shutting down...");
  server.close(() => process.exit(0));
});
process.on("SIGINT", () => {
  console.log("[freetts-scraper] shutting down...");
  server.close(() => process.exit(0));
});
