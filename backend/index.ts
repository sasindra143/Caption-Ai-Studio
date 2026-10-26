import dotenv from "dotenv";
import cors from "cors";
import express, { type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import { ApiError, GoogleGenAI, type File as GeminiFile, type GoogleGenAIInteraction } from "@google/genai";
import { Pool } from "pg";
import ffmpegPath from "ffmpeg-static";
import ffprobe from "ffprobe-static";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { CaptionSegment, Project } from "../frontend/src/domain";
import { getLanguageName, supportedLanguages, translationStorageKey } from "../shared/languages";

const execFileAsync = promisify(execFile);
const backendDir = path.dirname(fileURLToPath(import.meta.url));
const projectDirPath = path.resolve(backendDir, "..");
dotenv.config({ path: path.join(projectDirPath, ".env") });
dotenv.config({ path: path.join(backendDir, ".env") });
const root = path.resolve(process.env.STORAGE_DIR ?? path.join(projectDirPath, "storage"));
const uploadDir = path.join(root, "uploads");
const exportDir = path.join(root, "exports");
const projectDir = path.join(root, "projects");
const port = Number(process.env.PORT ?? 5000);
const maxUploadBytes = Number(process.env.MAX_UPLOAD_MB ?? 300) * 1024 * 1024;
const maxConcurrentJobs = Math.max(1, Number(process.env.MAX_CONCURRENT_JOBS ?? 2));
const jobs = new Map<string, { status: "queued" | "processing" | "completed" | "failed"; progress: number; message: string; error?: string; resultUrl?: string }>();
const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: true } : undefined }) : undefined;
const transcriptionModel = process.env.GEMINI_TRANSCRIPTION_MODEL ?? "gemini-3.5-transcribe";
const translationModel = process.env.GEMINI_TEXT_MODEL ?? "gemini-3.5-flash-lite";
const gemini = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { retryOptions: { attempts: 1 } } })
  : undefined;

function isAllowedOrigin(origin: string): boolean {
  if (origin === (process.env.PUBLIC_APP_ORIGIN ?? "http://localhost:5173")) return true;
  if (process.env.NODE_ENV === "production") return false;
  try {
    const url = new URL(origin);
    return ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
      Number(url.port || 80) >= 5173 && Number(url.port || 80) <= 5185;
  } catch {
    return false;
  }
}

function assOverrideColor(hex: string): string {
  return `${assPrimaryColor(hex)}&`;
}

await Promise.all([mkdir(uploadDir, { recursive: true }), mkdir(exportDir, { recursive: true }), mkdir(projectDir, { recursive: true })]);
if (pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
}

function hasJobCapacity(): boolean {
  const activeJobs = [...jobs.values()].filter((job) => job.status === "queued" || job.status === "processing").length;
  return activeJobs < maxConcurrentJobs;
}

const app = express();
app.disable("x-powered-by");
app.use(cors({
  origin: (origin, callback) => callback(null, !origin || isAllowedOrigin(origin)),
}));
app.use(express.json({ limit: "1mb" }));

app.get(["/health", "/api/health"], async (_req, res) => {
  let storageAvailable = true;
  let databaseAvailable = !pool;
  try {
    await Promise.all([stat(uploadDir), stat(exportDir), stat(projectDir)]);
  } catch (error) {
    storageAvailable = false;
    console.error("[health] Storage check failed:", error instanceof Error ? error.message : String(error));
  }
  if (pool) {
    try {
      await pool.query("SELECT 1");
      databaseAvailable = true;
    } catch (error) {
      console.error("[health] Database check failed:", error instanceof Error ? error.message : String(error));
    }
  }
  const healthy = storageAvailable && databaseAvailable;
  return res.status(healthy ? 200 : 503).json({
    status: healthy ? "ok" : "unavailable",
    server: "running",
    ok: healthy,
    storage: storageAvailable,
    database: Boolean(pool),
    gemini: Boolean(gemini),
    transcriptionModel,
  });
});

app.get("/ready", async (_req, res) => {
  try {
    await Promise.all([stat(uploadDir), stat(exportDir), stat(projectDir)]);
    return res.json({ status: "ready", storage: "available", geminiConfigured: Boolean(gemini) });
  } catch (error) {
    console.error("[ready] Storage check failed:", error instanceof Error ? error.message : String(error));
    return res.status(503).json({ status: "not_ready", storage: "unavailable", geminiConfigured: Boolean(gemini) });
  }
});

app.get("/media/:filename", async (req, res, next) => {
  const { filename } = req.params;
  if (typeof filename !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(mp4|mov|webm)$/i.test(filename)) {
    return res.status(404).json({ error: "Video file not found." });
  }
  const filePath = path.resolve(uploadDir, filename);
  if (path.dirname(filePath) !== path.resolve(uploadDir)) {
    return res.status(404).json({ error: "Video file not found." });
  }
  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) return res.status(404).json({ error: "Video file not found." });
    return res.sendFile(filePath, { acceptRanges: true, dotfiles: "deny", lastModified: true }, (error) => {
      if (!error || res.headersSent) return;
      if ("code" in error && error.code === "ENOENT") {
        res.status(404).json({ error: "Video file not found." });
      } else {
        next(error);
      }
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
      return res.status(404).json({ error: "Video file not found." });
    }
    return next(error);
  }
});

app.use("/media", (_req, res) => res.status(404).json({ error: "Video file not found." }));

class UnsupportedVideoError extends Error {
  readonly status = 415;
}

class InvalidVideoError extends Error {
  readonly status = 400;
}

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, uploadDir),
  filename: (_req, file, callback) => callback(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
});
const upload = multer({
  storage,
  limits: { fileSize: maxUploadBytes, files: 1 },
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const valid = [".mp4", ".mov", ".webm"].includes(extension) &&
      ["video/mp4", "video/quicktime", "video/webm", "application/octet-stream"].includes(file.mimetype);
    if (valid) callback(null, true);
    else callback(new UnsupportedVideoError("Choose an MP4, MOV, or WebM video file."));
  },
});

async function saveProject(project: Project): Promise<void> {
  if (pool) {
    await pool.query(
      "INSERT INTO projects (id, data, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()",
      [project.id, JSON.stringify(project)],
    );
    return;
  }
  const filePath = path.join(projectDir, `${project.id}.json`);
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporaryPath, JSON.stringify(project), { encoding: "utf8", flag: "wx" });
    await rename(temporaryPath, filePath);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }
}

async function getProject(id: string): Promise<Project | undefined> {
  if (!z.string().uuid().safeParse(id).success) return undefined;
  if (pool) {
    const result = await pool.query<{ data: Project }>("SELECT data FROM projects WHERE id = $1", [id]);
    return result.rows[0]?.data;
  }
  try {
    return JSON.parse(await readFile(path.join(projectDir, `${id}.json`), "utf8")) as Project;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

async function probeMedia(filePath: string): Promise<{ duration: number; hasVideo: boolean; hasAudio: boolean }> {
  const probePath = ffprobe.path;
  if (!probePath) throw new Error("FFprobe is unavailable. Install FFmpeg and FFprobe.");
  try {
    const { stdout } = await execFileAsync(probePath, [
      "-v", "error", "-show_entries", "format=duration:stream=codec_type", "-of", "json", filePath,
    ], { timeout: 30_000, maxBuffer: 2 * 1024 * 1024 });
    const probe = JSON.parse(stdout) as { format?: { duration?: string }; streams?: Array<{ codec_type: string }> };
    const duration = Number(probe.format?.duration);
    const hasVideo = probe.streams?.some((stream) => stream.codec_type === "video") ?? false;
    const hasAudio = probe.streams?.some((stream) => stream.codec_type === "audio") ?? false;
    if (!Number.isFinite(duration) || !hasVideo || !hasAudio) {
      throw new InvalidVideoError("The uploaded file must be a playable video with both video and audio.");
    }
    if (duration > 180) throw new InvalidVideoError("Videos must be 180 seconds or shorter.");
    return { duration, hasVideo, hasAudio };
  } catch (error) {
    if (error instanceof InvalidVideoError) throw error;
    throw new InvalidVideoError("The uploaded file is not a supported playable video.");
  }
}

function publicProject(project: Project): Omit<Project, "mediaPath"> & { videoUrl: string } {
  const { mediaPath: _mediaPath, ...publicData } = project;
  return { ...publicData, videoUrl: `/media/${path.basename(project.mediaPath)}` };
}

function makeSegments(words: Array<{ word: string; start: number; end: number }>): CaptionSegment[] {
  const result: CaptionSegment[] = [];
  let group: typeof words = [];
  const flush = () => {
    if (!group.length) return;
    result.push({
      id: randomUUID(),
      start: group[0].start,
      end: group[group.length - 1].end,
      text: group.map((item) => item.word).join(" ").replace(/\s+([,!.?])/g, "$1"),
      words: group.map((item) => ({ id: randomUUID(), start: item.start, end: item.end, text: item.word })),
    });
    group = [];
  };
  for (const word of words) {
    group.push(word);
    if (/[.!?]$/.test(word.word) || group.length >= 8) flush();
  }
  flush();
  return result;
}

function annotationOffset(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const match = value.match(/^(\d+(?:\.\d+)?)s$/);
  return match ? Number(match[1]) : undefined;
}

function readWordAnnotations(interaction: GoogleGenAIInteraction): Array<{ word: string; start: number; end: number }> {
  return (interaction.steps ?? []).flatMap((step) =>
    step.type === "model_output"
      ? (step.content ?? []).flatMap((content) => content.type === "text"
        ? (content.annotations ?? []).flatMap((annotation) => annotation.type === "word_info"
          ? (() => {
              const start = annotationOffset(annotation.start_offset);
              const end = annotationOffset(annotation.end_offset);
              return annotation.text && start !== undefined && end !== undefined && end > start
                ? [{ word: annotation.text, start, end }]
                : [];
            })()
          : [])
        : [])
      : [],
  ).sort((left, right) => left.start - right.start);
}

function geminiStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const status = "status" in error ? Number((error as { status?: unknown }).status) : undefined;
  const code = typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code).toUpperCase() : "";
  const message = error instanceof Error ? error.message : "";
  if (status === 429 || /RESOURCE_EXHAUSTED|quota|rate.?limit/i.test(`${code} ${message}`)) return 429;
  if (status === 401 || status === 403 || /API key not valid|unauthorized|permission denied/i.test(message)) return 502;
  if (status === 404 || /model .*not found|not supported for.*generate/i.test(message)) return 503;
  if (status === 408 || status === 504 || /timeout|timed out|ETIMEDOUT/i.test(message)) return 504;
  if (status !== undefined && status >= 500) return 502;
  if (status !== undefined && status >= 400) return 502;
  return undefined;
}

function geminiErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const status = geminiStatus(error);
  const code = typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code).toUpperCase() : "";
  if (status === 429 || /RESOURCE_EXHAUSTED|quota|rate.?limit/i.test(`${code} ${message}`)) {
    return "Gemini API quota or rate limit reached. Review your Google AI Studio plan and limits, then try again later. This request was not retried.";
  }
  if (status === 401 || status === 403 || /API key not valid|unauthorized|permission denied/i.test(message)) {
    return "Gemini rejected the API key. Check GEMINI_API_KEY in the root .env file and restart the backend.";
  }
  if (status === 404 || /model .*not found|not supported for.*generate/i.test(message)) {
    return "The configured Gemini model is unavailable. Check model access and the backend model configuration.";
  }
  if (status === 504 || /timeout|timed out|ETIMEDOUT/i.test(message)) {
    return "Gemini did not respond before the request timed out. Please try again later.";
  }
  return "Gemini could not complete this request. Check the backend logs and Gemini API status.";
}

