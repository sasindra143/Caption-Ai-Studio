import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test, { after, before } from "node:test";

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
  await writeFile(path.join(storageDir, "projects", `${projectId}.json`), JSON.stringify({
    id: projectId,
    name: "Translation test",
    originalName: "test.mp4",
    mediaPath: path.join(storageDir, "uploads", "test.mp4"),
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
