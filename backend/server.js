import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const backendDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(backendDir, "..");
const child = spawn(process.execPath, ["--import", "tsx", "backend/index.ts"], {
  cwd: projectRoot,
  env: process.env,
  stdio: "inherit",
});

child.on("error", (error) => {
  console.error(`Could not start CaptionAI Studio backend: ${error.message}`);
  process.exitCode = 1;
});

child.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