const transcriptionLanguageCodes = new Set(supportedLanguages.map((language) => language.code));

class InvalidTranslationResponseError extends Error {}
class GeminiUpstreamError extends Error {}

async function translateCaptionBatch(
  captions: CaptionSegment[],
  instruction: string,
  sourceLanguageName: string,
): Promise<Array<{ id: string; text: string }>> {
  if (!gemini) throw new Error("Gemini is not configured. Add GEMINI_API_KEY to the backend environment.");
  let response: Awaited<ReturnType<typeof gemini.models.generateContent>>;
  try {
    response = await gemini.models.generateContent({
      model: translationModel,
      contents: [
        `Process each caption independently in the context of ${sourceLanguageName}. Return every stable caption ID exactly once and in the same order. Do not merge, split, omit, or add captions. Preserve meaning, wording, and punctuation according to the requested operation. ${instruction} Return only JSON matching the required schema.`,
        JSON.stringify({ captions: captions.map(({ id, text }) => ({ id, text })) }),
      ].join("\n\n"),
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            captions: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  id: { type: "STRING" },
                  text: { type: "STRING" },
                },
                required: ["id", "text"],
              },
            },
          },
          required: ["captions"],
        },
      },
    });
  } catch (error) {
    const status = error instanceof ApiError ? error.status : undefined;
    const detail = error instanceof Error ? error.message.replace(/AIza[0-9A-Za-z_-]{20,}/g, "[redacted]") : String(error);
    console.error(`[gemini:translation] upstream ${status ?? "network"}: ${detail}`);
    if (error instanceof ApiError) throw error;
    throw new GeminiUpstreamError("Gemini translation service is unavailable.");
  }
  const content = response.text;
  if (!content) throw new InvalidTranslationResponseError("Gemini returned an empty translation response.");
  let decoded: unknown;
  try {
    decoded = JSON.parse(content);
  } catch {
    throw new InvalidTranslationResponseError("Gemini returned invalid translation JSON.");
  }
  const parsed = z.object({
    captions: z.array(z.object({ id: z.string().uuid(), text: z.string().trim().min(1) })),
  }).safeParse(decoded);
  if (!parsed.success || parsed.data.captions.length !== captions.length) {
    throw new InvalidTranslationResponseError("Gemini returned a different number of captions than requested.");
  }
  const expectedIds = captions.map(({ id }) => id);
  const returnedIds = parsed.data.captions.map(({ id }) => id);
  if (new Set(returnedIds).size !== returnedIds.length ||
    expectedIds.some((id, index) => returnedIds[index] !== id)) {
    throw new InvalidTranslationResponseError("Gemini returned missing, duplicate, or out-of-order caption IDs.");
  }
  return parsed.data.captions;
}

async function translateCaptions(
  captions: CaptionSegment[],
  instruction: string,
  sourceLanguageName: string,
): Promise<Array<{ id: string; text: string }>> {
  if (!captions.length) return [];
  try {
    return await translateCaptionBatch(captions, instruction, sourceLanguageName);
  } catch (error) {
    if (!(error instanceof InvalidTranslationResponseError)) throw error;
    if (captions.length === 1) {
      throw new InvalidTranslationResponseError("Gemini could not return one valid translation for a caption.");
    }
    const midpoint = Math.ceil(captions.length / 2);
    const left = await translateCaptions(captions.slice(0, midpoint), instruction, sourceLanguageName);
    const right = await translateCaptions(captions.slice(midpoint), instruction, sourceLanguageName);
    return [...left, ...right];
  }
}

async function transcribe(project: Project, jobId: string, language: string): Promise<void> {
  const job = jobs.get(jobId);
  if (!job || !gemini) throw new Error("Gemini is not configured. Set GEMINI_API_KEY in the root .env file and restart the backend.");
  const audioPath = path.join(root, "uploads", `${project.id}-${randomUUID()}.mp3`);
  let uploadedAudio: GeminiFile | undefined;
  let uploadedAudioName: string | undefined;
  try {
    job.status = "processing";
    job.progress = 5;
    job.message = "Extracting audio from video";
    project.status = "transcribing";
    await saveProject(project);
    const binary = ffmpegPath;
    if (typeof binary !== "string") throw new Error("FFmpeg is unavailable. Install FFmpeg to extract audio.");
    await execFileAsync(binary, [
      "-y", "-i", project.mediaPath, "-vn", "-ac", "1", "-ar", "16000",
      "-b:a", "64k", "-f", "mp3", audioPath,
    ], { timeout: 90_000, maxBuffer: 2 * 1024 * 1024 });
    const audioStat = await stat(audioPath);
    if (audioStat.size === 0) throw new Error("No audio was found in the uploaded video.");
    job.progress = 18;
    job.message = "Uploading extracted audio to Gemini";
    uploadedAudio = await gemini.files.upload({
      file: audioPath,
      config: { mimeType: "audio/mpeg", displayName: `captionai-${project.id}.mp3` },
    });
    if (!uploadedAudio.uri || !uploadedAudio.mimeType) throw new Error("Gemini did not return a usable audio file URI.");
    uploadedAudioName = uploadedAudio.name;
    if (!uploadedAudioName) throw new Error("Gemini did not return a deletable uploaded audio file.");
    for (let attempt = 0; uploadedAudio.state === "PROCESSING" && attempt < 30; attempt += 1) {
      job.progress = 23;
      job.message = "Waiting for Gemini to prepare the audio";
      await new Promise((resolve) => setTimeout(resolve, 1000));
      uploadedAudio = await gemini.files.get({ name: uploadedAudioName });
    }
    if (uploadedAudio.state === "FAILED") throw new Error(uploadedAudio.error?.message ?? "Gemini could not process the uploaded audio.");
    if (uploadedAudio.state === "PROCESSING") throw new Error("Gemini audio preparation timed out. Please retry the transcription.");
    job.progress = 35;
    job.message = "Transcribing speech and aligning word timestamps";
    const languageCodes = language === "auto" ? [] : [language];
    const response = await gemini.interactions.create({
      model: transcriptionModel,
      input: [{ type: "audio", uri: uploadedAudio.uri, mime_type: uploadedAudio.mimeType }],
      generation_config: {
        transcription_config: {
          language_codes: languageCodes,
          mode: { type: "verbatim", timestamp_granularities: ["word"] },
        },
      },
    }, { timeout_ms: 240_000, retries: { strategy: "none" } });
    job.progress = 85;
    job.message = "Preparing editable captions";
    const transcript = response.output_text?.normalize("NFC").trim();
    if (!transcript) throw new Error("Gemini returned no speech transcript. Check that the video contains audible speech.");
    const words = readWordAnnotations(response);
    if (!words.length) throw new Error("Gemini returned a transcript without word timestamps. Captions were not created because accurate video synchronization is required.");
    const segments = makeSegments(words.map((word) => ({ word: word.word, start: word.start, end: word.end })));
    if (!segments.length) throw new Error("Gemini returned no valid timed caption segments.");
    if (segments.some((segment) => segment.end > project.duration + 0.25)) {
      throw new Error("Gemini returned word timestamps outside this video's duration. Please retry with another video.");
    }
    const hasTeluguScript = /[\u0c00-\u0c7f]/u.test(transcript);
    project.sourceLanguage = language === "auto" ? (hasTeluguScript ? "te-IN" : undefined) : language;
    project.segments = segments;
    project.status = "ready";
    project.error = undefined;
    await saveProject(project);
    job.status = "completed";
    job.progress = 100;
    job.message = "Voice-synced captions are ready";
  } catch (error) {
    const message = error instanceof ApiError ? geminiErrorMessage(error)
      : error instanceof Error ? error.message : "An unexpected transcription error occurred.";
    project.status = "error";
    project.error = message;
    await saveProject(project);
    job.status = "failed";
    job.error = message;
    job.message = "Gemini transcription failed";
  } finally {
    await rm(audioPath, { force: true }).catch((error: unknown) => {
      console.error(`[transcription] Could not remove extracted audio: ${error instanceof Error ? error.message : String(error)}`);
    });
    if (uploadedAudioName && gemini) {
      await gemini.files.delete({ name: uploadedAudioName }).catch((error: unknown) => {
        console.error(`[gemini] Could not delete temporary uploaded audio: ${error instanceof Error ? error.message : String(error)}`);
      });
    }
  }
}

const translationVocabularySchema = z.array(z.object({
  preferred: z.string().trim().min(1).max(100),
  aliases: z.array(z.string().trim().min(1).max(100)).max(20),
})).max(100).default([]);

const translateSchema = z.object({
  target: z.enum(["english-translation", "telugu-translation", "roman", "teluglish-roman", "native-mix", "bilingual", "translation"]),
  targetLanguage: z.string().optional(),
  vocabulary: translationVocabularySchema,
});
const keyframeSchema = z.object({
  id: z.string().default(() => randomUUID()),
  time: z.number().nonnegative(),
  positionX: z.number().min(-100).max(200).default(50),
  positionY: z.number().min(-100).max(200).default(75),
  scale: z.number().min(0.05).max(10).default(1),
  rotation: z.number().min(-720).max(720).default(0),
  opacity: z.number().min(0).max(1).default(1),
  easing: z.enum(["linear", "ease-in", "ease-out", "ease-in-out", "smooth"]).default("smooth"),
});

const captionAnimationSchema = z.object({
  enabled: z.boolean().default(true),
  loop: z.boolean().default(false),
  easing: z.enum(["linear", "ease-in", "ease-out", "ease-in-out", "smooth"]).default("smooth"),
  keyframes: z.array(keyframeSchema).default([]),
});

