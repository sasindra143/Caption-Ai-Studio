import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, projectRoot, "");
  const apiTarget = env.CAPTION_API_TARGET ?? `http://127.0.0.1:${env.PORT || "5000"}`;

  return {
    root: fileURLToPath(new URL(".", import.meta.url)),
    envDir: projectRoot,
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        "/api": { target: apiTarget, changeOrigin: true },
        "/media": { target: apiTarget, changeOrigin: true },
        "/health": { target: apiTarget, changeOrigin: true },
        "/ready": { target: apiTarget, changeOrigin: true },
      },
    },
  };
});
