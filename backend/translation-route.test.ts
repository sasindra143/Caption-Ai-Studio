import assert from "node:assert/strict";
import { execFile, spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";
import ffprobe from "ffprobe-static";
import test, { after, before } from "node:test";

const execFileAsync = promisify(execFile);
const backendDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(backendDir, "..");
const projectId = "11111111-1111-4111-8111-111111111111";
const captionId = "22222222-2222-4222-8222-222222222222";
let storageDir: string;
let port: number;
let backend: ChildProcess;
let backendOutput = "";

before(async () => {
  storageDir = await mkdtemp(path.join(projectRoot, "storage-translation-test-"));
  await mkdir(path.join(storageDir, "projects"), { recursive: true });
  await mkdir(path.join(storageDir, "uploads"), { recursive: true });
  await mkdir(path.join(storageDir, "exports"), { recursive: true });
  if (!ffmpegPath) throw new Error("FFmpeg is required for the export test.");
  const mediaPath = path.join(storageDir, "uploads", "test.mp4");
  await execFileAsync(ffmpegPath, [
    "-y", "-f", "lavfi", "-i", "testsrc=size=1920x1080:rate=15",
    "-f", "lavfi", "-i", "sine=frequency=1000:sample_rate=44100",
    "-t", "2", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
    "-c:a", "aac", mediaPath,
  ], { timeout: 30_000 });
  await writeFile(path.join(storageDir, "projects", `${projectId}.json`), JSON.stringify({
    id: projectId,
    name: "Translation test",
    originalName: "test.mp4",
    mediaPath,
    duration: 2,
    createdAt: new Date(0).toISOString(),
    sourceLanguage: "en-US",
    status: "ready",
    segments: [{ id: captionId, start: 0.25, end: 1.5, text: "Hello there." }],
    translations: {},
  }));

  const portServer = createServer();
  portServer.listen(0, "127.0.0.1");
  await once(portServer, "listening");
  port = (portServer.address() as { port: number }).port;
  await new Promise<void>((resolve, reject) => portServer.close((error) => error ? reject(error) : resolve()));

  backend = spawn(process.execPath, ["--import", "tsx", "backend/index.ts"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PORT: String(port),
      STORAGE_DIR: storageDir,
      DATABASE_URL: "",
      GEMINI_API_KEY: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  backend.stdout?.on("data", (chunk: Buffer) => { backendOutput += chunk.toString(); });
  backend.stderr?.on("data", (chunk: Buffer) => { backendOutput += chunk.toString(); });

  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (backend.exitCode !== null) throw new Error(`Test backend exited before ready: ${backendOutput}`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error(`Test backend did not become ready: ${backendOutput}`);
});

after(async () => {
  if (backend && backend.exitCode === null) {
    const exited = once(backend, "exit");
    backend.kill();
    await exited;
  }
  if (storageDir) await rm(storageDir, { recursive: true, force: true });
});

test("serves health without Gemini credentials", async () => {
  const response = await fetch(`http://127.0.0.1:${port}/api/health`);
  assert.equal(response.status, 200);
  const health = await response.json() as { ok: boolean; server: string; gemini: boolean };
  assert.equal(health.ok, true);
  assert.equal(health.server, "running");
  assert.equal(health.gemini, false);
});

test("allows only configured origins and handles CORS preflight", async () => {
  const allowedOrigins = [
    "https://caption-ai-studio-frontend.vercel.app",
    "https://caption-ai-studio.netlify.app",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ];

  for (const origin of allowedOrigins) {
    const response = await fetch(`http://127.0.0.1:${port}/api/health`, {
      method: "OPTIONS",
      headers: {
        Origin: origin,
        "Access-Control-Request-Method": "GET",
      },
    });
    assert.equal(response.status, 204, `Expected OPTIONS success for ${origin}`);
    assert.equal(response.headers.get("access-control-allow-origin"), origin);
    assert.match(response.headers.get("access-control-allow-methods") ?? "", /\bGET\b/);
  }

  const unknownOrigin = "https://untrusted.example";
  const response = await fetch(`http://127.0.0.1:${port}/api/health`, {
    method: "OPTIONS",
    headers: {
      Origin: unknownOrigin,
      "Access-Control-Request-Method": "GET",
    },
  });
  assert.notEqual(response.headers.get("access-control-allow-origin"), unknownOrigin);
});

test("renders 720p MP4 exports at mobile-friendly original aspect ratio", async () => {
  const response = await fetch(`http://127.0.0.1:${port}/api/projects/${projectId}/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ format: "mp4", mode: "original", aspectRatio: "original", resolution: "720p", style: {} }),
  });
  assert.equal(response.status, 202);
  const { jobId } = await response.json() as { jobId: string };
  const deadline = Date.now() + 30_000;
  let resultUrl: string | undefined;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const progressResponse = await fetch(`http://127.0.0.1:${port}/api/jobs/${jobId}`);
    const progress = await progressResponse.json() as { status: string; error?: string; resultUrl?: string };
    if (progress.status === "failed") throw new Error(progress.error ?? "MP4 export failed.");
    if (progress.status === "completed") {
      resultUrl = progress.resultUrl;
      break;
    }
  }
  assert.ok(resultUrl, "MP4 export should finish within 30 seconds.");
  const download = await fetch(`http://127.0.0.1:${port}${resultUrl}`);
  assert.equal(download.status, 200);
  assert.match(download.headers.get("content-type") ?? "", /video\/mp4/);
  const filename = resultUrl.split("/").at(-1);
  assert.ok(filename);
  assert.ok(ffprobe.path, "FFprobe is required to inspect the export dimensions.");
  const { stdout } = await execFileAsync(ffprobe.path, [
    "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "json",
    path.join(storageDir, "exports", filename),
  ]);
  const stream = (JSON.parse(stdout) as { streams: Array<{ width: number; height: number }> }).streams[0];
  assert.deepEqual({ width: stream.width, height: stream.height }, { width: 1280, height: 720 });
});

test("rejects an invalid translation payload with HTTP 400", async () => {
  const response = await fetch(`http://127.0.0.1:${port}/api/projects/${projectId}/translate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target: "unsupported-mode", vocabulary: [] }),
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "Choose a supported caption mode." });
});

test("accepts a valid small caption request and reports missing backend credentials", async () => {
  const response = await fetch(`http://127.0.0.1:${port}/api/projects/${projectId}/translate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target: "translation", targetLanguage: "te-IN", vocabulary: [] }),
  });
  assert.equal(response.status, 503);
  assert.match((await response.json() as { error: string }).error, /not configured/i);
});