const segmentStyleSchema = z.object({
  fontFamily: z.string().max(100).optional(),
  fontSize: z.number().min(10).max(200).optional(),
  textColor: z.string().regex(/^#[\da-f]{6}$/i).optional(),
  backgroundColor: z.string().regex(/^#[\da-f]{6}$/i).optional(),
  backgroundOpacity: z.number().min(0).max(1).optional(),
  outlineColor: z.string().regex(/^#[\da-f]{6}$/i).optional(),
  outlineWidth: z.number().min(0).max(20).optional(),
  highlightColor: z.string().regex(/^#[\da-f]{6}$/i).optional(),
  weight: z.enum(["normal", "bold"]).optional(),
  fontWeight: z.union([z.literal(100), z.literal(200), z.literal(300), z.literal(400), z.literal(500), z.literal(600), z.literal(700), z.literal(800), z.literal(900)]).optional(),
  textGradient: z.boolean().optional(),
  gradientStart: z.string().regex(/^#[\da-f]{6}$/i).optional(),
  gradientEnd: z.string().regex(/^#[\da-f]{6}$/i).optional(),
  italic: z.boolean().optional(),
  alignment: z.enum(["left", "center", "right"]).optional(),
  position: z.enum(["top", "center", "bottom"]).optional(),
  positionX: z.number().min(-100).max(200).optional(),
  positionY: z.number().min(-100).max(200).optional(),
  scale: z.number().min(0.2).max(4).optional(),
  rotation: z.number().min(-360).max(360).optional(),
  opacity: z.number().min(0).max(1).optional(),
  shadowColor: z.string().regex(/^#[\da-f]{6}$/i).optional(),
  shadowBlur: z.number().min(0).max(30).optional(),
  glowColor: z.string().regex(/^#[\da-f]{6}$/i).optional(),
  glowRadius: z.number().min(0).max(50).optional(),
  lineSpacing: z.number().min(0.5).max(3).optional(),
  maxWidth: z.number().min(30).max(100).optional(),
  maxLines: z.number().int().min(1).max(10).optional(),
  letterSpacing: z.number().min(-1).max(2).optional(),
  karaoke: z.boolean().optional(),
  entranceAnimation: z.enum(["none", "fade-in", "slide-up", "slide-down", "slide-left", "slide-right", "pop-in", "zoom-in", "bounce-in", "typewriter", "word-reveal", "letter-reveal", "stagger-words", "blur-clear", "rotate-in", "elastic-in"]).optional(),
  exitAnimation: z.enum(["none", "fade-out", "slide-up-out", "slide-down-out", "slide-left-out", "slide-right-out", "zoom-out", "pop-out", "rotate-out", "blur-out"]).optional(),
  continuousAnimation: z.enum(["none", "pulse", "floating", "gentle-bounce", "breathing-scale", "neon-glow", "karaoke", "active-word", "subtle-shake", "looping-highlight"]).optional(),
  animationDuration: z.number().min(50).max(5000).optional(),
  animationDelay: z.number().min(0).max(5000).optional(),
  animationIntensity: z.number().min(0).max(2).optional(),
  animationEasing: z.enum(["linear", "ease-in", "ease-out", "ease-in-out"]).optional(),
  animationLoop: z.boolean().optional(),
  safeAreaGuides: z.boolean().optional(),
  cinematic: z.boolean().optional(),
});

const captionLayerSchema = z.object({
  id: z.string().default(() => randomUUID()),
  name: z.string().max(100).default("Layer"),
  text: z.string().max(2000),
  visible: z.boolean().default(true),
  locked: z.boolean().default(false),
  positionX: z.number().min(-100).max(200).optional(),
  positionY: z.number().min(-100).max(200).optional(),
  scale: z.number().min(0.05).max(10).optional(),
  rotation: z.number().min(-720).max(720).optional(),
  opacity: z.number().min(0).max(1).optional(),
  fontFamily: z.string().max(100).optional(),
  fontSize: z.number().min(10).max(200).optional(),
  textColor: z.string().regex(/^#[\da-f]{6}$/i).optional(),
  outlineColor: z.string().regex(/^#[\da-f]{6}$/i).optional(),
  outlineWidth: z.number().min(0).max(20).optional(),
  shadowColor: z.string().regex(/^#[\da-f]{6}$/i).optional(),
  shadowBlur: z.number().min(0).max(30).optional(),
  glowColor: z.string().regex(/^#[\da-f]{6}$/i).optional(),
  glowRadius: z.number().min(0).max(50).optional(),
  backgroundColor: z.string().regex(/^#[\da-f]{6}$/i).optional(),
  backgroundOpacity: z.number().min(0).max(1).optional(),
  alignment: z.enum(["left", "center", "right"]).optional(),
  animation: captionAnimationSchema.optional(),
});

const segmentUpdateSchema = z.object({
  segments: z.array(z.object({
    id: z.string().uuid(),
    start: z.number().nonnegative(),
    end: z.number().positive(),
    text: z.string().max(2000),
    scriptText: z.string().max(500).optional(),
    headlineText: z.string().max(500).optional(),
    style: segmentStyleSchema.optional(),
    positionX: z.number().optional(),
    positionY: z.number().optional(),
    scale: z.number().optional(),
    rotation: z.number().optional(),
    opacity: z.number().optional(),
    locked: z.boolean().optional(),
    visible: z.boolean().optional(),
    animation: captionAnimationSchema.optional(),
    layers: z.array(captionLayerSchema).optional(),
    words: z.array(z.object({
      id: z.string().uuid(), start: z.number().nonnegative(), end: z.number().positive(), text: z.string().max(300),
    })).optional(),
  }).refine((segment) => segment.end > segment.start, "Caption end must be after its start")).max(3000),
});
const correctionTrackKeySchema = z.string().max(100).refine((key) =>
  key === "original" ||
  ["english-translation", "telugu-translation", "roman", "teluglish-roman", "teluglish-roman-natural-v1", "native-mix", "bilingual"].includes(key) ||
  /^translation:[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})?$/.test(key),
  "Choose an available caption track.",
);
const correctionCaptionSchema = z.object({
  id: z.string().uuid(),
  start: z.number().nonnegative(),
  end: z.number().positive(),
  text: z.string().max(2000),
}).refine((caption) => caption.end > caption.start, "Caption end must be after its start");
const spellingCorrectionSchema = z.object({
  key: correctionTrackKeySchema,
  captions: z.array(correctionCaptionSchema).min(1).max(3000),
  vocabulary: z.array(z.object({
    preferred: z.string().trim().min(1).max(100),
    aliases: z.array(z.string().trim().min(1).max(100)).max(20),
  })).max(100).default([]),
});
const captionTrackPatchSchema = z.object({
  key: correctionTrackKeySchema,
  captions: z.array(z.object({ id: z.string().uuid(), text: z.string().max(2000), style: segmentStyleSchema.nullable().optional() })).min(1).max(3000),
});

const correctionResponseSchema = z.object({
  captions: z.array(z.object({ id: z.string().uuid(), text: z.string().trim().min(1) })),
});

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchesPhrase(text: string, phrase: string): boolean {
  const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(phrase)}(?=$|[^\\p{L}\\p{N}])`, "iu");
  return pattern.test(text.normalize("NFC"));
}

function applyApprovedSpellings(
  original: string,
  corrected: string,
  vocabulary: Array<{ preferred: string; aliases: string[] }>,
): string {
  return [...vocabulary]
    .sort((left, right) => Math.max(...right.aliases.map((alias) => alias.length), 0) -
      Math.max(...left.aliases.map((alias) => alias.length), 0))
    .reduce((text, term) => {
      if (!term.aliases.some((alias) => matchesPhrase(original, alias))) return text;
      return [...term.aliases].sort((left, right) => right.length - left.length).reduce((result, alias) => {
        const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(alias)}(?=$|[^\\p{L}\\p{N}])`, "giu");
        return result.normalize("NFC").replace(pattern, (_match, prefix: string) => `${prefix}${term.preferred}`);
      }, text);
    }, corrected);
}

function isCorrectionWithinCaption(
  caption: CaptionSegment,
  corrected: string,
  allCaptions: CaptionSegment[],
): boolean {
  const tokenize = (text: string) => text.toLocaleLowerCase().match(/[\p{L}\p{N}°]+/gu) ?? [];
  const sourceWords = tokenize(caption.text);
  const correctedWords = tokenize(corrected);
  if (!corrected.trim() || correctedWords.length > Math.max(5, sourceWords.length + 4)) return false;
  if (sourceWords.length >= 4) {
    const correctedWordSet = new Set(correctedWords);
    const retainedWords = new Set(sourceWords.filter((word) => correctedWordSet.has(word)));
    if (retainedWords.size / new Set(sourceWords).size < 0.3) return false;
  }
  for (const neighbor of allCaptions) {
    if (neighbor.id === caption.id) continue;
    const neighborWords = tokenize(neighbor.text);
    for (let index = 0; index <= neighborWords.length - 3; index += 1) {
      const phrase = neighborWords.slice(index, index + 3);
      if (correctedWords.some((_word, start) =>
        phrase.every((word, offset) => correctedWords[start + offset] === word),
      )) return false;
    }
  }
  return true;
}

async function correctCaptionBatch(
  captions: Array<CaptionSegment>,
  vocabulary: Array<{ preferred: string; aliases: string[] }>,
  audio: { uri: string; mimeType: string },
  audioOffset: number,
  sourceLanguage: string,
): Promise<Array<{ id: string; text: string }>> {
  if (!gemini) throw new Error("Gemini is not configured. Add GEMINI_API_KEY to the backend environment.");
  let response: Awaited<ReturnType<typeof gemini.models.generateContent>>;
  try {
    response = await gemini.models.generateContent({
      model: translationModel,
      contents: [{
        role: "user",
        parts: [
          { fileData: { fileUri: audio.uri, mimeType: audio.mimeType } },
          { text: [
            `Correct likely speech-recognition spelling errors in these ${sourceLanguage} captions by listening to the supplied audio excerpt. Caption times are relative to this excerpt, which starts at ${audioOffset.toFixed(2)} seconds in the original video.`,
            "This is Telugu-English code-switched speech. Keep the language mix and spoken wording; do not translate, paraphrase, formalize, or invent words.",
            "Keep Telugu words in their current writing system. Use standard English spelling for clearly spoken English words even when the speech recognizer wrote their sounds using Telugu script. Preserve brand and technical-term capitalization.",
            "Each output caption must contain only speech from its own time range. Never move, merge, split, or borrow speech between captions. Preserve partial phrases at boundaries.",
            "When an approved vocabulary term closely matches the audible pronunciation and sentence context, use that exact spelling even if the input contains a phonetic Telugu-script rendering of it. Do not insert vocabulary terms when there is no audible match.",
            "Treat preferred as the canonical spelling and aliases as user-approved ways the same term may appear in the raw transcript. Only use a preferred spelling when an alias is present in the input and the audio supports that word:",
            JSON.stringify(vocabulary),
            "If the audio is unclear, keep the original caption text unchanged. Return every caption ID exactly once, in input order. Only return ID and corrected text; do not change timing or add captions.",
            JSON.stringify({ captions: captions.map(({ id, start, end, text }) => ({
              id, start: Math.max(0, start - audioOffset), end: Math.max(0, end - audioOffset), text,
            })) }),
          ].join("\n\n") },
        ],
      }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            captions: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: { id: { type: "STRING" }, text: { type: "STRING" } },
                required: ["id", "text"],
              },
            },
          },
          required: ["captions"],
        },
      },
    });
  } catch (error) {
    const status = error instanceof ApiError ? error.status : undefined;
    const detail = error instanceof Error ? error.message.replace(/AIza[0-9A-Za-z_-]{20,}/g, "[redacted]") : String(error);
    console.error(`[gemini:spelling-correction] upstream ${status ?? "network"}: ${detail}`);
    if (error instanceof ApiError) throw error;
    throw new GeminiUpstreamError("Gemini spelling correction service is unavailable.");
  }
  const content = response.text;
  if (!content) throw new InvalidTranslationResponseError("Gemini returned an empty spelling-correction response.");
  let decoded: unknown;
  try {
    decoded = JSON.parse(content);
  } catch {
    throw new InvalidTranslationResponseError("Gemini returned invalid spelling-correction JSON.");
  }
  const parsed = correctionResponseSchema.safeParse(decoded);
  if (!parsed.success || parsed.data.captions.length !== captions.length) {
    throw new InvalidTranslationResponseError("Gemini returned an unexpected number of spelling corrections.");
  }
  const expectedIds = captions.map(({ id }) => id);
  const returnedIds = parsed.data.captions.map(({ id }) => id);
  if (new Set(returnedIds).size !== returnedIds.length ||
    expectedIds.some((id, index) => returnedIds[index] !== id)) {
    throw new InvalidTranslationResponseError("Gemini returned missing, duplicate, or out-of-order correction IDs.");
  }
  return parsed.data.captions;
}

app.post("/api/projects", upload.single("video"), async (req, res, next) => {
  let uploadedPath: string | undefined;
  try {
    if (!req.file) return res.status(400).json({ error: "Choose a video file to upload." });
    uploadedPath = req.file.path;
    const media = await probeMedia(req.file.path);
    const project: Project = {
      id: randomUUID(),
      name: path.parse(req.file.originalname).name.slice(0, 100),
      originalName: path.basename(req.file.originalname),
      mediaPath: req.file.path,
      duration: media.duration,
      createdAt: new Date().toISOString(),
      status: "uploaded",
      segments: [],
      translations: {},
    };
    await saveProject(project);
    return res.status(201).json(publicProject(project));
  } catch (error) {
    if (uploadedPath) await rm(uploadedPath, { force: true });
    return next(error);
  }
});

app.get("/api/projects/latest", async (_req, res, next) => {
  try {
    const files = await readdir(projectDir);
    const jsonFiles = files.filter((f) => f.endsWith(".json"));
    if (!jsonFiles.length) return res.status(404).json({ error: "No projects found." });
    const stats = await Promise.all(
      jsonFiles.map(async (file) => ({
        file,
        mtime: (await stat(path.join(projectDir, file))).mtimeMs,
      })),
    );
    stats.sort((a, b) => b.mtime - a.mtime);
    const latestId = stats[0].file.replace(/\.json$/, "");
    const project = await getProject(latestId);
    return project ? res.json(publicProject(project)) : res.status(404).json({ error: "No project found." });
  } catch (error) { return next(error); }
});

app.get("/api/projects", async (_req, res, next) => {
  try {
    if (pool) {
      const result = await pool.query<{ data: Project }>("SELECT data FROM projects ORDER BY updated_at DESC");
      return res.json(result.rows.map(({ data }) => ({
        id: data.id,
        name: data.name,
        duration: data.duration,
        createdAt: data.createdAt,
      })));
    }
    const files = await readdir(projectDir);
    const jsonFiles = files.filter((f) => f.endsWith(".json"));
    const list = await Promise.all(
      jsonFiles.map(async (file) => {
        const raw = JSON.parse(await readFile(path.join(projectDir, file), "utf8")) as Project;
        return { id: raw.id, name: raw.name, duration: raw.duration, createdAt: raw.createdAt };
      }),
    );
    return res.json(list);
  } catch (error) { return next(error); }
});

app.get("/api/projects/:id", async (req, res, next) => {
  try {
    if (req.params.id === "latest") {
      const files = await readdir(projectDir);
      const jsonFiles = files.filter((f) => f.endsWith(".json"));
      if (!jsonFiles.length) return res.status(404).json({ error: "No projects found." });
      const stats = await Promise.all(
        jsonFiles.map(async (file) => ({
          file,
          mtime: (await stat(path.join(projectDir, file))).mtimeMs,
        })),
      );
      stats.sort((a, b) => b.mtime - a.mtime);
      const latestId = stats[0].file.replace(/\.json$/, "");
      const project = await getProject(latestId);
      return project ? res.json(publicProject(project)) : res.status(404).json({ error: "Project not found." });
    }
    const project = await getProject(req.params.id);
    return project ? res.json(publicProject(project)) : res.status(404).json({ error: "Project not found." });
  } catch (error) { return next(error); }
});

const transcribeRoute: express.RequestHandler = async (req, res, next) => {
  try {
    const parsed = z.object({
      language: z.string().default("auto").refine((code) => code === "auto" || transcriptionLanguageCodes.has(code), "Choose automatic detection or a supported language."),
    }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Choose automatic detection or a language from the supported list." });
    if (!gemini) return res.status(503).json({ error: "Gemini is not configured. Add GEMINI_API_KEY=... to the root .env file and restart the backend." });
    if (!hasJobCapacity()) return res.status(429).json({ error: "All transcription/render workers are busy. Try again in a moment." });
    const routeId = req.params.id;
    const project = await getProject(typeof routeId === "string" ? routeId : routeId[0] ?? "");
    if (!project) return res.status(404).json({ error: "Project not found." });
    const jobId = randomUUID();
    jobs.set(jobId, { status: "queued", progress: 0, message: "Queued for transcription" });
    void transcribe(project, jobId, parsed.data.language);
    return res.status(202).json({ jobId });
  } catch (error) { return next(error); }
};
app.post("/api/projects/:id/transcribe", transcribeRoute);
app.post("/api/videos/:id/generate-captions", transcribeRoute);

app.get("/api/jobs/:id", (req, res) => {
  const job = jobs.get(req.params.id);
  return job ? res.json(job) : res.status(404).json({ error: "Job not found." });
});

app.patch("/api/projects/:id/captions", async (req, res, next) => {
  try {
    const parsed = segmentUpdateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid captions." });
    const project = await getProject(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found." });
    if (parsed.data.segments.some((segment) => segment.end > project.duration + 0.2)) {
      return res.status(400).json({ error: "Caption timing cannot extend beyond the video." });
    }
    project.segments = parsed.data.segments;
    await saveProject(project);
    return res.json(publicProject(project));
  } catch (error) { return next(error); }
});

app.post("/api/projects/:id/correct-spelling", async (req, res, next) => {
  let audioPath: string | undefined;
  const uploadedAudioNames: string[] = [];
  try {
    const parsed = spellingCorrectionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid spelling-correction request." });
    if (!gemini) return res.status(503).json({ error: "Gemini is not configured. Add GEMINI_API_KEY to the backend environment." });
    if (!hasJobCapacity()) return res.status(429).json({ error: "All transcription/render workers are busy. Try again in a moment." });
    const project = await getProject(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found." });
    const { key, captions, vocabulary } = parsed.data;
    const track = key === "original" ? project.segments : project.translations[key];
    if (!track?.length) return res.status(409).json({ error: "The selected caption track is not available." });
    const trackIndexes = new Map(track.map((caption, index) => [caption.id, index]));
    let previousIndex = -1;
    for (const caption of captions) {
      const index = trackIndexes.get(caption.id);
      if (index === undefined || index <= previousIndex ||
        caption.start !== track[index].start || caption.end !== track[index].end) {
        return res.status(409).json({ error: "Caption IDs or timestamps changed. Save the caption track and retry spelling review." });
      }
      previousIndex = index;
    }
    const binary = ffmpegPath;
    if (typeof binary !== "string") return res.status(503).json({ error: "FFmpeg is unavailable to prepare audio for spelling review." });
    audioPath = path.join(uploadDir, `${project.id}-spelling-${randomUUID()}.mp3`);
    await execFileAsync(binary, [
      "-y", "-i", project.mediaPath, "-vn", "-ac", "1", "-ar", "16000",
      "-b:a", "64k", "-f", "mp3", audioPath,
    ], { timeout: 90_000, maxBuffer: 2 * 1024 * 1024 });
    const audioStat = await stat(audioPath);
    if (!audioStat.size) return res.status(422).json({ error: "No usable audio was found for spelling review." });
    const corrected: Array<{ id: string; text: string }> = [];
    const sourceLanguage = getLanguageName(project.sourceLanguage) ?? "Telugu-English mixed";
    const batchSize = 4;
    for (let start = 0; start < captions.length; start += batchSize) {
      const batch = captions.slice(start, start + batchSize);
      const clipStart = Math.max(0, batch[0].start - 0.25);
      const clipEnd = Math.min(project.duration, batch[batch.length - 1].end + 0.25);
      const clipPath = path.join(uploadDir, `${project.id}-spelling-${randomUUID()}.mp3`);
      let uploadedName: string | undefined;
      try {
        await execFileAsync(binary, [
          "-y", "-ss", clipStart.toFixed(3), "-i", audioPath,
          "-t", Math.max(0.1, clipEnd - clipStart).toFixed(3),
          "-ac", "1", "-ar", "16000", "-b:a", "64k", "-f", "mp3", clipPath,
        ], { timeout: 30_000, maxBuffer: 2 * 1024 * 1024 });
        const uploadedAudio = await gemini.files.upload({
          file: clipPath,
          config: { mimeType: "audio/mpeg", displayName: `captionai-spelling-${project.id}.mp3` },
        });
        if (!uploadedAudio.uri || !uploadedAudio.mimeType || !uploadedAudio.name) {
          return res.status(502).json({ error: "Gemini did not return a usable audio clip for spelling review." });
        }
        uploadedName = uploadedAudio.name;
        uploadedAudioNames.push(uploadedName);
        let readyAudio: GeminiFile = uploadedAudio;
        for (let attempt = 0; readyAudio.state === "PROCESSING" && attempt < 30; attempt += 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          readyAudio = await gemini.files.get({ name: uploadedName });
        }
        if (readyAudio.state === "FAILED") return res.status(502).json({ error: "Gemini could not process an audio clip for spelling review." });
        if (readyAudio.state === "PROCESSING") return res.status(504).json({ error: "Audio preparation for spelling review timed out." });
        if (!readyAudio.uri || !readyAudio.mimeType) return res.status(502).json({ error: "Gemini did not return a usable audio clip for spelling review." });
        corrected.push(...await correctCaptionBatch(
          batch,
          vocabulary,
          { uri: readyAudio.uri, mimeType: readyAudio.mimeType },
          clipStart,
          sourceLanguage,
        ));
      } finally {
        await rm(clipPath, { force: true }).catch((error: unknown) => {
          console.error(`[spelling-correction] Could not remove audio clip: ${error instanceof Error ? error.message : String(error)}`);
        });
        if (uploadedName) {
          await gemini.files.delete({ name: uploadedName }).catch((error: unknown) => {
            console.error(`[gemini] Could not delete temporary spelling-review clip: ${error instanceof Error ? error.message : String(error)}`);
          });
          uploadedAudioNames.splice(uploadedAudioNames.indexOf(uploadedName), 1);
        }
      }
    }
    const originalById = new Map(captions.map((caption) => [caption.id, caption.text]));
    const correctionsById = new Map(corrected.map(({ id, text }) => [
      id,
      applyApprovedSpellings(originalById.get(id) ?? "", text, vocabulary),
    ]));
    let rejectedCount = 0;
    const suggestions = captions.flatMap((caption) => {
      const text = correctionsById.get(caption.id);
      if (!text || text.normalize("NFC") === caption.text.normalize("NFC")) return [];
      if (!isCorrectionWithinCaption(caption, text, captions)) {
        rejectedCount += 1;
        return [];
      }
      return [{ id: caption.id, original: caption.text, corrected: text }];
    });
    return res.json({ suggestions, rejectedCount });
  } catch (error) {
    if (error instanceof InvalidTranslationResponseError) {
      return res.status(502).json({ error: `${error.message} No captions were changed.` });
    }
    if (error instanceof ApiError) {
      const message = geminiErrorMessage(error);
      return res.status(error.status === 429 ? 429 : error.status === 401 || error.status === 403 ? 503 : error.status === 504 ? 504 : 502).json({ error: message });
    }
    return next(error);
  } finally {
    if (audioPath) await rm(audioPath, { force: true }).catch((error: unknown) => {
      console.error(`[spelling-correction] Could not remove temporary audio: ${error instanceof Error ? error.message : String(error)}`);
    });
    if (gemini) {
      await Promise.all(uploadedAudioNames.map((name) => gemini.files.delete({ name }).catch((error: unknown) => {
        console.error(`[gemini] Could not delete temporary spelling-review audio: ${error instanceof Error ? error.message : String(error)}`);
      })));
    }
  }
});

app.patch("/api/projects/:id/track", async (req, res, next) => {
  try {
    const parsed = captionTrackPatchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid caption track update." });
    const project = await getProject(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found." });
    const { key, captions } = parsed.data;
    const track = key === "original" ? project.segments : project.translations[key];
    if (!track?.length) return res.status(409).json({ error: "The selected caption track is not available." });
    if (captions.length !== track.length || captions.some((caption, index) => caption.id !== track[index].id)) {
      return res.status(400).json({ error: "Caption IDs and order must match the selected track." });
    }
    const updatedTrack = track.map((segment, index) => {
      const caption = captions[index];
      const updated = { ...segment, text: caption.text };
      if (!Object.hasOwn(caption, "style")) return updated;
      const { style: _style, ...withoutStyle } = updated;
      return caption.style ? { ...withoutStyle, style: caption.style } : withoutStyle;
    });
    if (key === "original") project.segments = updatedTrack;
    else project.translations[key] = updatedTrack;
    await saveProject(project);
    return res.json({ key, segments: updatedTrack });
  } catch (error) { return next(error); }
});

app.patch("/api/projects/:id", async (req, res, next) => {
  try {
    const parsed = z.object({ name: z.string().trim().min(1).max(100) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Project names must be between 1 and 100 characters." });
    const project = await getProject(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found." });
    project.name = parsed.data.name;
    await saveProject(project);
    return res.json(publicProject(project));
  } catch (error) { return next(error); }
});

app.post("/api/projects/:id/translate", async (req, res, _next) => {
  try {
    const parsed = translateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Choose a supported caption mode." });
    const project = await getProject(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found." });
    if (!project.segments.length) return res.status(409).json({ error: "Transcribe the video before creating translated captions." });
    const target = parsed.data.target;
    const targetLanguage = parsed.data.targetLanguage;
    const vocabulary = parsed.data.vocabulary;
    let targetKey: string = target === "teluglish-roman" ? "teluglish-roman-natural-v1" : target;
    if (target === "translation") {
      if (!targetLanguage || !transcriptionLanguageCodes.has(targetLanguage)) {
        return res.status(400).json({ error: "Choose a supported target language for translation." });
      }
      targetKey = translationStorageKey(targetLanguage);
    }
    const sourceLanguageName = getLanguageName(project.sourceLanguage) ?? "the original spoken language";
    const instruction = target === "teluglish-roman"
      ? [
        "Create a natural conversational Teluglish Roman caption track: write spoken Telugu in readable Latin-letter Telugu, while keeping spoken English words, names, places, brands, and technical terms in standard English spelling.",
        "This is a script conversion and faithful transcript cleanup, not translation. Do not translate Telugu into English or English into Telugu. Do not formalize grammar, paraphrase, expand clipped replies, remove fillers, or remove repeated words.",
        "Keep the same spoken words, order, repetitions, meaning, and punctuation. Short acknowledgements stay short. Do not add words to make a sentence more grammatical.",
        "Correct an English word recognized only as a clear phonetic approximation to its standard spelling when the caption context makes it unambiguous; do not rewrite ambiguous Telugu words as English.",
        "Use natural everyday Romanized Telugu rather than mechanical character-by-character transliteration. Romanized Telugu has multiple valid spellings; follow the supplied user preferences when the corresponding word is present in the input.",
        "Never insert a preferred name, place, brand, or phrase just because it appears in the vocabulary. Use a preference only when an alias in that entry matches this caption and the word is already present in the input.",
        "The input is recognition text, not audio. Do not guess ambiguous or missing speech; preserve uncertain wording as closely as possible. Return every caption ID exactly once, unchanged and in the same order.",
        "Output Telugu words only in Latin letters. Preserve standard English spelling and original code-switching.",
        `User spelling preferences: ${JSON.stringify(vocabulary)}`,
      ].join(" ")
      : target === "native-mix"
      ? "Convert only romanized Telugu words into native Telugu script. Write Telugu words such as mana, lo, kothaga, avuthunna, and cheyochu in Telugu script; do not leave Romanized Telugu words in Latin. Preserve clearly English words, brand names, and technical terms such as Froot Bowl, website, startup, business, and trending in Latin. Keep words already written in Telugu script unchanged. Do not translate, paraphrase, or change the spoken wording or order."
      : target === "roman"
      ? project.sourceLanguage?.startsWith("en")
        ? "Translate each caption into natural Telugu written in Latin letters. Do not use Telugu script."
        : "Transliterate each Telugu caption into natural Telugu written in Latin letters. Do not translate it."
      : target === "english-translation"
        ? "Translate each caption into natural English."
        : target === "telugu-translation"
          ? "Translate each caption into natural Telugu using native Telugu script."
          : target === "bilingual"
            ? "For each caption, return English followed by Telugu in native script, separated by a newline."
            : `Translate each caption into natural ${getLanguageName(targetLanguage) ?? "selected-language"} using its standard writing system.`;
    const translationInstruction = target === "teluglish-roman"
      ? `${instruction} Source language context: ${sourceLanguageName}.`
      : target === "native-mix"
      ? `${instruction} Source language context: ${sourceLanguageName}. This is a script-conversion operation, not a translation.`
      : target === "bilingual"
      ? `${instruction} The source language is ${sourceLanguageName}. Return English and Telugu on separate lines.`
      : instruction;
    const result = project.segments.map((segment) => ({ ...segment }));
    const nonEmptySegments = result
      .map((segment, index) => ({ segment, index }))
      .filter(({ segment }) => segment.text.trim().length > 0);
    if (!nonEmptySegments.length) return res.status(409).json({ error: "There are no non-empty captions to translate." });
    const segmentsToTransform = target === "native-mix"
      ? nonEmptySegments.filter(({ segment }) => !/[\u0c00-\u0c7f]/u.test(segment.text))
      : nonEmptySegments;
    if (segmentsToTransform.length && !gemini) return res.status(503).json({ error: "Gemini is not configured. Add GEMINI_API_KEY=... to the root .env file and restart the backend." });
    const translated: Array<{ id: string; text: string }> = [];
    for (let start = 0; start < segmentsToTransform.length; start += 12) {
      translated.push(...await translateCaptions(
        segmentsToTransform.slice(start, start + 12).map(({ segment }) => segment),
        translationInstruction,
        sourceLanguageName,
      ));
    }
    const translationsById = new Map(translated.map(({ id, text }) => [id, text]));
    segmentsToTransform.forEach(({ segment, index }) => {
      const text = translationsById.get(segment.id);
      if (!text) throw new InvalidTranslationResponseError("A caption translation was missing.");
      result[index] = { ...segment, text };
    });
    if (target === "teluglish-roman" && result.some((segment) => /[\u0c00-\u0c7f]/u.test(segment.text))) {
      throw new InvalidTranslationResponseError("Gemini left Telugu-script characters in the Romanized Teluglish track.");
    }
    project.translations[targetKey] = result;
    await saveProject(project);
    return res.json({ segments: result, key: targetKey });
  } catch (error) {
    if (error instanceof InvalidTranslationResponseError) {
      return res.status(502).json({ error: `${error.message} No translated captions were saved.` });
    }
    console.error(`[translation] ${req.method} ${req.originalUrl}: ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
    if (error instanceof ApiError) {
      const message = geminiErrorMessage(error);
      return res.status(error.status === 429 ? 429 : error.status === 401 || error.status === 403 ? 503 : 502).json({ error: message });
    }
    return res.status(502).json({ error: "Caption conversion failed before anything was saved. Check the backend log for the model or storage error." });
  }
});

app.post("/api/projects/:id/auto-trim", async (req, res, next) => {
  try {
    const project = await getProject(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found." });
    const suggestions: Array<{ id: string; start: number; end: number; reason: string; accepted: false }> = [];
    for (let index = 0; index < project.segments.length - 1; index += 1) {
      const current = project.segments[index];
      const next = project.segments[index + 1];
      if (next.start - current.end >= 1.2) {
        suggestions.push({ id: randomUUID(), start: current.end, end: next.start, reason: "Long pause", accepted: false });
      }
    }
    for (const segment of project.segments) {
      for (let index = 0; index < (segment.words?.length ?? 0); index += 1) {
        const word = segment.words![index];
        if (/\b(um+|uh+|erm|hmm+)\b/i.test(word.text)) {
          suggestions.push({ id: randomUUID(), start: word.start, end: word.end, reason: `Possible filler word: ${word.text}`, accepted: false });
        }
        const prior = segment.words?.[index - 1];
        if (prior && prior.text.replace(/[^\p{L}\p{N}]/gu, "").toLowerCase() === word.text.replace(/[^\p{L}\p{N}]/gu, "").toLowerCase()) {
          suggestions.push({ id: randomUUID(), start: word.start, end: word.end, reason: `Repeated word: ${word.text}`, accepted: false });
        }
      }
    }
    return res.json({ suggestions });
  } catch (error) { return next(error); }
});

const exportSchema = z.object({
  mode: z.enum(["original", "english", "telugu", "roman", "teluglish-roman", "native-mix", "english-translation", "telugu-translation", "bilingual", "translation"]).default("original"),
  targetLanguage: z.string().optional(),
  format: z.enum(["mp4", "srt", "vtt", "txt"]).default("mp4"),
  aspectRatio: z.enum(["original", "9:16", "1:1", "16:9"]).default("original"),
  resolution: z.enum(["720p", "1080p"]).default("1080p"),
  cuts: z.array(z.object({ start: z.number().nonnegative(), end: z.number().positive() })).max(100).default([]),
  style: z.object({
    fontFamily: z.string().max(100).default("Arial"),
    fontSize: z.number().min(12).max(120).default(48),
    textColor: z.string().regex(/^#[\da-f]{6}$/i).default("#ffffff"),
    backgroundColor: z.string().regex(/^#[\da-f]{6}$/i).default("#111111"),
    backgroundOpacity: z.number().min(0).max(1).default(0.65),
    outlineColor: z.string().regex(/^#[\da-f]{6}$/i).default("#111111"),
    outlineWidth: z.number().min(0).max(8).default(2),
    highlightColor: z.string().regex(/^#[\da-f]{6}$/i).default("#c7fa56"),
    weight: z.enum(["normal", "bold"]).default("bold"),
    italic: z.boolean().default(false),
    position: z.enum(["top", "center", "bottom"]).default("bottom"),
    positionX: z.number().min(-100).max(200).default(50),
    positionY: z.number().min(-100).max(200).default(75),
    scale: z.number().min(0.2).max(4.0).default(1),
    rotation: z.number().min(-360).max(360).default(0),
    opacity: z.number().min(0).max(1).default(1),
    shadowColor: z.string().regex(/^#[\da-f]{6}$/i).default("#000000"),
    shadowBlur: z.number().min(0).max(30).default(3),
    glowColor: z.string().regex(/^#[\da-f]{6}$/i).default("#d2fa56"),
    glowRadius: z.number().min(0).max(50).default(0),
    lineSpacing: z.number().min(0.5).max(3).default(1.2),
    maxWidth: z.number().min(30).max(100).default(90),
    letterSpacing: z.number().min(-1).max(2).optional(),
    maxLines: z.number().int().min(1).max(10).optional(),
    fontWeight: z.union([z.literal(100), z.literal(200), z.literal(300), z.literal(400), z.literal(500), z.literal(600), z.literal(700), z.literal(800), z.literal(900)]).optional(),
    textGradient: z.boolean().optional(),
    gradientStart: z.string().regex(/^#[\da-f]{6}$/i).optional(),
    gradientEnd: z.string().regex(/^#[\da-f]{6}$/i).optional(),
    entranceAnimation: z.enum(["none", "fade-in", "slide-up", "slide-down", "slide-left", "slide-right", "pop-in", "zoom-in", "bounce-in", "typewriter", "word-reveal", "letter-reveal", "stagger-words", "blur-clear", "rotate-in", "elastic-in"]).optional(),
    exitAnimation: z.enum(["none", "fade-out", "slide-up-out", "slide-down-out", "slide-left-out", "slide-right-out", "zoom-out", "pop-out", "rotate-out", "blur-out"]).optional(),
    continuousAnimation: z.enum(["none", "pulse", "floating", "gentle-bounce", "breathing-scale", "neon-glow", "karaoke", "active-word", "subtle-shake", "looping-highlight"]).optional(),
    animationDuration: z.number().min(50).max(5000).optional(),
    animationDelay: z.number().min(0).max(5000).optional(),
    animationIntensity: z.number().min(0).max(2).optional(),
    animationEasing: z.enum(["linear", "ease-in", "ease-out", "ease-in-out"]).optional(),
    animationLoop: z.boolean().optional(),
    karaoke: z.boolean().default(false),
    alignment: z.enum(["left", "center", "right"]).default("center"),
    cinematic: z.boolean().default(false),
    scriptFontFamily: z.enum(["Segoe Script", "Georgia", "Arial", "Impact", "Nirmala UI"]).default("Segoe Script"),
    headlineFontFamily: z.enum(["Georgia", "Arial", "Impact", "Nirmala UI"]).default("Impact"),
    scriptColor: z.string().regex(/^#[\da-f]{6}$/i).default("#fff7ed"),
    headlineColor: z.string().regex(/^#[\da-f]{6}$/i).default("#ff3434"),
    scriptFontSize: z.number().min(18).max(160).default(76),
    headlineFontSize: z.number().min(18).max(160).default(64),
    scriptRotation: z.number().min(-360).max(360).default(-4),
    animation: z.enum(["none", "fade", "pop", "slide", "zoom", "bounce", "custom"]).default("pop"),
    topBannerText: z.string().max(200).optional(),
    bottomBannerText: z.string().max(200).optional(),
  }).default({
    fontFamily: "Arial",
    fontSize: 48,
    textColor: "#ffffff",
    backgroundColor: "#111111",
    backgroundOpacity: 0.65,
    outlineColor: "#111111",
    outlineWidth: 2,
    highlightColor: "#c7fa56",
    weight: "bold",
    italic: false,
    position: "bottom",
    positionX: 50,
    positionY: 75,
    scale: 1,
    rotation: 0,
    opacity: 1,
    shadowColor: "#000000",
    shadowBlur: 3,
    glowColor: "#d2fa56",
    glowRadius: 0,
    lineSpacing: 1.2,
    maxWidth: 90,
    karaoke: false,
    alignment: "center",
    cinematic: false,
    scriptFontFamily: "Segoe Script",
    headlineFontFamily: "Impact",
    scriptColor: "#fff7ed",
    headlineColor: "#ff3434",
    scriptFontSize: 76,
    headlineFontSize: 64,
    scriptRotation: -4,
    animation: "pop",
  }),
});

function runFfmpeg(args: string[], jobId: string, duration: number): Promise<void> {
  const binary = ffmpegPath;
  if (typeof binary !== "string") return Promise.reject(new Error("FFmpeg is unavailable. Install FFmpeg to render MP4 exports."));
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    let pendingOutput = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      pendingOutput += chunk;
      const lines = pendingOutput.split(/\r?\n/);
      pendingOutput = lines.pop() ?? "";
      const match = lines.join("\n").match(/out_time_ms=(\d+)/);
      if (match) {
        const job = jobs.get(jobId);
        if (job) {
          job.progress = Math.min(98, 5 + Math.round((Number(match[1]) / 1_000_000 / duration) * 90));
          job.message = "Rendering captions into video";
        }
      }
    });
    child.stderr.on("data", (chunk: Buffer) => { stderr = `${stderr}${chunk.toString("utf8")}`.slice(-8000); });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve() : reject(new Error(`FFmpeg render failed${stderr ? `: ${stderr.trim().slice(-1000)}` : "."}`)));
  });
}

function toTimestamp(seconds: number, vtt = false): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.round((seconds - Math.floor(seconds)) * 1000);
  return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}${vtt ? "." : ","}${String(millis).padStart(3, "0")}`;
}

function subtitleContents(segments: CaptionSegment[], format: "srt" | "vtt" | "txt"): string {
  if (format === "txt") return `${segments.map((segment) => segment.text).join("\n")}\n`;
  const vtt = format === "vtt";
  const cues = segments.map((segment, index) =>
    `${vtt ? "" : `${index + 1}\n`}${toTimestamp(segment.start, vtt)} --> ${toTimestamp(segment.end, vtt)}\n${segment.text}\n`,
  ).join("\n");
  return `${vtt ? "WEBVTT\n\n" : ""}${cues}`;
}

function assText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/{/g, "\\{").replace(/}/g, "\\}").replace(/\r?\n/g, "\\N");
}

function assPrimaryColor(hex: string): string {
  const rgb = hex.slice(1).match(/.{2}/g) ?? ["00", "00", "00"];
  return `&H${[...rgb].reverse().join("")}`;
}

function latinUppercase(value: string): string {
  return value.replace(/\p{Script=Latin}+/gu, (latin) => latin.toUpperCase());
}

function captionWordsMatchText(segment: CaptionSegment): boolean {
  if (!segment.words?.length) return false;
  const wordText = segment.words.map((word) => word.text).join(" ").replace(/\s+([,!.?])/g, "$1");
  return wordText.normalize("NFC") === segment.text.trim().normalize("NFC");
}

function buildAssSubtitles(
  segments: CaptionSegment[],
  baseStyle: z.infer<typeof exportSchema>["style"],
  preserveLayerOverrides: boolean,
  resolution: "720p" | "1080p",
  aspectRatio: "original" | "9:16" | "1:1" | "16:9",
  origWidth?: number,
  origHeight?: number,
): string {
  const style = baseStyle;
  const size = resolution === "720p" ? 720 : 1080;
  let playResX = origWidth ?? (resolution === "720p" ? 1280 : 1920);
  let playResY = origHeight ?? (resolution === "720p" ? 720 : 1080);

  if (aspectRatio === "9:16") {
    playResX = Math.round((size * 9) / 16);
    playResY = size;
  } else if (aspectRatio === "1:1") {
    playResX = size;
    playResY = size;
  } else if (aspectRatio === "16:9") {
    playResX = Math.round((size * 16) / 9);
    playResY = size;
  }

  const assTimestamp = (seconds: number) => {
    const safe = Math.max(0, seconds);
    const centiseconds = Math.floor((safe - Math.floor(safe)) * 100);
    return `${Math.floor(safe / 3600)}:${String(Math.floor(safe / 60) % 60).padStart(2, "0")}:${String(Math.floor(safe) % 60).padStart(2, "0")}.${String(centiseconds).padStart(2, "0")}`;
  };

  const events: string[] = [];
  const styleDefinitions: string[] = [];
  const styleNames = new Map<string, string>();
  type ExportStyle = typeof style;
  const styleKey = (captionStyle: ExportStyle) => JSON.stringify([
    captionStyle.fontFamily, captionStyle.fontSize, captionStyle.textColor, captionStyle.highlightColor,
    captionStyle.outlineColor, captionStyle.backgroundColor, captionStyle.backgroundOpacity,
    captionStyle.fontWeight ?? captionStyle.weight, captionStyle.italic, captionStyle.outlineWidth,
    captionStyle.shadowBlur, captionStyle.alignment, captionStyle.maxWidth,
  ]);
  const registerStyle = (name: string, captionStyle: ExportStyle) => {
    const alignment = captionStyle.alignment === "left" ? 4 : captionStyle.alignment === "right" ? 6 : 5;
    const margin = Math.round(playResX * (100 - captionStyle.maxWidth) / 200);
    styleDefinitions.push(
      `Style: ${name},${captionStyle.fontFamily},${captionStyle.fontSize},${assPrimaryColor(captionStyle.textColor)},${assPrimaryColor(captionStyle.highlightColor)},${assPrimaryColor(captionStyle.outlineColor)},${assColor(captionStyle.backgroundColor, captionStyle.backgroundOpacity)},${(captionStyle.fontWeight ?? (captionStyle.weight === "bold" ? 700 : 400)) >= 600 ? -1 : 0},${captionStyle.italic ? -1 : 0},${captionStyle.backgroundOpacity > 0 ? 3 : 1},${captionStyle.outlineWidth},${captionStyle.shadowBlur ? Math.min(10, Math.round(captionStyle.shadowBlur / 2)) : 0},${alignment},${margin},${margin},40,1`,
    );
  };
  const baseStyleKey = styleKey(style);
  styleNames.set(baseStyleKey, "Default");
  registerStyle("Default", style);
  const styleNameFor = (captionStyle: ExportStyle) => {
    const key = styleKey(captionStyle);
    const existing = styleNames.get(key);
    if (existing) return existing;
    const name = `Theme${styleNames.size}`;
    styleNames.set(key, name);
    registerStyle(name, captionStyle);
    return name;
  };

  for (const segment of segments) {
    if (segment.visible === false) continue;
    const style: ExportStyle = exportSchema.shape.style.parse({ ...baseStyle, ...(segment.style ?? {}) });
    const styleName = styleNameFor(style);
    const alignment = style.alignment === "left" ? 4 : style.alignment === "right" ? 6 : 5;

    // 1. Cinematic Multi-Layer Caption
    if (style.cinematic) {
      const words = preserveLayerOverrides && captionWordsMatchText(segment)
        ? segment.words?.map((word) => word.text) ?? segment.text.trim().split(/\s+/u)
        : segment.text.trim().split(/\s+/u);
      const splitAt = Math.max(1, Math.ceil(words.length / 3));
      const hasLayerOverrides = Boolean(segment.scriptText?.trim() || segment.headlineText?.trim());
      const script = preserveLayerOverrides && hasLayerOverrides
        ? segment.scriptText ?? words.slice(0, splitAt).join(" ")
        : words.slice(0, splitAt).join(" ");
      const headline = latinUppercase(preserveLayerOverrides && hasLayerOverrides
        ? segment.headlineText ?? words.slice(splitAt).join(" ")
        : words.slice(splitAt).join(" "));

      const segPosX = segment.positionX ?? style.positionX;
      const segPosY = segment.positionY ?? style.positionY;
      const segScale = segment.scale ?? style.scale;
      const segRot = segment.rotation ?? style.scriptRotation;

      const posX = Math.round((segPosX / 100) * playResX);
      const posY = Math.round((segPosY / 100) * playResY);
      const compositionScale = playResX / 1920;
      const scriptFontSize = Math.round((style.scriptFontSize || 76) * segScale * compositionScale);
      const headlineFontSize = Math.round((style.headlineFontSize || 64) * segScale * compositionScale);
      const scriptFont = /[\u0C00-\u0C7F]/u.test(script) ? "Nirmala UI" : style.scriptFontFamily;
      const headlineFont = /[\u0C00-\u0C7F]/u.test(headline) ? "Nirmala UI" : style.headlineFontFamily;
      const layerShadow = `\\shad${Math.min(10, Math.round((style.shadowBlur ?? 0) / 2))}\\4c${assColor(style.shadowColor ?? "#000000", 1)}`;

      const animationAt = (y: number) => style.animation === "fade"
        ? "\\fad(180,120)"
        : style.animation === "slide"
          ? `\\move(${posX},${y + 45},${posX},${y},0,240)`
          : "\\fscx115\\fscy115\\t(0,150,\\fscx100\\fscy100)";

      if (script.trim()) {
        const text = `{${`\\an${alignment}\\pos(${posX},${posY})\\fn${scriptFont}\\fs${scriptFontSize}\\1c${assOverrideColor(style.scriptColor)}\\bord${style.outlineWidth}\\3c${assOverrideColor(style.outlineColor)}${layerShadow}\\frz${segRot}${animationAt(posY)}}`}${assText(script)}`;
        events.push(`Dialogue: 0,${assTimestamp(segment.start)},${assTimestamp(segment.end)},${styleName},,0,0,0,,${text}`);
      }
      if (headline.trim()) {
        const headlineY = posY + Math.round(135 * segScale * compositionScale);
        const text = `{${`\\an${alignment}\\pos(${posX},${headlineY})\\fn${headlineFont}\\fs${headlineFontSize}\\1c${assOverrideColor(style.headlineColor)}\\bord${style.outlineWidth}\\3c${assOverrideColor(style.outlineColor)}${layerShadow}${animationAt(headlineY)}}`}${assText(headline)}`;
        events.push(`Dialogue: 0,${assTimestamp(segment.start)},${assTimestamp(segment.end)},${styleName},,0,0,0,,${text}`);
      }
      continue;
    }

    // 2. Custom Layers on Segment
    if (segment.layers && segment.layers.length > 0) {
      for (const layer of segment.layers) {
        if (!layer.visible || !layer.text.trim()) continue;
        const font = layer.fontFamily || (segment.text.match(/[\u0C00-\u0C7F]/) ? "Nirmala UI" : style.fontFamily);
        const fs = Math.round((layer.fontSize || style.fontSize) * (layer.scale ?? 1));
        const color = assOverrideColor(layer.textColor || style.textColor);
        const outlineCol = assOverrideColor(layer.outlineColor || style.outlineColor);
        const outlineW = layer.outlineWidth ?? style.outlineWidth;
        const lX = Math.round(((layer.positionX ?? 50) / 100) * playResX);
        const lY = Math.round(((layer.positionY ?? 75) / 100) * playResY);
        const lRot = Math.round(layer.rotation ?? 0);
        const text = `{\\an5\\pos(${lX},${lY})\\fn${font}\\fs${fs}\\1c${color}\\bord${outlineW}\\3c${outlineCol}\\shad3\\frz${-lRot}}${assText(layer.text)}`;
        events.push(`Dialogue: 0,${assTimestamp(segment.start)},${assTimestamp(segment.end)},${styleName},,0,0,0,,${text}`);
      }
      continue;
    }

    // 3. Standard & Keyframe Animated Captions
    const font = segment.text.match(/[\u0C00-\u0C7F]/) ? "Nirmala UI" : style.fontFamily;
    const baseFontSize = Math.round(style.fontSize * (segment.scale ?? style.scale));
    const textColor = assOverrideColor(style.textColor);
    const outlineColor = assOverrideColor(style.outlineColor);
    const outlineW = style.outlineWidth;
    const shadowColor = assOverrideColor(style.shadowColor ?? "#000000");
    const shadowDepth = style.shadowBlur ? Math.min(10, Math.round(style.shadowBlur / 2)) : 0;
    const blurTag = style.glowRadius && style.glowRadius > 0 ? `\\blur${Math.min(10, style.glowRadius)}` : "";

    const keyframes = segment.animation?.enabled ? segment.animation.keyframes : undefined;
    if (keyframes && keyframes.length > 1) {
      const sorted = [...keyframes].sort((a, b) => a.time - b.time);

      for (let i = 0; i < sorted.length - 1; i++) {
        const kA = sorted[i];
        const kB = sorted[i + 1];
        const tA = Math.max(segment.start, Math.min(segment.end, kA.time));
        const tB = Math.max(segment.start, Math.min(segment.end, kB.time));

        if (tB > tA) {
          const x1 = Math.round((kA.positionX / 100) * playResX);
          const y1 = Math.round((kA.positionY / 100) * playResY);
          const x2 = Math.round((kB.positionX / 100) * playResX);
          const y2 = Math.round((kB.positionY / 100) * playResY);
          const durMs = Math.round((tB - tA) * 1000);
          const scaleA = Math.round(kA.scale * 100);
          const scaleB = Math.round(kB.scale * 100);
          const rotA = Math.round(kA.rotation);
          const rotB = Math.round(kB.rotation);
          const alphaA = Math.round((1 - kA.opacity) * 255).toString(16).padStart(2, "0").toUpperCase();
          const alphaB = Math.round((1 - kB.opacity) * 255).toString(16).padStart(2, "0").toUpperCase();

          const tags = `\\an5\\fn${font}\\fs${baseFontSize}\\1c${textColor}\\bord${outlineW}\\3c${outlineColor}\\shad${shadowDepth}\\4c${shadowColor}${blurTag}\\alpha&H${alphaA}&\\fscx${scaleA}\\fscy${scaleA}\\frz${-rotA}\\move(${x1},${y1},${x2},${y2},0,${durMs})\\t(0,${durMs},\\alpha&H${alphaB}&\\fscx${scaleB}\\fscy${scaleB}\\frz${-rotB})`;
          events.push(`Dialogue: 0,${assTimestamp(tA)},${assTimestamp(tB)},${styleName},,0,0,0,,{${tags}}${assText(segment.text)}`);
        }
      }
    } else {
      // Static or single keyframe or preset animation
      const singleKf = keyframes && keyframes.length === 1 ? keyframes[0] : null;
      const posX = singleKf ? singleKf.positionX : (segment.positionX ?? style.positionX);
      const posY = singleKf ? singleKf.positionY : (segment.positionY ?? style.positionY);
      const scaleVal = singleKf ? singleKf.scale : (segment.scale ?? style.scale);
      const rotVal = singleKf ? singleKf.rotation : (segment.rotation ?? style.rotation);
      const opVal = singleKf ? singleKf.opacity : (segment.opacity ?? style.opacity);

      const x = Math.round((posX / 100) * playResX);
      const y = Math.round((posY / 100) * playResY);
      const scalePct = Math.round(scaleVal * 100);
      const alphaHex = Math.round((1 - opVal) * 255).toString(16).padStart(2, "0").toUpperCase();

      const animationMs = Math.max(50, Math.min(style.animationDuration ?? 300, Math.round((segment.end - segment.start) * 1000 / 2)));
      const entrance = style.entranceAnimation ?? (style.animation === "fade" ? "fade-in" : style.animation === "slide" ? "slide-up" : style.animation === "pop" ? "pop-in" : "none");
      const exit = style.exitAnimation ?? "none";
      const entranceAnim = entrance === "fade-in"
        ? `\\alpha&HFF&\\t(0,${animationMs},\\alpha&H${alphaHex}&)`
        : entrance === "slide-up" ? `\\move(${x},${y + 36},${x},${y},0,${animationMs})`
          : entrance === "slide-down" ? `\\move(${x},${y - 36},${x},${y},0,${animationMs})`
            : entrance === "slide-left" ? `\\move(${x + 48},${y},${x},${y},0,${animationMs})`
              : entrance === "slide-right" ? `\\move(${x - 48},${y},${x},${y},0,${animationMs})`
                : entrance === "pop-in" || entrance === "zoom-in" || entrance === "bounce-in"
                  ? `\\fscx${Math.round(scalePct * 0.78)}\\fscy${Math.round(scalePct * 0.78)}\\t(0,${animationMs},\\fscx${scalePct}\\fscy${scalePct})`
                  : entrance === "blur-clear" ? `\\blur8\\t(0,${animationMs},\\blur0)`
                    : entrance === "rotate-in" ? `\\frz${-Math.round(rotVal + 10)}\\t(0,${animationMs},\\frz${-Math.round(rotVal)})`
                      : `\\fscx${scalePct}\\fscy${scalePct}`;
      const exitAnim = exit === "fade-out"
        ? `\\t(${Math.max(0, Math.round((segment.end - segment.start) * 1000) - animationMs)},${Math.round((segment.end - segment.start) * 1000)},\\alpha&HFF&)`
        : "";
      const letterSpacing = style.letterSpacing ? `\\fsp${Math.round(style.letterSpacing * baseFontSize)}` : "";
      const backgroundOverride = `\\4c${assColor(style.backgroundColor, style.backgroundOpacity)}`;
      const tags = `\\an5\\pos(${x},${y})\\fn${font}\\fs${baseFontSize}\\b${(style.fontWeight ?? (style.weight === "bold" ? 700 : 400)) >= 600 ? -1 : 0}\\i${style.italic ? -1 : 0}${letterSpacing}\\1c${textColor}\\bord${outlineW}\\3c${outlineColor}\\shad${shadowDepth}${backgroundOverride}${blurTag}\\alpha&H${alphaHex}&\\frz${-Math.round(rotVal)}${entranceAnim}${exitAnim}`;
      if ((style.karaoke || style.continuousAnimation === "karaoke" || style.continuousAnimation === "active-word") && !keyframes?.length && captionWordsMatchText(segment)) {
        const words = segment.words ?? [];
        const highlightColor = assOverrideColor(style.highlightColor);
        const karaokeTags = tags.replace(entranceAnim, "");
        const captionForWord = (activeWordId?: string) => words.map((word) =>
          word.id === activeWordId
            ? `{\\1c${highlightColor}}${assText(word.text)}{\\1c${textColor}}`
            : assText(word.text),
        ).join(" ");
        const appendCaption = (start: number, end: number, activeWordId?: string) => {
          if (end <= start) return;
          events.push(`Dialogue: 0,${assTimestamp(start)},${assTimestamp(end)},${styleName},,0,0,0,,{${karaokeTags}}${captionForWord(activeWordId)}`);
        };
        let cursor = segment.start;
        for (const word of words) {
          const wordStart = Math.max(cursor, segment.start, word.start);
          const wordEnd = Math.min(segment.end, word.end);
          appendCaption(cursor, wordStart);
          appendCaption(wordStart, wordEnd, word.id);
          cursor = Math.max(cursor, wordEnd);
        }
        appendCaption(cursor, segment.end);
      } else {
        events.push(`Dialogue: 0,${assTimestamp(segment.start)},${assTimestamp(segment.end)},${styleName},,0,0,0,,{${tags}}${assText(segment.text)}`);
      }
    }
  }

  if (style.topBannerText?.trim()) {
    const bannerFs = Math.round(playResY * 0.04);
    const text = `{\\an8\\pos(${Math.round(playResX / 2)},${Math.round(playResY * 0.03)})\\fnArial\\fs${bannerFs}\\1c&H00D7FF&\\bord2\\3c&H000000&\\shad2}${assText(style.topBannerText.trim())}`;
    events.unshift(`Dialogue: 1,0:00:00.00,9:59:59.00,Default,,0,0,0,,${text}`);
  }
  if (style.bottomBannerText?.trim()) {
    const bannerFs = Math.round(playResY * 0.038);
    const text = `{\\an2\\pos(${Math.round(playResX / 2)},${Math.round(playResY * 0.97)})\\fnArial\\fs${bannerFs}\\1c&H00D7FF&\\bord2\\3c&H000000&\\shad2}${assText(style.bottomBannerText.trim())}`;
    events.push(`Dialogue: 1,0:00:00.00,9:59:59.00,Default,,0,0,0,,${text}`);
  }

  return [
    "[Script Info]",
    "ScriptType: v4.00+",
    `PlayResX: ${playResX}`,
    `PlayResY: ${playResY}`,
    "ScaledBorderAndShadow: yes",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    ...styleDefinitions,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ...events,
    "",
  ].join("\n");
}

function assColor(hex: string, opacity: number): string {
  const alpha = Math.round((1 - opacity) * 255).toString(16).padStart(2, "0");
  const rgb = hex.slice(1).match(/.{2}/g) ?? ["00", "00", "00"];
  return `&H${alpha}${rgb.reverse().join("")}`;
}

function escapeFilterPath(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'").replace(/,/g, "\\,");
}

app.post("/api/projects/:id/export", async (req, res, next) => {
  try {
    const parsed = exportSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid export settings." });
    const project = await getProject(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found." });
    const { mode, targetLanguage, format, aspectRatio, resolution, style } = parsed.data;
    if (mode === "translation" && (!targetLanguage || !transcriptionLanguageCodes.has(targetLanguage))) {
      return res.status(400).json({ error: "Choose a supported target language for translation." });
    }
    const segments = mode === "original" || mode === "english" || mode === "telugu"
      ? project.segments
      : mode === "translation" && targetLanguage
        ? project.translations[translationStorageKey(targetLanguage)]
        : mode === "teluglish-roman"
          ? project.translations["teluglish-roman-natural-v1"]
          : project.translations[mode];
    if (!segments?.length) return res.status(409).json({ error: "Generate captions for the selected language mode before exporting." });
    if (format === "mp4" && !hasJobCapacity()) return res.status(429).json({ error: "All transcription/render workers are busy. Try again in a moment." });
    if (parsed.data.cuts.some((cut) => cut.end > project.duration || cut.start >= cut.end)) {
      return res.status(400).json({ error: "A trim suggestion is outside the video bounds." });
    }
    const sortedCuts = [...parsed.data.cuts].sort((left, right) => left.start - right.start);
    const cuts: Array<{ start: number; end: number }> = [];
    for (const cut of sortedCuts) {
      const previous = cuts[cuts.length - 1];
      if (previous && cut.start <= previous.end) previous.end = Math.max(previous.end, cut.end);
      else cuts.push({ ...cut });
    }
    const keptIntervals: Array<{ start: number; end: number }> = [];
    let cursor = 0;
    for (const cut of cuts) {
      if (cut.start > cursor) keptIntervals.push({ start: cursor, end: cut.start });
      cursor = Math.max(cursor, cut.end);
    }
    if (cursor < project.duration) keptIntervals.push({ start: cursor, end: project.duration });
    if (cuts.length && !keptIntervals.length) return res.status(400).json({ error: "At least some video must remain after trimming." });
    const removeBefore = (time: number) => cuts.reduce((removed, cut) =>
      removed + (time >= cut.end ? cut.end - cut.start : time > cut.start ? time - cut.start : 0), 0);
    const finalSegments = segments.map((segment) => {
      const trimmedWords = segment.words?.filter((word) => !cuts.some((cut) => cut.start < word.end && cut.end > word.start));
      const removedWord = Boolean(segment.words?.length && trimmedWords && trimmedWords.length < segment.words.length);
      return {
        ...segment,
        start: Math.max(0, segment.start - removeBefore(segment.start)),
        end: Math.max(0, segment.end - removeBefore(segment.end)),
        ...(removedWord && trimmedWords ? {
          text: trimmedWords.map((word) => word.text).join(" ").replace(/\s+([,!.?])/g, "$1"),
        } : {}),
      };
    }).filter((segment) => segment.end > segment.start && segment.text.trim().length > 0);
    const outputPath = path.join(exportDir, `${project.id}-${Date.now()}.${format}`);
    if (format !== "mp4") {
      await writeFile(outputPath, subtitleContents(finalSegments, format), "utf8");
      return res.json({ url: `/api/projects/${project.id}/download/${path.basename(outputPath)}` });
    }
    if (!ffmpegPath) return res.status(503).json({ error: "FFmpeg is unavailable. Install FFmpeg to render MP4 exports." });
    let origWidth: number | undefined;
    let origHeight: number | undefined;
    try {
      if (ffprobe.path) {
        const { stdout } = await execFileAsync(ffprobe.path, [
          "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "json", project.mediaPath,
        ]);
        const p = JSON.parse(stdout) as { streams?: Array<{ width?: number; height?: number }> };
        if (p.streams?.[0]?.width && p.streams?.[0]?.height) {
          origWidth = p.streams[0].width;
          origHeight = p.streams[0].height;
        }
      }
    } catch (probeErr) {
      console.warn("[export] Could not probe video dimensions:", probeErr);
    }
    const subtitlePath = path.join(exportDir, `${project.id}-${Date.now()}.ass`);
    await writeFile(subtitlePath, buildAssSubtitles(finalSegments, style, segments === project.segments, resolution, aspectRatio, origWidth, origHeight), "utf8");
    const size = resolution === "720p" ? 720 : 1080;
    const dimensions = aspectRatio === "9:16" ? `${Math.round(size * 9 / 16)}:${size}` : aspectRatio === "1:1" ? `${size}:${size}` : aspectRatio === "16:9" ? `${Math.round(size * 16 / 9)}:${size}` : "0:0";
    const escapedSubs = escapeFilterPath(subtitlePath);
    const subtitleFilter = `subtitles=filename='${escapedSubs}'`;
    const scaledFilter = aspectRatio === "original" ? subtitleFilter
      : `scale=${dimensions}:force_original_aspect_ratio=decrease,pad=${dimensions}:(ow-iw)/2:(oh-ih)/2,${subtitleFilter}`;
    const filterComplex = cuts.length ? [
      ...keptIntervals.map((interval, index) =>
        `[0:v]trim=start=${interval.start}:end=${interval.end},setpts=PTS-STARTPTS[v${index}];` +
        `[0:a]atrim=start=${interval.start}:end=${interval.end},asetpts=PTS-STARTPTS[a${index}]`,
      ),
      `${keptIntervals.map((_interval, index) => `[v${index}][a${index}]`).join("")}concat=n=${keptIntervals.length}:v=1:a=1[vc][ac]`,
      `[vc]${scaledFilter}[vout]`,
    ].join(";") : "";
    const args = cuts.length
      ? [
          "-y", "-i", project.mediaPath, "-filter_complex",
          filterComplex,
          "-map", "[vout]", "-map", "[ac]", "-progress", "pipe:1", "-nostats", "-c:v", "libx264", "-preset", "veryfast",
          "-crf", "20", "-c:a", "aac", "-movflags", "+faststart", outputPath,
        ]
      : [
          "-y", "-i", project.mediaPath, "-vf", scaledFilter, "-progress", "pipe:1", "-nostats",
          "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-c:a", "aac", "-movflags", "+faststart", outputPath,
        ];
    const jobId = randomUUID();
    jobs.set(jobId, { status: "processing", progress: 1, message: "Preparing video render" });
    void (async () => {
      try {
        await runFfmpeg(args, jobId, project.duration);
        const job = jobs.get(jobId);
        if (job) {
          job.status = "completed";
          job.progress = 100;
          job.message = "Captioned video is ready";
          job.resultUrl = `/api/projects/${project.id}/download/${path.basename(outputPath)}`;
        }
      } catch (error) {
        await rm(outputPath, { force: true });
        const job = jobs.get(jobId);
        if (job) {
          job.status = "failed";
          job.message = "Video render failed";
          job.error = error instanceof Error ? error.message : "Video render failed.";
        }
      } finally { await rm(subtitlePath, { force: true }); }
    })();
    return res.status(202).json({ jobId });
  } catch (error) { return next(error); }
});

app.get("/api/projects/:id/download/:filename", async (req, res, next) => {
  try {
    const project = await getProject(req.params.id);
    const filename = req.params.filename;
    if (!project || !filename.startsWith(`${project.id}-`) || path.basename(filename) !== filename) {
      return res.status(404).json({ error: "Download not found." });
    }
    const filePath = path.join(exportDir, filename);
    return res.download(filePath, (error) => {
      if (error && !res.headersSent) next(error);
    });
  } catch (error) { return next(error); }
});

app.delete("/api/projects/:id", async (req, res, next) => {
  try {
    const project = await getProject(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found." });
    await rm(project.mediaPath, { force: true });
    const exports = await readdir(exportDir);
    await Promise.all(exports.filter((filename) => filename.startsWith(`${project.id}-`)).map((filename) =>
      rm(path.join(exportDir, filename), { force: true }),
    ));
    if (pool) await pool.query("DELETE FROM projects WHERE id = $1", [project.id]);
    else await rm(path.join(projectDir, `${project.id}.json`), { force: true });
    return res.status(204).end();
  } catch (error) { return next(error); }
});

app.use("/api", (_req, res) => res.status(404).json({ error: "API endpoint or project was not found." }));

app.use((error: unknown, req: Request, res: Response, _next: NextFunction) => {
  const multerError = error instanceof multer.MulterError;
  const isTooLarge = multerError && error.code === "LIMIT_FILE_SIZE";
  const isGeminiError = error instanceof ApiError || error instanceof GeminiUpstreamError ||
    error instanceof Error && /timeout|timed out|ETIMEDOUT/i.test(error.message);
  const errStatus = typeof error === "object" && error !== null && "status" in error
    ? Number((error as { status?: unknown }).status)
    : typeof error === "object" && error !== null && "statusCode" in error
      ? Number((error as { statusCode?: unknown }).statusCode)
      : undefined;
  const isInvalidJson = error instanceof SyntaxError && "body" in error;
  const status = isTooLarge ? 413
    : error instanceof UnsupportedVideoError ? error.status
      : error instanceof InvalidVideoError ? error.status
    : isGeminiError ? geminiStatus(error) ?? 502
      : isInvalidJson || errStatus === 400 ? 400
        : errStatus === 404 ? 404
          : 500;
  const safeMessage = isGeminiError ? geminiErrorMessage(error)
    : isTooLarge ? `Video exceeds the ${process.env.MAX_UPLOAD_MB ?? 300} MB upload limit.`
      : error instanceof UnsupportedVideoError || error instanceof InvalidVideoError ? error.message
      : isInvalidJson ? "Request body must contain valid JSON."
        : status === 404 ? "Requested file or resource was not found."
          : status === 400 ? "Request is invalid."
            : "Unexpected server error. Check the backend terminal for details.";
  const diagnostic = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(`[api] ${req.method} ${req.originalUrl} -> ${status}: ${diagnostic}`);
  if (!res.headersSent) res.status(status).json({ error: safeMessage });
});

app.listen(port, () => {
  console.log(`CaptionAI Studio API listening on http://localhost:${port}`);
  if (!pool) console.warn("DATABASE_URL is unset: using local JSON project storage (development only).");
  if (!gemini) console.warn("GEMINI_API_KEY is unset: Gemini transcription and translation are disabled.");
});

process.on("SIGINT", () => { void pool?.end().finally(() => process.exit(0)); });
process.on("SIGTERM", () => { void pool?.end().finally(() => process.exit(0)); });
