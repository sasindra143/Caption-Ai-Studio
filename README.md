# CaptionAI Studio

An independently branded video-caption editor built with React, Vite, TypeScript, Tailwind CSS, Express, FFmpeg, and the official Google GenAI SDK. The app is not affiliated with FluxoCut and does not use its branding or assets.

The project is split into `frontend/` (the Vite editor) and `backend/` (the Express API and media worker).

## Run locally

1. Install Node.js 20 or newer and run `npm install` from the project root.
2. Copy `.env.example` to `.env` if you need to configure the backend.
3. Create a Gemini API key in [Google AI Studio](https://aistudio.google.com/apikey) and set `GEMINI_API_KEY` in the root `.env`.
4. Run `npm run dev` from the project root to start both the API and Vite frontend, then open [http://localhost:5173](http://localhost:5173).

The API listens on port `5000` by default. For separate terminals, run `npm run dev:server` and `npm run dev:client` from the root. The Vite proxy uses the backend `PORT` from the root `.env`; set `CAPTION_API_TARGET` to override it with a full backend URL. If the frontend shows a connection error, make sure the API is running and that the proxy target matches its address. Never put `GEMINI_API_KEY` in a `VITE_` variable or browser code.

The Netlify build sets `VITE_API_BASE_URL` to the Render API origin so production API calls, media, and export downloads go to the backend. If the backend URL changes, update `netlify.toml` and redeploy the Netlify site.

For compatibility when you are already in the `backend/` directory, `node server.js` starts the same API. The backend reads the root `.env` first and falls back to `backend/.env` for local setup; the root file takes precedence if both define the same variable.

Transcription and translation use the `@google/genai` SDK on the backend. The default transcription model is `gemini-3.5-transcribe`; the default text transformation model is `gemini-3.5-flash-lite`. Model availability, free-tier eligibility, limits, and pricing depend on the Google account and can change. Review the [transcription guide](https://ai.google.dev/gemini-api/docs/transcribe), [model documentation](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-transcribe), and [pricing and rate limits](https://ai.google.dev/gemini-api/docs/pricing). Set `GEMINI_TRANSCRIPTION_MODEL` or `GEMINI_TEXT_MODEL` in `.env` to use other currently available models.

The app extracts mono 16 kHz audio with FFmpeg, uploads it to Gemini, and requests verbatim word-level timing annotations. Captions are only created from returned word timestamps; the app does not invent timestamps or distribute sentences over the video duration. Gemini errors, missing credentials, and rate/quota limits are surfaced to the user. A successful real Gemini transcription requires a valid key and available model/quota; API-backed transcription cannot be confirmed without those credentials.

## Implemented workflow

- Upload MP4, MOV, or WebM with server-side media probing, audio/video stream checks, a configurable upload-size cap, and a hard 180-second duration limit.
- Automatically queue transcription after upload when Gemini is configured, or manually start it from the editor. Automatic detection lets Gemini identify speech across its documented 85+ locales; the spoken-language selector also offers manual language hints. The raw transcript is retained as the source track. Caption output defaults to a separate Natural Teluglish Roman track; users can choose Telugu script mixed with English, or explicitly select English translation.
- Use actual word annotations and timing from Gemini to create editable phrase captions and synchronized word timing. If timestamps are absent or invalid, transcription fails rather than fabricating alignment.
- Convert the raw transcript into Natural Teluglish Roman with the configured text model. The conversion is context-aware text processing, not audio recognition: it is instructed to preserve casual speech, repetitions, English words, names, and code-switching without translating or completing phrases. It stores a versioned derived track (`teluglish-roman-natural-v1`); caption IDs, order, start/end times, and word timings are copied from the source. Users can regenerate the track after changing spelling preferences.
- Other script-conversion and translation tracks are separate from the raw transcript. English translation is an explicit selection. The transcription model handles audio transcription; the text model handles caption conversion and translation. Model/API capability and account availability vary, and unsupported model requests surface as errors rather than silently switching behavior.
- Use **Check spelling** to ask Gemini to compare the selected caption track with the uploaded audio and its real caption time ranges. Corrections are suggestions only; accept or reject them individually, or apply all. Caption IDs, order, and timing are retained. Add preferred Roman spellings, names, brands, and aliases in the Vocabulary dialog; entries are stored in this browser's local storage and are sent with text-conversion requests. A preference never authorizes inserting a word absent from the source transcript. Text conversion cannot resolve an audio recognition mistake by itself; use audio-grounded spelling review and inspect uncertain wording.
- Edit source caption text and timing, preview playback, and apply caption templates and styling.
- Browse 120 distinct caption presets across 12 categories, with search, category filters, favorites, preview cards, and browser-local custom preset save/duplicate/delete. Style changes can target one caption, the selected captions, or the full track. The searchable font registry contains 179 family entries grouped by category; browser fonts load on demand when available.
- Use the editor's **Caption Themes** gallery for 74 curated themes, including 40 new original styles based on the visual directions in the supplied screenshots. The themes vary in typography, color, outlines, shadows, backgrounds, positions, line spacing, and supported animation settings. Split-color script/headline themes render their color layers in preview and MP4 export; word-highlight themes use real word timings when available. Search/filter themes and preview up to the first four words of the active caption; this short sample is only for the gallery and does not change transcript text or timing. Apply a theme to one caption or the complete track. All prior themes and the earlier preset catalog remain available. Saved custom themes are kept in browser storage.
- Style typography, color, outline, shadow, background, alignment, width, line spacing, and caption placement from the editor. Preset and font names describe catalog choices, not a guarantee that a family is installed, licensed for your use, or available to FFmpeg.
- Select `Teluglish Viral` for independently editable decorative-script and headline phrases, with a cursive/condensed font pairing, adjustable colors, outline, shadow, animation, and background. Drag the selected caption on the preview to reposition it or use the corner handle/scale slider to resize; the same position and scale are passed to MP4 rendering. Split and merge operations use actual word annotations and preserve their real time bounds. MP4 output uses ASS subtitle layers and supports selected fade/slide/pop/zoom/blur/rotate entrances, fade exits, transform keyframes, and word highlighting when the caption has matching word timestamps. ASS styles are generated per distinct caption appearance; captions with no background use outline mode rather than an opaque box, and cinematic layer sizes scale with the video composition.
- Review suggested silence, filler-word, and repeated-word trims. Suggestions are optional; only explicitly accepted cuts are applied to an export.
- Render MP4 with permanently burned-in captions and selected aspect ratio/resolution; download SRT, VTT, and TXT files.
- Delete a project and its stored upload and exports.
- Reopen a saved local project using `http://localhost:5173/?project=<project-id>`; use `&mode=teluglish-roman` to open its saved Natural Teluglish Roman track when present.

## API outline

- `GET /api/health` — API, database, and Gemini availability
- `POST /api/projects` — upload and validate media
- `GET /api/projects/:id` / `PATCH /api/projects/:id` — read or rename a project
- `DELETE /api/projects/:id` — delete a project and its media/exports
- `POST /api/videos/:id/generate-captions` (also `POST /api/projects/:id/transcribe`) — enqueue transcription; poll `GET /api/jobs/:id`
- `PATCH /api/projects/:id/captions` — save edited source captions
- `POST /api/projects/:id/correct-spelling` — return audio-grounded spelling suggestions without changing stored captions
- `PATCH /api/projects/:id/track` — save explicitly accepted text edits for an existing caption track while retaining its timing and IDs
- `POST /api/projects/:id/translate` — create a distinct script-conversion or translation track, preserving source caption identity and timing
- `POST /api/projects/:id/auto-trim` — return reviewable cut suggestions
- `POST /api/projects/:id/export` — prepare a subtitle file or enqueue an MP4 render; poll the job and download its result
- `GET /api/projects/:id/download/:filename` — download a project export

## Configuration and limitations

- `GEMINI_API_KEY` is required for transcription, translation, and audio-grounded spelling review. It is read only by the backend from the root `.env`.
- `GEMINI_TRANSCRIPTION_MODEL` and `GEMINI_TEXT_MODEL` configure the backend models; use models currently available to your Gemini API account.
- `PORT` defaults to `5000`; `MAX_UPLOAD_MB`, `MAX_CONCURRENT_JOBS`, `STORAGE_DIR`, `PUBLIC_APP_ORIGIN`, and optional `DATABASE_URL` are also configurable.
- Gemini 3.5 Transcribe is listed with free-of-charge input/output on the current pricing page, but account access and quota/rate limits still apply and may change. Gemini's pricing page also says free-tier content may be used to improve Google products; review the current terms and choose a paid tier if your data policy requires it. The app reports quota errors and does not automatically retry them.
- `DATABASE_URL` enables PostgreSQL project persistence. When unset, projects are written to local JSON files under `storage/projects`; this fallback is for development only. Jobs are process-local, so production deployments require a durable queue/worker and shared storage for multiple instances.
- Project IDs are random, but the starter does not implement user accounts or ownership authorization. Add authentication, ownership checks, rate limiting, upload quotas, and private object-storage signed URLs before exposing it to untrusted users.
- Uploaded videos and exports reside under `storage/`. Configure retention and private persistent/object storage for production.
- Telugu glyph display and MP4 rendering depend on system fonts. On the current Windows renderer, `Nirmala.ttc` provides Telugu glyph support and Georgia, Impact, and Segoe Script are installed for the cinematic layers. System fonts are not bundled; check font availability and applicable licensing before deploying to another OS. Custom font upload is not implemented. Browser-loaded fonts are not bundled into FFmpeg, so an unavailable family falls back to the renderer's installed fonts.
- Preview-only CSS effects (including typewriter, word/letter reveal, staggered and looping effects, and some continuous animations) are not reproduced in MP4. Keyframe easing and animation effects not listed above are also not exported. Check the render engine's installed fonts and effect support before relying on exact browser-to-video parity.
- The editor stacks into a mobile layout and keeps timeline controls scroll-safe at narrow widths. On-screen transform handles are editor-only; MP4 uses the styled caption render rather than the editor overlay.

Run `npm run build` to type-check and create the production frontend bundle. `npm start` starts the API server; serve the generated `frontend/dist` directory separately behind your production web server.
"# Caption-Ai-Studio" 
