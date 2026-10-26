import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import {
  ArrowDownToLine, AudioLines, Check, ChevronDown, CircleHelp, Clapperboard, Clock3, CloudUpload, Copy,
  FileAudio2, FileText, Film, Languages, Layers, LoaderCircle,
  MoreHorizontal, Pause, Play, Plus, Radio, Redo2, Scissors, Settings2,
  RotateCcw, Sparkles, Subtitles, Trash2, Undo2, WandSparkles, X,
} from "lucide-react";
import type { CaptionLayer, CaptionMode, CaptionSegment, EasingType, Keyframe, Project, StyleSettings } from "./domain";
import { getLanguageName, supportedLanguages, translationStorageKey } from "../../shared/languages";
import { getVideoContentRect, interpolateTransform, type VideoContentRect } from "./utils/motion";
import { HistoryManager } from "./utils/history";
import { TransformBox } from "./components/TransformBox";
import { AnimationPanel } from "./components/AnimationPanel";
import { LayersPanel } from "./components/LayersPanel";
import { InteractiveTimeline } from "./components/InteractiveTimeline";
import { captionPresets, fontFamilies, googleFontStylesheet, type CaptionPreset, type FontCategory } from "./data/captionCatalog";
import { captionThemeCategories, captionThemes } from "./data/captionThemes";

type StudioProject = Omit<Project, "mediaPath"> & { videoUrl: string };
type Template = { id?: string; name: string; category: string; color: string; font: string; effect: string; style?: Partial<StyleSettings>; entrance?: CaptionPreset["entrance"]; exit?: CaptionPreset["exit"]; continuous?: CaptionPreset["continuous"] };
type CutSuggestion = { id: string; start: number; end: number; reason: string; accepted: boolean };
type SpellingSuggestion = { original: string; corrected: string };
type VocabularyTerm = { preferred: string; aliases: string[] };

const defaultVocabulary = [
  { preferred: "360° Vertex Solutions", aliases: ["360° Vertex Solutions", "360 degrees vertex solutions", "360 degrees varteks solyooshans", "360° varteks solyooshans"] },
  { preferred: "Vertex Solutions", aliases: ["Vertex Solutions", "వర్టెక్స్ సొల్యూషన్స్", "varteks solyooshans"] },
  { preferred: "Froot Bowl", aliases: ["Froot Bowl", "ఫ్రూట్ బాల్", "ఫుడ్ బాల్", "fruit ball", "food ball"] },
  { preferred: "Contact", aliases: ["Contact", "కాంటాక్ట్", "kaantaakt"] },
  { preferred: "Markapur", aliases: ["Markapur", "మార్కాపురం", "మార్కాపూర్"] },
  { preferred: "CaptionAI Studio", aliases: ["CaptionAI Studio"] },
  { preferred: "Website", aliases: ["Website", "వెబ్సైట్", "వెబ్ సైట్"] },
  { preferred: "Startup", aliases: ["Startup", "స్టార్టప్", "స్టార్ట్ అప్"] },
  { preferred: "Requirements", aliases: ["Requirements", "రిక్వైర్మెంట్స్", "requirements"] },
  { preferred: "Google Gemini", aliases: ["Google Gemini", "గూగుల్ జెమిని"] },
  { preferred: "Instagram", aliases: ["Instagram", "ఇన్‌స్టాగ్రామ్"] },
  { preferred: "YouTube", aliases: ["YouTube", "యూట్యూబ్"] },
];

const classicTemplates: Template[] = [
  { name: "The Real Lessons", category: "VIRAL", color: "#ffffff", font: "Arial", effect: "viral-lesson" },
  { name: "i'm back with", category: "MODERN", color: "#ffffff", font: "DM Sans", effect: "modern-box" },
  { name: "Telugish Gold", category: "CREATOR", color: "#ffd700", font: "Impact", effect: "bold-gold" },
  { name: "Karaoke Highlight", category: "WORD BY WORD", color: "#d2fa56", font: "DM Sans", effect: "karaoke" },
  { name: "Minimal Clean", category: "CLEAN", color: "#ffffff", font: "DM Sans", effect: "minimal" },
  { name: "Social Reel", category: "POPULAR", color: "#fffa65", font: "Space Grotesk", effect: "reel" },
  { name: "Clean White", category: "CLASSIC", color: "#ffffff", font: "Noto Sans Telugu", effect: "clean", style: { fontSize: 42, textColor: "#ffffff", weight: "normal", outlineColor: "#101010", outlineWidth: 1, shadowBlur: 1, backgroundOpacity: 0, maxWidth: 90, lineSpacing: 1.3 } },
  { name: "Creator Bold", category: "CREATOR", color: "#ffffff", font: "Noto Sans Telugu", effect: "creator", style: { fontSize: 44, textColor: "#ffffff", weight: "bold", outlineColor: "#101010", outlineWidth: 0.5, shadowBlur: 2, backgroundOpacity: 0, maxWidth: 90, lineSpacing: 1.3 } },
  { name: "Viral Yellow", category: "VIRAL", color: "#ffe34d", font: "Noto Sans Telugu", effect: "viral", style: { fontSize: 44, textColor: "#ffe34d", weight: "bold", outlineColor: "#161616", outlineWidth: 2, shadowBlur: 1, backgroundOpacity: 0, maxWidth: 90 } },
  { name: "Cinematic", category: "CINEMA", color: "#f7f4ed", font: "Georgia", effect: "cinema", style: { fontSize: 40, textColor: "#f7f4ed", weight: "normal", outlineWidth: 0, shadowBlur: 3, backgroundOpacity: 0, maxWidth: 88, lineSpacing: 1.35 } },
  { name: "Minimal", category: "MINIMAL", color: "#ffffff", font: "Noto Sans Telugu", effect: "minimal", style: { fontSize: 40, textColor: "#ffffff", weight: "normal", outlineWidth: 0, shadowBlur: 0, backgroundOpacity: 0, maxWidth: 92, lineSpacing: 1.3 } },
  { name: "Telugu Creator", category: "TELUGU", color: "#ffffff", font: "Noto Sans Telugu", effect: "telugu", style: { fontSize: 42, textColor: "#ffffff", weight: "bold", outlineColor: "#141414", outlineWidth: 1, shadowBlur: 1, backgroundOpacity: 0, maxWidth: 94, lineSpacing: 1.4 } },
  { name: "Telugu-English Mix", category: "MIXED", color: "#ffffff", font: "Noto Sans Telugu", effect: "mixed", style: { fontSize: 40, textColor: "#ffffff", weight: "bold", outlineColor: "#171717", outlineWidth: 0.75, shadowBlur: 1, backgroundOpacity: 0, maxWidth: 94, lineSpacing: 1.4 } },
  { name: "Red Headline", category: "HEADLINE", color: "#ff5148", font: "Arial", effect: "headline", style: { fontSize: 44, textColor: "#ff5148", weight: "bold", outlineColor: "#171111", outlineWidth: 1.5, shadowBlur: 1, backgroundOpacity: 0, maxWidth: 88 } },
  { name: "Podcast", category: "PODCAST", color: "#ffffff", font: "Noto Sans Telugu", effect: "podcast", style: { fontSize: 38, textColor: "#ffffff", weight: "normal", outlineWidth: 0, shadowBlur: 0, backgroundColor: "#090909", backgroundOpacity: 0.62, maxWidth: 90, lineSpacing: 1.35 } },
  { name: "Karaoke", category: "WORD BY WORD", color: "#ffffff", font: "Noto Sans Telugu", effect: "karaoke", style: { fontSize: 42, textColor: "#ffffff", highlightColor: "#ffe34d", weight: "bold", outlineColor: "#141414", outlineWidth: 1, shadowBlur: 1, backgroundOpacity: 0, maxWidth: 92, lineSpacing: 1.35, karaoke: true } },
];

const templates: Template[] = [
  ...classicTemplates.map((item) => ({ ...item, id: `classic-${item.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` })),
  ...captionPresets.map((preset) => ({
    id: preset.id,
    name: preset.name,
    category: preset.category,
    color: preset.style.textColor ?? "#ffffff",
    font: preset.style.fontFamily ?? "Noto Sans Telugu",
    effect: "catalog",
    style: preset.style,
    entrance: preset.entrance,
    exit: preset.exit,
    continuous: preset.continuous,
  })),
];

const themeTemplates: Template[] = captionThemes.map((theme) => ({
  id: theme.id,
  name: theme.name,
  category: theme.category,
  color: theme.style.textColor ?? "#ffffff",
  font: theme.style.fontFamily ?? "Noto Sans Telugu",
  effect: theme.style.karaoke ? "karaoke" : "theme",
  style: theme.style,
  entrance: theme.entrance,
  exit: theme.exit,
  continuous: theme.continuous,
}));

const naturalTeluglishTrackKey = "teluglish-roman-natural-v1";
const entranceMotion: Record<NonNullable<StyleSettings["entranceAnimation"]>, string> = {
  none: "none", "fade-in": "captionFadeIn", "slide-up": "captionSlideUp", "slide-down": "captionSlideDown",
  "slide-left": "captionSlideLeft", "slide-right": "captionSlideRight", "pop-in": "captionPopIn",
  "zoom-in": "captionZoomIn", "bounce-in": "captionBounceIn", typewriter: "captionTypewriter",
  "word-reveal": "captionFadeIn", "letter-reveal": "captionTypewriter", "stagger-words": "captionFadeIn",
  "blur-clear": "captionBlurClear", "rotate-in": "captionRotateIn", "elastic-in": "captionElasticIn",
};
const exitMotion: Record<NonNullable<StyleSettings["exitAnimation"]>, string> = {
  none: "none", "fade-out": "captionFadeOut", "slide-up-out": "captionSlideUpOut",
  "slide-down-out": "captionSlideDownOut", "slide-left-out": "captionSlideLeftOut",
  "slide-right-out": "captionSlideRightOut", "zoom-out": "captionZoomOut",
  "pop-out": "captionPopOut", "rotate-out": "captionRotateOut", "blur-out": "captionBlurOut",
};
const continuousMotion: Record<NonNullable<StyleSettings["continuousAnimation"]>, string> = {
  none: "none", pulse: "captionPulse", floating: "captionFloat", "gentle-bounce": "captionGentleBounce",
  "breathing-scale": "captionBreathing", "neon-glow": "captionNeonGlow", karaoke: "none",
  "active-word": "none", "subtle-shake": "captionShake", "looping-highlight": "captionHighlight",
};

const modes: Array<{ id: CaptionMode; label: string; native: string }> = [
  { id: "teluglish-roman", label: "Natural Teluglish Roman", native: "Conversational Telugu + spoken English" },
  { id: "native-mix", label: "Telugu script + English", native: "Conversational mixed script" },
  { id: "english-translation", label: "English translation", native: "Translate only when selected" },
  { id: "original", label: "Raw transcript", native: "Original speech recognition" },
  { id: "english", label: "English", native: "English text" },
  { id: "telugu", label: "Telugu script", native: "తెలుగు లిపి" },
  { id: "roman", label: "Telugu Roman (basic)", native: "Roman letters" },
  { id: "telugu-translation", label: "Telugu translation", native: "Formal translation to Telugu" },
  { id: "bilingual", label: "Bilingual", native: "English + తెలుగు" },
  { id: "translation", label: "Translate to another language", native: "Choose from 85+ languages" },
];

type TranslationTarget = Exclude<CaptionMode, "original" | "english" | "telugu">;
type TranslationRequest = { target: TranslationTarget; targetLanguage?: string; key: string };

function captionTextFromWords(words: NonNullable<CaptionSegment["words"]>): string {
  return words.map((word) => word.text).join(" ").replace(/\s+([,!.?])/g, "$1");
}

function captionLayers(segment: CaptionSegment): { script: string; headline: string } {
  const matchingWords = segment.words
    && captionTextFromWords(segment.words).normalize("NFC") === segment.text.trim().normalize("NFC")
    ? segment.words
    : undefined;
  const words = matchingWords
    ? matchingWords.map((word) => word.text)
    : segment.text.trim().split(/\s+/u).filter(Boolean);
  const splitAt = words.length ? Math.max(1, Math.ceil(words.length / 3)) : 0;
  const hasLayerOverrides = Boolean(segment.scriptText?.trim() || segment.headlineText?.trim());

  return {
    script: hasLayerOverrides ? segment.scriptText ?? words.slice(0, splitAt).join(" ") : words.slice(0, splitAt).join(" "),
    headline: hasLayerOverrides ? segment.headlineText ?? words.slice(splitAt).join(" ") : words.slice(splitAt).join(" "),
  };
}

function makeTranslationRequest(
  mode: CaptionMode,
  sourceLanguage: string | undefined,
  targetLanguage: string,
): TranslationRequest | undefined {
  const isEnglishSource = sourceLanguage?.startsWith("en") ?? false;
  const isTeluguSource = sourceLanguage?.startsWith("te") ?? false;
  if (mode === "original" || mode === "english" && isEnglishSource || mode === "telugu" && isTeluguSource) return undefined;
  if (mode === "english") return isTeluguSource
    ? { target: "english-translation", key: "english-translation" }
    : { target: "translation", targetLanguage: "en-US", key: translationStorageKey("en-US") };
  if (mode === "telugu") return isEnglishSource
    ? { target: "telugu-translation", key: "telugu-translation" }
    : { target: "translation", targetLanguage: "te-IN", key: translationStorageKey("te-IN") };
  if (mode === "translation") {
    return { target: "translation", targetLanguage, key: translationStorageKey(targetLanguage) };
  }
  if (mode === "teluglish-roman") return { target: mode, key: naturalTeluglishTrackKey };
  if (mode === "native-mix" || mode === "roman") return { target: mode, key: mode };
  return { target: mode as TranslationTarget, key: mode };
}

const defaultStyle: StyleSettings = {
  fontFamily: "Noto Sans Telugu", fontSize: 42, textColor: "#ffffff", backgroundColor: "#151713",
  backgroundOpacity: 0, outlineColor: "#101010", outlineWidth: 1, highlightColor: "#ff3434",
  weight: "normal", italic: false, position: "bottom", alignment: "center",
  positionX: 50, positionY: 82, scale: 1, rotation: 0, opacity: 1,
  shadowColor: "#000000", shadowBlur: 1, glowColor: "#ff3434", glowRadius: 0, lineSpacing: 1.3, maxWidth: 90,
  karaoke: false,
  letterSpacing: 0, maxLines: 2,
  entranceAnimation: "fade-in", exitAnimation: "fade-out", continuousAnimation: "none",
  animationDuration: 400, animationDelay: 0, animationIntensity: 1,
  animationEasing: "ease-out", animationLoop: true,
  cinematic: false, scriptFontFamily: "Segoe Script", headlineFontFamily: "Impact",
  scriptColor: "#ffffff", headlineColor: "#ff3434", scriptFontSize: 48,
  headlineFontSize: 54, scriptRotation: 0, animation: "pop",
  safeAreaGuides: false, alignmentGuides: true, centerSnapping: true,
  topBannerText: "www.360vertexsolutions.com",
  bottomBannerText: "Contact for website's: 9959732476",
};

const api = async <T,>(url: string, init?: RequestInit): Promise<T> => {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new Error("Could not connect to the caption API. Make sure the backend is running and CAPTION_API_TARGET points to it.");
  }
  if (!response.ok) {
    const contentType = response.headers.get("content-type") ?? "";
    if (response.status >= 500 && !contentType.includes("application/json")) {
      throw new Error("Could not reach the caption backend. Start it with npm run dev and check CAPTION_API_TARGET.");
    }
    const result = contentType.includes("application/json")
      ? await response.json().catch(() => ({ error: response.statusText })) as { error?: string }
      : { error: response.statusText };
    const fallbackMessages: Record<number, string> = {
      400: "The request is invalid. Check the selected language and caption settings.",
      404: "The project or media file could not be found. Reload the project and try again.",
      429: "The service is busy or the Gemini quota was reached. Wait before trying again.",
      413: "The video is larger than the configured upload limit.",
      415: "Choose an MP4, MOV, or WebM video file.",
      500: "The backend encountered an unexpected error. Check the backend terminal for details.",
      502: "Gemini could not complete this translation. Try again later.",
      503: "The backend or a required service is unavailable. Check the service configuration and logs.",
      504: "Gemini took too long to respond. Please try again later.",
    };
    throw new Error(result.error && result.error !== response.statusText
      ? result.error
      : fallbackMessages[response.status] ?? `Request failed (${response.status}).`);
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
};

function App() {
  const inputRef = useRef<HTMLInputElement>(null);
  const themeImportRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<number | undefined>(undefined);
  const translationSaveTimer = useRef<number | undefined>(undefined);
  const translationsInFlight = useRef(new Set<string>());
  const historyRef = useRef(new HistoryManager(50));

  const [project, setProject] = useState<StudioProject | null>(null);
  const [segments, setSegments] = useState<CaptionSegment[]>([]);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [selectedSegmentIds, setSelectedSegmentIds] = useState<string[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string>("main");
  const [mode, setMode] = useState<CaptionMode>("teluglish-roman");
  const [sourceLanguage, setSourceLanguage] = useState<string | undefined>(undefined);
  const [transcriptionLanguage, setTranscriptionLanguage] = useState("auto");
  const [targetLanguage, setTargetLanguage] = useState("en-US");
  const [template, setTemplate] = useState(themeTemplates.find((item) => item.name === "Clean Subtitle") ?? themeTemplates[0]);
  const [style, setStyle] = useState<StyleSettings>(() => {
    try {
      const stored = window.localStorage.getItem("captionai-style");
      return stored ? { ...defaultStyle, ...JSON.parse(stored) as Partial<StyleSettings> } : defaultStyle;
    } catch {
      return defaultStyle;
    }
  });
  const [styleScope, setStyleScope] = useState<"selected" | "selection" | "track">("track");
  const [presetSearch, setPresetSearch] = useState("");
  const [presetCategory, setPresetCategory] = useState("All");
  const [showLegacyTemplates, setShowLegacyTemplates] = useState(true);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [favoritePresets, setFavoritePresets] = useState<string[]>(() => {
    try {
      const value: unknown = JSON.parse(window.localStorage.getItem("captionai:preset-favorites") ?? "[]");
      return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
    } catch { return []; }
  });
  const [customPresets, setCustomPresets] = useState<Template[]>(() => {
    try {
      const value: unknown = JSON.parse(window.localStorage.getItem("captionai:custom-presets") ?? "[]");
      return Array.isArray(value) ? value as Template[] : [];
    } catch { return []; }
  });
  const [aspectRatio, setAspectRatio] = useState<"original" | "9:16" | "1:1" | "16:9">("original");
  const [resolution, setResolution] = useState<"720p" | "1080p">("1080p");
  const [tab, setTab] = useState<"templates" | "style" | "animation" | "layers">("templates");
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [job, setJob] = useState<{ progress: number; message: string } | null>(null);
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [cuts, setCuts] = useState<CutSuggestion[] | null>(null);
  const [showTrim, setShowTrim] = useState(false);
  const [showFonts, setShowFonts] = useState(false);
  const [showVocabulary, setShowVocabulary] = useState(false);
  const [vocabularyEntry, setVocabularyEntry] = useState("");
  const [vocabularyAliasesEntry, setVocabularyAliasesEntry] = useState("");
  const [vocabulary, setVocabulary] = useState<VocabularyTerm[]>(() => {
    try {
      const saved = window.localStorage.getItem("captionai:spelling-vocabulary");
      const parsed: unknown = saved ? JSON.parse(saved) : defaultVocabulary;
      if (!Array.isArray(parsed)) return defaultVocabulary;
      return parsed.flatMap((term): VocabularyTerm[] => {
        if (typeof term === "string" && term.trim()) return [{ preferred: term.trim(), aliases: [term.trim()] }];
        if (typeof term === "object" && term !== null && "preferred" in term &&
          typeof term.preferred === "string" && term.preferred.trim() &&
          "aliases" in term && Array.isArray(term.aliases) && term.aliases.every((alias: unknown) => typeof alias === "string")) {
          return [{ preferred: term.preferred.trim(), aliases: term.aliases }];
        }
        return [];
      });
    } catch {
      return defaultVocabulary;
    }
  });
  const [spellingSuggestions, setSpellingSuggestions] = useState<Record<string, SpellingSuggestion>>({});
  const [spellingRejectedCount, setSpellingRejectedCount] = useState(0);
  const [fontSearch, setFontSearch] = useState("");
  const [fontCategory, setFontCategory] = useState<"All" | FontCategory>("All");
  const [fontLoadStatus, setFontLoadStatus] = useState<"loading" | "available" | "unavailable">("loading");
  const [projectName, setProjectName] = useState("");
  const [saving, setSaving] = useState(false);
  const [geminiAvailable, setGeminiAvailable] = useState<boolean | null>(null);
  const [serviceError, setServiceError] = useState("");
  const [showGeminiSetup, setShowGeminiSetup] = useState(false);

  // Motion recording state
  const [recordingMotion, setRecordingMotion] = useState(false);
  const recordedKeyframesRef = useRef<Keyframe[]>([]);
  const lastRecordTimeRef = useRef<number>(0);

  // Undo / Redo active state
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Video container aspect measurement
  const [videoRect, setVideoRect] = useState<VideoContentRect>({ left: 0, top: 0, width: 0, height: 0 });

  const currentTranslation = makeTranslationRequest(mode, sourceLanguage, targetLanguage);
  const displayedSegments = useMemo(() => {
    if (!currentTranslation) return segments;
    return project?.translations[currentTranslation.key] ?? segments;
  }, [currentTranslation?.key, project?.translations, segments]);

  const activeSegment = useMemo(() => {
    if (selectedSegmentId) {
      const found = displayedSegments.find((s) => s.id === selectedSegmentId);
      if (found) return found;
    }
    return displayedSegments.find((segment) => currentTime >= segment.start && currentTime <= segment.end);
  }, [selectedSegmentId, displayedSegments, currentTime]);
  const activeCaptionStyle = useMemo(
    () => ({ ...style, ...(activeSegment?.style ?? {}) }),
    [style, activeSegment?.style],
  );
  const allTemplates = useMemo(
    () => [...themeTemplates, ...customPresets, ...(showLegacyTemplates ? templates : [])],
    [customPresets, showLegacyTemplates],
  );
  const visibleTemplateCategories = [
    ...new Set([
      ...captionThemeCategories,
      ...(showLegacyTemplates ? templates.map((item) => item.category) : []),
      ...(customPresets.length ? ["My presets"] : []),
    ]),
  ];
  const themePreviewText = activeSegment?.text ?? displayedSegments[0]?.text ?? "";
  const visibleTemplates = useMemo(() => allTemplates.filter((item) =>
    (presetCategory === "All" || item.category === presetCategory) &&
    (!showFavoritesOnly || favoritePresets.includes(item.id ?? item.name)) &&
    (!presetSearch || `${item.name} ${item.category} ${item.font}`.toLowerCase().includes(presetSearch.toLowerCase())),
  ), [allTemplates, favoritePresets, presetCategory, presetSearch, showFavoritesOnly]);

  const canTranslate = Boolean(project && segments.length && currentTranslation);

  // Interpolated transform values for the active segment at the current time
  const currentTransform = useMemo(() => {
    return interpolateTransform(activeSegment, currentTime, {
      positionX: activeCaptionStyle.positionX ?? 50,
      positionY: activeCaptionStyle.positionY ?? 75,
      scale: activeCaptionStyle.scale ?? 1,
      rotation: activeCaptionStyle.rotation ?? 0,
      opacity: activeCaptionStyle.opacity ?? 1,
    });
  }, [activeSegment, activeCaptionStyle, currentTime]);

  // Video frame aspect measurement
  useEffect(() => {
    const measure = () => {
      const video = videoRef.current;
      const stage = stageRef.current;
      if (!video || !stage) return;
      const stageRect = stage.getBoundingClientRect();
      const rect = getVideoContentRect(
        stageRect.width,
        stageRect.height,
        video.videoWidth || 1920,
        video.videoHeight || 1080,
      );
      setVideoRect(rect);
    };

    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [project, aspectRatio, duration]);

  function pushHistory() {
    historyRef.current.push({ segments, style });
    setCanUndo(historyRef.current.canUndo());
    setCanRedo(historyRef.current.canRedo());
  }

  function handleUndo() {
    const prev = historyRef.current.undo({ segments, style });
    if (prev) {
      setSegments(prev.segments);
      setStyle(prev.style);
      setCanUndo(historyRef.current.canUndo());
      setCanRedo(historyRef.current.canRedo());
    }
  }

  function handleRedo() {
    const next = historyRef.current.redo({ segments, style });
    if (next) {
      setSegments(next.segments);
      setStyle(next.style);
      setCanUndo(historyRef.current.canUndo());
      setCanRedo(historyRef.current.canRedo());
    }
  }

  // Keyboard shortcut listener: Ctrl+Z / Cmd+Z for undo, Ctrl+Shift+Z / Ctrl+Y for redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) && !e.ctrlKey && !e.metaKey) {
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        if (e.shiftKey) {
          e.preventDefault();
          handleRedo();
        } else {
          e.preventDefault();
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [segments, style]);

  useEffect(() => {
    let active = true;
    const refreshStatus = () => {
      void api<{ gemini: boolean }>("/api/health")
        .then((status) => {
          if (!active) return;
          setGeminiAvailable(status.gemini);
          setServiceError("");
        })
        .catch((statusError: unknown) => {
          if (!active) return;
          setGeminiAvailable(null);
          setServiceError(statusError instanceof Error ? statusError.message : "The caption API is unavailable.");
        });
    };
    refreshStatus();
    const interval = window.setInterval(refreshStatus, 5000);
    return () => { active = false; window.clearInterval(interval); };
  }, []);

  useEffect(() => {
    const projectId = new URLSearchParams(window.location.search).get("project");
    if (!projectId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)) return;
    let active = true;
    setWorking("Opening saved project");
    void api<StudioProject>(`/api/projects/${projectId}`)
      .then((savedProject) => {
        if (!active) return;
        const requestedMode = new URLSearchParams(window.location.search).get("mode");
        setProject(savedProject);
        setProjectName(savedProject.name);
        setSegments(savedProject.segments);
        setSourceLanguage(savedProject.sourceLanguage);
        setDuration(savedProject.duration);
        setCurrentTime(0);
        setMode(modes.some((item) => item.id === requestedMode)
          ? requestedMode as CaptionMode
          : "teluglish-roman");
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Could not open the saved project.");
      })
      .finally(() => {
        if (active) setWorking("");
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!project || !segments.length) return;
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      setSaving(true);
      try {
        await api<StudioProject>(`/api/projects/${project.id}/captions`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ segments }),
        });
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "Could not save captions.");
      } finally { setSaving(false); }
    }, 700);
    return () => window.clearTimeout(saveTimer.current);
  }, [project, segments]);

  useEffect(() => {
    window.localStorage.setItem("captionai:spelling-vocabulary", JSON.stringify(vocabulary));
  }, [vocabulary]);

  useEffect(() => {
    window.localStorage.setItem("captionai:preset-favorites", JSON.stringify(favoritePresets));
  }, [favoritePresets]);

  useEffect(() => {
    window.localStorage.setItem("captionai:custom-presets", JSON.stringify(customPresets));
  }, [customPresets]);

  useEffect(() => {
    window.localStorage.setItem("captionai-style", JSON.stringify(style));
  }, [style]);

  useEffect(() => {
    const family = fontFamilies.find((font) => font.family === activeCaptionStyle.fontFamily);
    if (!family || family.source === "System") {
      setFontLoadStatus("available");
      return;
    }
    let active = true;
    setFontLoadStatus("loading");
    const linkId = `captionai-google-font-${activeCaptionStyle.fontFamily.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    if (!document.getElementById(linkId)) {
      const link = document.createElement("link");
      link.id = linkId;
      link.rel = "stylesheet";
      link.href = googleFontStylesheet(activeCaptionStyle.fontFamily);
      link.onerror = () => { if (active) setFontLoadStatus("unavailable"); };
      document.head.append(link);
    }
    void document.fonts.load(`16px "${activeCaptionStyle.fontFamily}"`).then((loaded) => {
      if (active) setFontLoadStatus(loaded.length ? "available" : "unavailable");
    }).catch(() => {
      if (active) setFontLoadStatus("unavailable");
    });
    return () => { active = false; };
  }, [activeCaptionStyle.fontFamily]);

  useEffect(() => {
    if (tab !== "templates") return;
    const families = [...new Set(visibleTemplates.flatMap((item) => [
      item.font,
      item.style?.scriptFontFamily,
      item.style?.headlineFontFamily,
    ]).filter((family): family is string => Boolean(family)))];
    for (const family of families) {
      const font = fontFamilies.find((item) => item.family === family);
      if (!font || font.source === "System") continue;
      const linkId = `captionai-google-font-${family.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
      if (document.getElementById(linkId)) continue;
      const link = document.createElement("link");
      link.id = linkId;
      link.rel = "stylesheet";
      link.href = googleFontStylesheet(family);
      document.head.append(link);
    }
  }, [tab, visibleTemplates]);

  useEffect(() => {
    if (mode !== "teluglish-roman" || !project?.segments.length ||
      project.translations[naturalTeluglishTrackKey]?.length ||
      translationsInFlight.current.has(`${project.id}:${naturalTeluglishTrackKey}`)) return;
    void createTranslation("teluglish-roman", undefined, "teluglish-roman");
  }, [mode, project?.id, project?.segments.length, project?.translations[naturalTeluglishTrackKey]]);

  useEffect(() => {
    const key = currentTranslation?.key;
    const track = key ? project?.translations[key] : undefined;
    if (!project || !key || !track?.length) return;
    window.clearTimeout(translationSaveTimer.current);
    translationSaveTimer.current = window.setTimeout(async () => {
      setSaving(true);
      try {
        await api(`/api/projects/${project.id}/track`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key, captions: track.map(({ id, text, style: captionStyle }) => ({ id, text, style: captionStyle ?? null })) }),
        });
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "Could not save the translated caption track.");
      } finally {
        setSaving(false);
      }
    }, 700);
    return () => window.clearTimeout(translationSaveTimer.current);
  }, [project?.id, currentTranslation?.key, project?.translations]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const update = () => setCurrentTime(video.currentTime);
    const ended = () => {
      setPlaying(false);
      if (recordingMotion) stopRecordMotion();
    };
    video.addEventListener("timeupdate", update);
    video.addEventListener("ended", ended);
    return () => { video.removeEventListener("timeupdate", update); video.removeEventListener("ended", ended); };
  }, [project, recordingMotion]);

  useEffect(() => {
    if (!project) return;
    const timeout = window.setTimeout(() => {
      void api<StudioProject>(`/api/projects/${project.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: projectName }),
      }).then((updated) => setProject((current) => current ? { ...current, name: updated.name } : current))
        .catch((requestError: unknown) => setError(requestError instanceof Error ? requestError.message : "Could not save project name."));
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [project?.id, projectName]);

  async function uploadVideo(file?: File) {
    if (!file) return;
    setError("");
    setWorking("Uploading video");
    let projectToTranscribe: StudioProject | undefined;
    const body = new FormData();
    body.append("video", file);
    try {
      const uploaded = await new Promise<StudioProject>((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open("POST", "/api/projects");
        request.timeout = 10 * 60 * 1000;
        request.upload.onprogress = (event) => {
          if (event.lengthComputable) setWorking(`Uploading video · ${Math.round(event.loaded / event.total * 100)}%`);
        };
        request.onerror = () => reject(new Error("The upload could not reach the caption API. Make sure the backend is running and the Vite proxy is configured."));
        request.ontimeout = () => reject(new Error("The video upload timed out. Check your connection and try again."));
        request.onabort = () => reject(new Error("The video upload was cancelled."));
        request.onload = () => {
          let result: unknown;
          const contentType = request.getResponseHeader("content-type") ?? "";
          if (contentType.includes("application/json")) {
            try {
              result = JSON.parse(request.responseText);
            } catch {
              reject(new Error(`The caption API returned an invalid response (${request.status}).`));
              return;
            }
          }
          if (request.status < 200 || request.status >= 300) {
            const message = request.status >= 500 && !contentType.includes("application/json")
              ? "Could not reach the caption backend. Start it with npm run dev and check CAPTION_API_TARGET."
              : typeof result === "object" && result !== null && "error" in result && typeof result.error === "string"
              ? result.error
              : request.status === 413
                ? "The video exceeds the configured upload-size limit."
                : request.status === 415
                  ? "Choose an MP4, MOV, or WebM video file."
                  : `Video upload failed (${request.status}).`;
            reject(new Error(message));
            return;
          }
          if (typeof result !== "object" || result === null || !("id" in result) || typeof result.id !== "string" ||
            !("name" in result) || typeof result.name !== "string" || !("duration" in result) ||
            typeof result.duration !== "number" || !Number.isFinite(result.duration) ||
            !("status" in result) || !["uploaded", "transcribing", "ready", "error"].includes(String(result.status)) ||
            !("segments" in result) || !Array.isArray(result.segments) ||
            !("translations" in result) || typeof result.translations !== "object" || result.translations === null ||
            !("videoUrl" in result) || typeof result.videoUrl !== "string") {
            reject(new Error("The caption API did not confirm a valid project upload."));
            return;
          }
          resolve(result as StudioProject);
        };
        request.send(body);
      });
      setProject(uploaded);
      setProjectName(uploaded.name);
      setSegments([]);
      setSpellingSuggestions({});
      setSpellingRejectedCount(0);
      setDuration(uploaded.duration);
      setCurrentTime(0);
      setMode("teluglish-roman");
      setSourceLanguage(undefined);
      projectToTranscribe = uploaded;
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Video upload failed.");
    } finally { setWorking(""); }
    if (projectToTranscribe) {
      try {
        const status = await api<{ gemini: boolean }>("/api/health");
        setGeminiAvailable(status.gemini);
        setServiceError("");
        if (status.gemini) void startTranscription(projectToTranscribe, transcriptionLanguage);
        else setShowGeminiSetup(true);
      } catch {
        setError("Your video was uploaded and saved, but the caption service is unavailable. Start the backend and try generating captions again.");
      }
    }
  }

  async function startTranscription(targetProject = project, language = transcriptionLanguage) {
    if (!targetProject) return;
    setError("");
    setWorking("Starting transcription");
    try {
      const { jobId } = await api<{ jobId: string }>(`/api/videos/${targetProject.id}/generate-captions`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ language }),
      });
      setJob({ progress: 0, message: "Queued for transcription" });
      setWorking("");
      let finished = false;
      while (!finished) {
        await new Promise((resolve) => window.setTimeout(resolve, 1100));
        const result = await api<{ status: string; progress: number; message: string; error?: string }>(`/api/jobs/${jobId}`);
        setJob({ progress: result.progress, message: result.message });
        if (result.status === "completed") {
          const updated = await api<StudioProject>(`/api/projects/${targetProject.id}`);
          setProject(updated);
          setSegments(updated.segments);
          setSpellingSuggestions({});
          setSpellingRejectedCount(0);
          const detected = updated.sourceLanguage;
          setSourceLanguage(detected);
          setMode("teluglish-roman");
          setJob(null);
          finished = true;
        } else if (result.status === "failed") {
          setJob(null);
          setError(result.error ?? "Transcription failed.");
          finished = true;
        }
      }
    } catch (transcriptionError) {
      setError(transcriptionError instanceof Error ? transcriptionError.message : "Transcription failed.");
      setJob(null);
      setWorking("");
    }
  }

  async function createTranslation(target: TranslationTarget, languageCode?: string, displayMode: CaptionMode = target) {
    if (!project?.id) {
      setError("Upload or open a valid project before translating captions.");
      return;
    }
    const key = target === "teluglish-roman"
      ? naturalTeluglishTrackKey
      : target === "translation" && languageCode
        ? translationStorageKey(languageCode)
        : target;
    const requestId = `${project.id}:${key}`;
    if (translationsInFlight.current.has(requestId)) return;
    translationsInFlight.current.add(requestId);
    setError("");
    setWorking(target === "teluglish-roman" ? "Writing natural Teluglish captions"
      : target === "roman" ? "Transliterating captions" : "Translating captions");
    try {
      const result = await api<{ segments: CaptionSegment[]; key?: string }>(`/api/projects/${project.id}/translate`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target,
          ...(languageCode ? { targetLanguage: languageCode } : {}),
          vocabulary,
        }),
      });
      const resultKey = result.key ?? key;
      setProject((current) => current ? { ...current, translations: { ...current.translations, [resultKey]: result.segments } } : current);
      setMode(displayMode);
    } catch (translationError) {
      setError(translationError instanceof Error ? translationError.message : "Translation failed.");
    } finally {
      translationsInFlight.current.delete(requestId);
      setWorking("");
    }
  }

  function setModeAndGenerate(next: CaptionMode) {
    setMode(next);
    const request = makeTranslationRequest(next, sourceLanguage, targetLanguage);
    if (request && project?.segments.length && !project.translations[request.key]) {
      void createTranslation(request.target, request.targetLanguage, next);
    }
  }

  function selectTranslationLanguage(languageCode: string) {
    setTargetLanguage(languageCode);
    if (project?.segments.length && mode === "translation") {
      void createTranslation("translation", languageCode, "translation");
    }
  }

  async function reviewSpellings() {
    if (!project || !displayedSegments.length || isBusy) return;
    setWorking("Checking words against the audio");
    setError("");
    setSpellingSuggestions({});
    setSpellingRejectedCount(0);
    try {
      const result = await api<{ suggestions: Array<{ id: string; original: string; corrected: string }>; rejectedCount: number }>(
        `/api/projects/${project.id}/correct-spelling`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key: currentTranslation?.key ?? "original",
            captions: displayedSegments.map(({ id, start, end, text }) => ({ id, start, end, text })),
            vocabulary,
          }),
        },
      );
      setSpellingSuggestions(Object.fromEntries(result.suggestions.map(({ id, original, corrected }) => [
        id, { original, corrected },
      ])));
      setSpellingRejectedCount(result.rejectedCount);
      if (!result.suggestions.length && !result.rejectedCount) setError("No spelling changes were suggested. The transcript was left unchanged.");
    } catch (correctionError) {
      setError(correctionError instanceof Error ? correctionError.message : "Could not check spellings against the audio.");
    } finally {
      setWorking("");
    }
  }

  async function applySpellingSuggestions(ids: string[]) {
    if (!project || !ids.length || isBusy) return;
    const acceptedIds = new Set(ids);
    const captions = displayedSegments.map((segment) => ({
      id: segment.id,
      text: acceptedIds.has(segment.id) ? spellingSuggestions[segment.id]?.corrected ?? segment.text : segment.text,
    }));
    setWorking("Applying approved spelling changes");
    setError("");
    try {
      const result = await api<{ key: string; segments: CaptionSegment[] }>(`/api/projects/${project.id}/track`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: currentTranslation?.key ?? "original", captions }),
      });
      if (result.key === "original") {
        setSegments(result.segments);
        setProject((current) => current ? { ...current, segments: result.segments } : current);
      } else {
        setProject((current) => current ? {
          ...current,
          translations: { ...current.translations, [result.key]: result.segments },
        } : current);
      }
      setSpellingSuggestions((current) => Object.fromEntries(
        Object.entries(current).filter(([id]) => !acceptedIds.has(id)),
      ));
    } catch (correctionError) {
      setError(correctionError instanceof Error ? correctionError.message : "Could not save approved spelling changes.");
    } finally {
      setWorking("");
    }
  }

  function updateSegment(id: string, patch: Partial<CaptionSegment>) {
    if (currentTranslation) {
      setProject((current) => {
        const track = current?.translations[currentTranslation.key];
        if (!current || !track) return current;
        return {
          ...current,
          translations: {
            ...current.translations,
            [currentTranslation.key]: track.map((segment) => {
              if (segment.id !== id) return segment;
              if (style.cinematic && patch.text !== undefined) {
                const words = patch.text.trim().split(/\s+/u);
                const splitAt = Math.max(1, Math.ceil(words.length / 3));
                return { ...segment, ...patch, scriptText: words.slice(0, splitAt).join(" "), headlineText: words.slice(splitAt).join(" ") };
              }
              return { ...segment, ...patch };
            }),
          },
        };
      });
      return;
    }
    setSegments((current) => current.map((segment) => {
      if (segment.id !== id) return segment;
      if (style.cinematic && patch.text !== undefined) {
        const words = patch.text.trim().split(/\s+/u);
        const splitAt = Math.max(1, Math.ceil(words.length / 3));
        return { ...segment, ...patch, scriptText: words.slice(0, splitAt).join(" "), headlineText: words.slice(splitAt).join(" ") };
      }
      return { ...segment, ...patch };
    }));
  }

  function selectTemplate(selected: Template) {
    pushHistory();
    setTemplate(selected);
    if (selected.style) {
      const presetStyle: Partial<StyleSettings> = {
        ...selected.style,
        fontFamily: selected.font,
        cinematic: selected.style.cinematic ?? false,
        karaoke: selected.style.karaoke ?? selected.effect === "karaoke",
        ...(selected.entrance ? { entranceAnimation: selected.entrance } : {}),
        ...(selected.exit ? { exitAnimation: selected.exit } : {}),
        ...(selected.continuous ? { continuousAnimation: selected.continuous } : {}),
      };
      applyStylePatch(presetStyle);
    } else if (selected.name === "Teluglish Viral") {
      changeStyle("cinematic", true);
      changeStyle("textColor", "#fff7ed");
      changeStyle("fontFamily", "Impact");
      changeStyle("positionX", 50);
      changeStyle("positionY", 75);
      changeStyle("scale", 1);
      setSegments((current) => current.map((segment) => {
        if (segment.scriptText !== undefined || segment.headlineText !== undefined) return segment;
        const wordsMatchText = segment.words && captionTextFromWords(segment.words).normalize("NFC") === segment.text.trim().normalize("NFC");
        const tokens = wordsMatchText ? segment.words?.map((word) => word.text) ?? [] : segment.text.trim().split(/\s+/u);
        const splitAt = Math.max(1, Math.ceil(tokens.length / 3));
        return {
          ...segment,
          scriptText: tokens.slice(0, splitAt).join(" "),
          headlineText: tokens.slice(splitAt).join(" "),
        };
      }));
    } else {
      changeStyle("cinematic", false);
      changeStyle("textColor", selected.color);
      changeStyle("fontFamily", selected.font);
      changeStyle("karaoke", selected.effect === "karaoke");
    }
  }

  function saveCurrentPreset() {
    const preset: Template = {
      id: `custom-${crypto.randomUUID()}`,
      name: `My preset ${customPresets.length + 1}`,
      category: "My presets",
      color: activeCaptionStyle.textColor,
      font: activeCaptionStyle.fontFamily,
      effect: "custom",
      style: { ...activeCaptionStyle },
      entrance: activeCaptionStyle.entranceAnimation,
      exit: activeCaptionStyle.exitAnimation,
      continuous: activeCaptionStyle.continuousAnimation,
    };
    setCustomPresets((current) => [...current, preset]);
    setTemplate(preset);
  }

  function duplicateCurrentPreset() {
    const copy: Template = {
      ...template,
      id: `custom-${crypto.randomUUID()}`,
      name: `${template.name} Copy`,
      category: "My presets",
      style: { ...activeCaptionStyle },
    };
    setCustomPresets((current) => [...current, copy]);
    setTemplate(copy);
  }

  function renameCurrentPreset() {
    if (!template.id?.startsWith("custom-")) return;
    const name = window.prompt("Rename this theme", template.name)?.trim();
    if (!name || name.length > 80) {
      if (name && name.length > 80) setError("Theme names must be 80 characters or fewer.");
      return;
    }
    const renamed = { ...template, name };
    setCustomPresets((current) => current.map((item) => item.id === template.id ? renamed : item));
    setTemplate(renamed);
  }

  function exportCurrentTheme() {
    const blob = new Blob([JSON.stringify({ schemaVersion: 1, theme: template }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${template.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "caption-theme"}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function importThemeFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 64 * 1024) {
      setError("Theme files must be 64 KB or smaller.");
      return;
    }
    try {
      const value: unknown = JSON.parse(await file.text());
      if (!value || typeof value !== "object" || !("schemaVersion" in value) || value.schemaVersion !== 1 ||
        !("theme" in value) || !value.theme || typeof value.theme !== "object") {
        throw new Error("This file is not a supported CaptionAI theme (schema version 1).");
      }
      const imported = value.theme as Record<string, unknown>;
      if (!("name" in imported) || typeof imported.name !== "string" || !imported.name.trim() || imported.name.length > 80 ||
        !("font" in imported) || typeof imported.font !== "string" || !imported.font.trim() || imported.font.length > 100 ||
        !("style" in imported) || !imported.style || typeof imported.style !== "object" || Array.isArray(imported.style)) {
        throw new Error("The theme is missing a valid name, font family, or style configuration.");
      }
      const importedStyle = imported.style as Record<string, unknown>;
      const allowedStyleKeys = new Set<keyof StyleSettings>([
        "fontFamily", "fontSize", "textColor", "backgroundColor", "backgroundOpacity", "outlineColor", "outlineWidth",
        "highlightColor", "weight", "italic", "position", "alignment", "positionX", "positionY", "scale", "rotation",
        "opacity", "shadowColor", "shadowBlur", "glowColor", "glowRadius", "lineSpacing", "maxWidth", "karaoke",
        "cinematic", "scriptFontFamily", "headlineFontFamily", "scriptColor", "headlineColor", "scriptFontSize",
        "headlineFontSize", "scriptRotation", "animation", "entranceAnimation", "exitAnimation", "continuousAnimation",
        "animationDuration", "animationDelay", "animationIntensity", "animationEasing", "animationLoop", "letterSpacing",
        "maxLines", "fontWeight", "textGradient", "gradientStart", "gradientEnd", "safeAreaGuides", "alignmentGuides",
        "centerSnapping", "gridSnapping", "topBannerText", "bottomBannerText",
      ]);
      const colorKeys = new Set(["textColor", "backgroundColor", "outlineColor", "highlightColor", "shadowColor", "glowColor", "scriptColor", "headlineColor", "gradientStart", "gradientEnd"]);
      const isEntrance = (effect: string): effect is NonNullable<CaptionPreset["entrance"]> =>
        ["none", "fade-in", "slide-up", "slide-down", "slide-left", "slide-right", "pop-in", "zoom-in", "bounce-in", "typewriter", "word-reveal", "letter-reveal", "stagger-words", "blur-clear", "rotate-in", "elastic-in"].includes(effect);
      const isExit = (effect: string): effect is NonNullable<CaptionPreset["exit"]> =>
        ["none", "fade-out", "slide-up-out", "slide-down-out", "slide-left-out", "slide-right-out", "zoom-out", "pop-out", "rotate-out", "blur-out"].includes(effect);
      const isContinuous = (effect: string): effect is NonNullable<CaptionPreset["continuous"]> =>
        ["none", "pulse", "floating", "gentle-bounce", "breathing-scale", "neon-glow", "karaoke", "active-word", "subtle-shake", "looping-highlight"].includes(effect);
      for (const [key, property] of Object.entries(importedStyle)) {
        if (!allowedStyleKeys.has(key as keyof StyleSettings) ||
          !(typeof property === "string" || typeof property === "number" && Number.isFinite(property) || typeof property === "boolean") ||
          typeof property === "string" && (property.length > 200 || colorKeys.has(key) && !/^#[\da-f]{6}$/i.test(property))) {
          throw new Error(`The imported theme contains an invalid style value: ${key}.`);
        }
      }
      for (const [key, isValid] of [
        ["entranceAnimation", isEntrance],
        ["exitAnimation", isExit],
        ["continuousAnimation", isContinuous],
      ] as const) {
        const effect = importedStyle[key];
        if (effect !== undefined && (typeof effect !== "string" || !isValid(effect))) {
          throw new Error(`The imported theme has an unsupported ${key}.`);
        }
      }
      for (const [key, isValid] of [
        ["entrance", isEntrance],
        ["exit", isExit],
        ["continuous", isContinuous],
      ] as const) {
        const effect = imported[key];
        if (effect !== undefined && (typeof effect !== "string" || !isValid(effect))) {
          throw new Error(`The imported theme has an unsupported ${key} effect.`);
        }
      }
      const theme: Template = {
        id: `custom-${crypto.randomUUID()}`,
        name: imported.name.trim(),
        category: "My presets",
        color: typeof imported.color === "string" && /^#[\da-f]{6}$/i.test(imported.color) ? imported.color : "#ffffff",
        font: imported.font,
        effect: typeof imported.effect === "string" ? imported.effect.slice(0, 80) : "custom",
        style: importedStyle as Partial<StyleSettings>,
        ...(typeof imported.entrance === "string" && isEntrance(imported.entrance) ? { entrance: imported.entrance } : {}),
        ...(typeof imported.exit === "string" && isExit(imported.exit) ? { exit: imported.exit } : {}),
        ...(typeof imported.continuous === "string" && isContinuous(imported.continuous) ? { continuous: imported.continuous } : {}),
      };
      setCustomPresets((current) => [...current, theme]);
      setTemplate(theme);
      setPresetCategory("My presets");
      setPresetSearch("");
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Could not import this caption theme.");
    }
  }

  function deleteCurrentCustomPreset() {
    if (!template.id?.startsWith("custom-")) return;
    setCustomPresets((current) => current.filter((item) => item.id !== template.id));
    setFavoritePresets((current) => current.filter((id) => id !== template.id));
    setTemplate(themeTemplates.find((item) => item.name === "Clean Subtitle") ?? themeTemplates[0]);
  }

  function splitIntoTimedPhrases() {
    if (!segments.length || segments.some((segment) =>
      !segment.words?.length || captionTextFromWords(segment.words).normalize("NFC") !== segment.text.trim().normalize("NFC"),
    )) {
      setError("Phrase splitting requires caption text to match its timed words. Restore the transcript or re-transcribe before splitting.");
      return;
    }
    pushHistory();
    setSegments((current) => current.flatMap((segment) => {
      const phrases: CaptionSegment[] = [];
      let words: NonNullable<CaptionSegment["words"]> = [];
      const flush = () => {
        if (!words.length) return;
        phrases.push({
          id: crypto.randomUUID(),
          start: words[0].start,
          end: words[words.length - 1].end,
          text: captionTextFromWords(words),
          words,
        });
        words = [];
      };
      for (const word of segment.words ?? []) {
        words.push(word);
        if (words.length >= 3 || /[.!?]$/u.test(word.text)) flush();
      }
      flush();
      return phrases;
    }));
  }

  function mergeWithNext(segmentId: string) {
    pushHistory();
    setSegments((current) => {
      const index = current.findIndex((segment) => segment.id === segmentId);
      const first = current[index];
      const next = current[index + 1];
      if (!first || !next) return current;
      const words = first.words && next.words ? [...first.words, ...next.words] : undefined;
      const merged: CaptionSegment = {
        ...first,
        end: next.end,
        text: `${first.text.trim()} ${next.text.trim()}`.trim(),
        ...(words ? { words } : {}),
        scriptText: [first.scriptText, next.scriptText].filter(Boolean).join(" "),
        headlineText: [first.headlineText, next.headlineText].filter(Boolean).join(" "),
      };
      return [...current.slice(0, index), merged, ...current.slice(index + 2)];
    });
  }

  async function runAutoTrim() {
    if (!project) return;
    setWorking("Reviewing audio");
    setError("");
    try {
      const result = await api<{ suggestions: Array<Omit<CutSuggestion, "accepted">> }>(`/api/projects/${project.id}/auto-trim`, { method: "POST" });
      setCuts(result.suggestions.map((cut) => ({ ...cut, accepted: false })));
      setShowTrim(true);
    } catch (trimError) { setError(trimError instanceof Error ? trimError.message : "Auto Trim failed."); }
    finally { setWorking(""); }
  }

  async function deleteProject() {
    if (!project || !window.confirm("Delete this project and its uploaded video and exports? This cannot be undone.")) return;
    setWorking("Deleting project");
    setError("");
    try {
      await api<void>(`/api/projects/${project.id}`, { method: "DELETE" });
      setProject(null);
      setProjectName("");
      setSegments([]);
      setSpellingSuggestions({});
      setSpellingRejectedCount(0);
      setCuts(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Project deletion failed.");
    } finally { setWorking(""); }
  }

  async function exportFile(format: "mp4" | "srt" | "vtt" | "txt") {
    if (!project) return;
    setWorking(format === "mp4" ? "Rendering captioned video" : `Preparing ${format.toUpperCase()} download`);
    setError("");
    try {
      if (currentTranslation) {
        await api(`/api/projects/${project.id}/track`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key: currentTranslation.key,
            captions: displayedSegments.map(({ id, text, style: captionStyle }) => ({
              id, text, style: captionStyle ?? null,
            })),
          }),
        });
      } else {
        await api<StudioProject>(`/api/projects/${project.id}/captions`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ segments }),
        });
      }
      const result = await api<{ url?: string; jobId?: string }>(`/api/projects/${project.id}/export`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: currentTranslation?.target ?? mode,
          ...(currentTranslation?.targetLanguage ? { targetLanguage: currentTranslation.targetLanguage } : {}),
          format, aspectRatio, resolution, style,
          cuts: cuts?.filter((cut) => cut.accepted).map(({ start, end }) => ({ start, end })) ?? [],
        }),
      });
      let url = result.url;
      if (result.jobId) {
        setWorking("");
        let complete = false;
        while (!complete) {
          await new Promise((resolve) => window.setTimeout(resolve, 900));
          const progress = await api<{ status: string; progress: number; message: string; error?: string; resultUrl?: string }>(`/api/jobs/${result.jobId}`);
          setJob({ progress: progress.progress, message: progress.message });
          if (progress.status === "completed") {
            url = progress.resultUrl;
            complete = true;
          } else if (progress.status === "failed") {
            throw new Error(progress.error ?? "Video render failed.");
          }
        }
        setJob(null);
      }
      if (!url) throw new Error("The export did not return a download link.");
      const link = document.createElement("a");
      link.href = url;
      link.download = `${project.name}-captions.${format}`;
      document.body.append(link);
      link.click();
      link.remove();
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Export failed.");
    } finally { setWorking(""); setJob(null); }
  }

  function seek(time: number) {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(0, Math.min(time, duration || project?.duration || 0));
    setCurrentTime(videoRef.current.currentTime);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    void uploadVideo(event.dataTransfer.files[0]);
  }

  function changeStyle<K extends keyof StyleSettings>(key: K, value: StyleSettings[K]) {
    applyStylePatch({ [key]: value });
  }

  function applyStylePatch(patch: Partial<StyleSettings>) {
    if ((styleScope === "selected" || styleScope === "selection") && activeSegment) {
      const targetIds = styleScope === "selection" && selectedSegmentIds.length
        ? new Set(selectedSegmentIds)
        : new Set([activeSegment.id]);
      const patchCaptions = (track: CaptionSegment[]) => track.map((segment) =>
        targetIds.has(segment.id) && !segment.locked
          ? { ...segment, style: { ...(segment.style ?? {}), ...patch } }
          : segment,
      );
      if (currentTranslation) {
        setProject((current) => current ? {
          ...current,
          translations: {
            ...current.translations,
            [currentTranslation.key]: patchCaptions(current.translations[currentTranslation.key] ?? []),
          },
        } : current);
      } else {
        setSegments(patchCaptions);
      }
      return;
    }
    setStyle((current) => ({ ...current, ...patch }));
    if (currentTranslation) {
      setProject((current) => {
        const track = current?.translations[currentTranslation.key];
        if (!current || !track) return current;
        return {
          ...current,
          translations: {
            ...current.translations,
            [currentTranslation.key]: track.map((segment) => ({ ...segment, style: { ...(segment.style ?? {}), ...patch } })),
          },
        };
      });
    } else {
      setSegments((current) => current.map((segment) => ({ ...segment, style: { ...(segment.style ?? {}), ...patch } })));
    }
  }

  // Motion recording controls
  function startRecordMotion() {
    if (!activeSegment || activeSegment.locked) return;
    pushHistory();
    setRecordingMotion(true);
    recordedKeyframesRef.current = [];
    lastRecordTimeRef.current = 0;
    void videoRef.current?.play();
  }

  function stopRecordMotion() {
    if (!recordingMotion) return;
    setRecordingMotion(false);
    videoRef.current?.pause();

    if (activeSegment && recordedKeyframesRef.current.length > 0) {
      const sorted = [...recordedKeyframesRef.current].sort((a, b) => a.time - b.time);
      updateSegment(activeSegment.id, {
        animation: {
          enabled: true,
          easing: "smooth",
          keyframes: sorted,
        },
      });
    }
  }

  // Transform change during drag
  function handleTransformChange(patch: { positionX?: number; positionY?: number; scale?: number; rotation?: number }) {
    if (!activeSegment || activeSegment.locked) return;

    if (recordingMotion) {
      const now = videoRef.current?.currentTime ?? currentTime;
      if (Math.abs(now - lastRecordTimeRef.current) >= 0.06) {
        lastRecordTimeRef.current = now;
        recordedKeyframesRef.current.push({
          id: crypto.randomUUID(),
          time: Math.round(now * 100) / 100,
          positionX: patch.positionX ?? currentTransform.positionX,
          positionY: patch.positionY ?? currentTransform.positionY,
          scale: patch.scale ?? currentTransform.scale,
          rotation: patch.rotation ?? currentTransform.rotation,
          opacity: currentTransform.opacity,
          easing: "smooth",
        });
      }
    }

    updateSegment(activeSegment.id, patch);
  }

  function handleTransformStart() {
    pushHistory();
  }

  // Keyframe controls
  function handleAddKeyframe(custom?: Partial<Keyframe>) {
    if (!activeSegment || activeSegment.locked) return;
    pushHistory();
    const existingKfs = activeSegment.animation?.keyframes ?? [];
    const currentT = Math.round(currentTime * 100) / 100;

    const newKf: Keyframe = {
      id: crypto.randomUUID(),
      time: currentT,
      positionX: currentTransform.positionX,
      positionY: currentTransform.positionY,
      scale: currentTransform.scale,
      rotation: currentTransform.rotation,
      opacity: currentTransform.opacity,
      easing: activeSegment.animation?.easing ?? "smooth",
      ...custom,
    };

    // Replace if keyframe at same timestamp exists, or insert
    const nextKfs = existingKfs.filter((k) => Math.abs(k.time - currentT) > 0.05);
    nextKfs.push(newKf);
    nextKfs.sort((a, b) => a.time - b.time);

    updateSegment(activeSegment.id, {
      animation: {
        enabled: true,
        easing: activeSegment.animation?.easing ?? "smooth",
        keyframes: nextKfs,
      },
    });
  }

  function handleDeleteKeyframe(keyframeId: string) {
    if (!activeSegment || activeSegment.locked) return;
    pushHistory();
    const existingKfs = activeSegment.animation?.keyframes ?? [];
    const nextKfs = existingKfs.filter((k) => k.id !== keyframeId);
    updateSegment(activeSegment.id, {
      animation: {
        enabled: nextKfs.length > 0,
        easing: activeSegment.animation?.easing ?? "smooth",
        keyframes: nextKfs,
      },
    });
  }

  function handleDuplicateAnimation() {
    if (!activeSegment || activeSegment.locked) return;
    pushHistory();
    const kfs = activeSegment.animation?.keyframes ?? [];
    const duplicatedKfs = kfs.map((k) => ({ ...k, id: crypto.randomUUID() }));
    updateSegment(activeSegment.id, {
      animation: {
        enabled: true,
        easing: activeSegment.animation?.easing ?? "smooth",
        keyframes: duplicatedKfs,
      },
    });
  }

  function handleResetAnimation() {
    if (!activeSegment || activeSegment.locked) return;
    pushHistory();
    updateSegment(activeSegment.id, {
      animation: {
        enabled: false,
        keyframes: [],
      },
    });
  }

  // Layer management controls
  function handleAddLayer() {
    if (!activeSegment || activeSegment.locked) return;
    pushHistory();
    const existingLayers = activeSegment.layers ?? [];
    const newLayer: CaptionLayer = {
      id: crypto.randomUUID(),
      name: `Layer ${existingLayers.length + 2}`,
      text: "New Text Layer",
      visible: true,
      locked: false,
      positionX: 50,
      positionY: 50,
      scale: 1,
      rotation: 0,
      opacity: 1,
    };
    updateSegment(activeSegment.id, {
      layers: [...existingLayers, newLayer],
    });
    setSelectedLayerId(newLayer.id);
  }

  function handleUpdateLayer(layerId: string, patch: Partial<CaptionLayer>) {
    if (!activeSegment || activeSegment.locked) return;
    const existingLayers = activeSegment.layers ?? [];
    updateSegment(activeSegment.id, {
      layers: existingLayers.map((l) => (l.id === layerId ? { ...l, ...patch } : l)),
    });
  }

  function handleDuplicateLayer(layerId: string) {
    if (!activeSegment || activeSegment.locked) return;
    pushHistory();
    const existingLayers = activeSegment.layers ?? [];
    const target = existingLayers.find((l) => l.id === layerId);
    if (!target) return;
    const dup: CaptionLayer = {
      ...target,
      id: crypto.randomUUID(),
      name: `${target.name} Copy`,
      positionY: Math.min(90, (target.positionY ?? 50) + 5),
    };
    updateSegment(activeSegment.id, {
      layers: [...existingLayers, dup],
    });
  }

  function handleDeleteLayer(layerId: string) {
    if (!activeSegment || activeSegment.locked) return;
    pushHistory();
    const existingLayers = activeSegment.layers ?? [];
    updateSegment(activeSegment.id, {
      layers: existingLayers.filter((l) => l.id !== layerId),
    });
    setSelectedLayerId("main");
  }

  function handleReorderLayer(layerId: string, direction: "up" | "down") {
    if (!activeSegment || activeSegment.locked) return;
    pushHistory();
    const existingLayers = [...(activeSegment.layers ?? [])];
    const index = existingLayers.findIndex((l) => l.id === layerId);
    if (index === -1) return;
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= existingLayers.length) return;
    const [moved] = existingLayers.splice(index, 1);
    existingLayers.splice(targetIdx, 0, moved);
    updateSegment(activeSegment.id, { layers: existingLayers });
  }

  // Reset position helper
  function handleResetPosition(type: "center" | "bottom" | "original" | "rotation") {
    if (!activeSegment || activeSegment.locked) return;
    pushHistory();
    if (type === "center") {
      updateSegment(activeSegment.id, { positionX: 50, positionY: 50 });
    } else if (type === "bottom") {
      updateSegment(activeSegment.id, { positionX: 50, positionY: 82 });
    } else if (type === "rotation") {
      updateSegment(activeSegment.id, { rotation: 0 });
    } else if (type === "original") {
      updateSegment(activeSegment.id, { positionX: 50, positionY: 82, scale: 1, rotation: 0, opacity: 1 });
    }
  }

  function deleteActiveCaption() {
    if (!activeSegment || activeSegment.locked) return;
    pushHistory();
    if (currentTranslation) {
      setProject((current) => current ? {
        ...current,
        translations: {
          ...current.translations,
          [currentTranslation.key]: (current.translations[currentTranslation.key] ?? [])
            .filter((segment) => segment.id !== activeSegment.id),
        },
      } : current);
    } else {
      setSegments((current) => current.filter((segment) => segment.id !== activeSegment.id));
    }
    setSelectedSegmentId(null);
  }

  function duplicateActiveCaption() {
    if (!activeSegment || activeSegment.locked) return;
    const span = Math.max(0.2, activeSegment.end - activeSegment.start);
    let start = activeSegment.end;
    let end = Math.min(project?.duration ?? start + span, start + span);
    if (end <= start) {
      end = activeSegment.start;
      start = Math.max(0, end - span);
    }
    if (end <= start) {
      setError("There is no available time range to duplicate this caption.");
      return;
    }
    pushHistory();
    const offset = start - activeSegment.start;
    const duplicate: CaptionSegment = {
      ...activeSegment,
      id: crypto.randomUUID(),
      start,
      end,
      words: activeSegment.words?.map((word) => ({
        ...word,
        id: crypto.randomUUID(),
        start: word.start + offset,
        end: word.end + offset,
      })),
      animation: activeSegment.animation ? {
        ...activeSegment.animation,
        keyframes: activeSegment.animation.keyframes.map((keyframe) => ({
          ...keyframe,
          id: crypto.randomUUID(),
          time: keyframe.time + offset,
        })),
      } : undefined,
    };
    if (currentTranslation) {
      setProject((current) => current ? {
        ...current,
        translations: {
          ...current.translations,
          [currentTranslation.key]: [...(current.translations[currentTranslation.key] ?? []), duplicate],
        },
      } : current);
    } else {
      setSegments((current) => [...current, duplicate]);
    }
    setSelectedSegmentId(duplicate.id);
  }

  function resetCaptionStyle() {
    pushHistory();
    const cleanWhite = themeTemplates.find((item) => item.name === "Clean Subtitle");
    const resetStyle = { ...defaultStyle, ...cleanWhite?.style, fontFamily: cleanWhite?.font ?? defaultStyle.fontFamily, cinematic: false };
    const targetIds = styleScope === "selected" && activeSegment
      ? new Set([activeSegment.id])
      : styleScope === "selection" && selectedSegmentIds.length
        ? new Set(selectedSegmentIds)
        : undefined;
    const resetSegments = (track: CaptionSegment[]) => track.map((segment) =>
      (!targetIds || targetIds.has(segment.id)) && !segment.locked
        ? { ...segment, style: resetStyle, positionX: 50, positionY: 82, scale: 1, rotation: 0, opacity: 1 }
        : segment,
    );
    if (currentTranslation) {
      setProject((current) => current ? {
        ...current,
        translations: {
          ...current.translations,
          [currentTranslation.key]: resetSegments(current.translations[currentTranslation.key] ?? []),
        },
      } : current);
      if (!targetIds) setStyle(resetStyle);
    } else {
      setSegments(resetSegments);
      if (!targetIds) setStyle(resetStyle);
    }
    setTemplate(cleanWhite ?? templates[0]);
  }

  const isBusy = Boolean(working || job);
  const exportFrameHeight = aspectRatio === "original"
    ? videoRef.current?.videoHeight || 1080
    : resolution === "720p" ? 720 : 1080;
  const previewScale = (videoRect.height || 360) / exportFrameHeight;
  const previewFontSize = Math.max(12, activeCaptionStyle.fontSize * previewScale);
  const captionDurationMs = activeCaptionStyle.animationDuration ?? 400;
  const captionExiting = Boolean(activeSegment && activeCaptionStyle.exitAnimation &&
    activeCaptionStyle.exitAnimation !== "none" &&
    currentTime >= activeSegment.end - Math.min(captionDurationMs / 1000, (activeSegment.end - activeSegment.start) / 2));
  const activeMotion = captionExiting
    ? exitMotion[activeCaptionStyle.exitAnimation ?? "none"]
    : entranceMotion[activeCaptionStyle.entranceAnimation ?? "none"];
  const loopMotion = continuousMotion[activeCaptionStyle.continuousAnimation ?? "none"];

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark"><AudioLines size={18} strokeWidth={2.5} /></span><span>caption<span className="brand-light">ai</span></span><span className="brand-divider" /><span className="studio-label">STUDIO</span></div>
        <div className="project-title">
          {project ? <><span className="status-dot" /> <input aria-label="Project name" value={projectName} onChange={(event) => setProjectName(event.target.value)} /> <ChevronDown size={14} /></> : <span className="muted">Your next story starts here</span>}
          {saving && <span className="saving-label">Saving</span>}
        </div>
        <div className="top-actions">
          <button className="icon-button" aria-label="Undo" title="Undo (Ctrl+Z)" onClick={handleUndo} disabled={!canUndo}><Undo2 size={17} /></button>
          <button className="icon-button" aria-label="Redo" title="Redo (Ctrl+Shift+Z)" onClick={handleRedo} disabled={!canRedo}><Redo2 size={17} /></button>
          <span className="top-separator" />
          <button className="help-button" aria-label="Help"><CircleHelp size={16} /><span>Help</span></button>
          <button className="export-button" onClick={() => void exportFile("mp4")} disabled={!project || isBusy || !displayedSegments.length || Boolean(currentTranslation && !project.translations[currentTranslation.key]?.length)}><ArrowDownToLine size={15} /> Export video</button>
        </div>
      </header>

      {!project ? (
        <section className={`welcome ${dragging ? "drop-active" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={handleDrop}>
          <div className="welcome-copy"><div className="eyebrow"><Sparkles size={13} /> YOUR STORY, IN EVERY WORD</div><h1>Good videos deserve<br /><em>great captions.</em></h1><p>Make every word count. Turn your video into a story people can watch anywhere.</p>
            {geminiAvailable === false && <button className="speech-setup-notice" onClick={() => setShowGeminiSetup(true)}><AudioLines size={15} /><span><b>Gemini needs configuration</b><small>Set the API key on the backend to generate captions</small></span><ChevronDown size={14} /></button>}
            {geminiAvailable === null && !serviceError && <span className="speech-setup-notice"><LoaderCircle size={15} /><span><b>Connecting to the local caption service…</b><small>Make sure both frontend and backend are running</small></span></span>}
            {geminiAvailable === null && serviceError && <span className="speech-setup-notice"><X size={15} /><span><b>Caption service unavailable</b><small>{serviceError} Start both servers with <code>npm run dev</code>.</small></span></span>}
            {geminiAvailable === true && <span className="speech-ready"><Check size={13} /> Gemini ready · auto-detect English / Telugu</span>}
          </div>
          <div className="upload-card">
            <div className="upload-icon"><CloudUpload size={24} /></div>
            <strong>Drop your video here</strong><span>or browse your files to get started</span>
            <label className="language-setup" htmlFor="upload-language">SPOKEN LANGUAGE <select id="upload-language" value={transcriptionLanguage} onChange={(event) => setTranscriptionLanguage(event.target.value)}><option value="auto">Auto-detect · all supported languages</option>{supportedLanguages.map((language) => <option key={language.code} value={language.code}>{language.name}</option>)}</select></label>
            <button className="primary-button" onClick={() => inputRef.current?.click()}><Plus size={16} /> Choose a video</button>
            <div className="file-note"><span>MP4</span><span>MOV</span><span>WEBM</span><i /> UP TO 3 MINUTES</div>
          </div>
          <div className="welcome-foot"><span><WandSparkles size={14} /> Made for the moments that matter.</span><span>English · తెలుగు · More ways to tell it</span></div>
        </section>
      ) : (
        <section className="editor">
          <aside className="left-panel">
            <div className="panel-top"><div><span className="panel-kicker">YOUR PROJECT</span><h2>Transcript</h2></div><button className="small-icon" title="Delete project" aria-label="Delete project" onClick={() => void deleteProject()}><Trash2 size={15} /></button></div>
            <div className="source-row"><span className="source-pill"><AudioLines size={13} /> {getLanguageName(sourceLanguage) ?? "Original speech · auto-detected"}</span><span className="duration-meta"><Clock3 size={12} /> {formatTime(project.duration)}</span></div>
            {project.status !== "ready" && !job ? (
              <div className="transcribe-box">
                <div className="transcribe-art"><Subtitles size={25} /></div>
                <strong>Let’s find the words.</strong>
                <p>Choose a voice language. Captions will sync to the spoken words and appear automatically in the preview.</p>
                {geminiAvailable === false && <div className="missing-key"><AudioLines size={14} /><span>Set GEMINI_API_KEY in the root .env file, then restart the backend.</span><button onClick={() => setShowGeminiSetup(true)}>Details</button></div>}
                <label className="field-label" htmlFor="spoken-language">SPOKEN LANGUAGE</label>
                <select id="spoken-language" value={transcriptionLanguage} onChange={(event) => setTranscriptionLanguage(event.target.value)}><option value="auto">Auto-detect · all supported languages</option>{supportedLanguages.map((language) => <option key={language.code} value={language.code}>{language.name}</option>)}</select>
                <button className="primary-button wide" onClick={() => geminiAvailable ? void startTranscription() : geminiAvailable === false ? setShowGeminiSetup(true) : setError("The local caption service is still starting. Please try again in a moment.")} disabled={isBusy || geminiAvailable === false}><Sparkles size={15} /> {geminiAvailable ? "Generate captions" : "Gemini configuration required"}</button>
              </div>
            ) : job ? (
              <div className="transcribe-box progress-box"><div className="progress-orb"><LoaderCircle size={23} /></div><strong>Listening closely…</strong><p>{job.message}</p><div className="progress-track"><span style={{ width: `${job.progress}%` }} /></div><span className="progress-number">{job.progress}%</span></div>
            ) : (
              <div className="transcript-list">
                <div className="list-meta">
                  <span>{displayedSegments.length} CAPTIONS</span>
                  <div className="transcript-actions">
                    <button type="button" className="phrase-split" onClick={() => setShowVocabulary(true)}>Vocabulary</button>
                    <button type="button" className="phrase-split" onClick={() => void reviewSpellings()} disabled={isBusy} title="Compare likely spelling corrections against the original audio">Check spelling</button>
                    <button type="button" className="phrase-split" onClick={splitIntoTimedPhrases} title="Group real word timestamps into editable phrases">Split to phrases</button>
                  </div>
                </div>
                {(Object.keys(spellingSuggestions).length > 0 || spellingRejectedCount > 0) && <div className="spelling-summary">
                  <span>{Object.keys(spellingSuggestions).length > 0 ? `${Object.keys(spellingSuggestions).length} suggested correction${Object.keys(spellingSuggestions).length === 1 ? "" : "s"} · review before applying` : "No safe spelling suggestions to apply"}{spellingRejectedCount > 0 ? ` · ${spellingRejectedCount} uncertain change${spellingRejectedCount === 1 ? "" : "s"} left unchanged` : ""}</span>
                  {Object.keys(spellingSuggestions).length > 0 && <button type="button" onClick={() => void applySpellingSuggestions(Object.keys(spellingSuggestions))} disabled={isBusy}>Apply all</button>}
                </div>}
                {segments.map((segment, index) => (
                  <article
                    className={`caption-row ${activeSegment?.id === segment.id ? "caption-active" : ""} ${selectedSegmentIds.includes(segment.id) ? "caption-multi-selected" : ""}`}
                    key={segment.id}
                    title="Shift-click to add or remove this caption from the multi-selection"
                    onClick={(event) => {
                      if (event.shiftKey) {
                        setSelectedSegmentIds((current) => current.includes(segment.id)
                          ? current.filter((id) => id !== segment.id)
                          : [...current, segment.id]);
                      } else {
                        setSelectedSegmentIds([segment.id]);
                      }
                      setSelectedSegmentId(segment.id);
                      seek(segment.start);
                    }}
                  >
                    <button className="timecode" onClick={(e) => { e.stopPropagation(); seek(segment.start); }}>{formatTime(segment.start)}</button>
                    <textarea aria-label={`Caption ${index + 1}`} value={displayedSegments[index]?.text ?? segment.text} rows={Math.min(3, Math.max(1, Math.ceil((displayedSegments[index]?.text ?? segment.text).length / 34)))} onChange={(event) => updateSegment(segment.id, { text: event.target.value })} onClick={(e) => e.stopPropagation()} />
                    {spellingSuggestions[segment.id] && <div className="spelling-review">
                      <div><small>ORIGINAL</small><p>{spellingSuggestions[segment.id].original}</p></div>
                      <div><small>LISTENING-BASED SUGGESTION</small><p>{spellingSuggestions[segment.id].corrected}</p></div>
                      <div className="spelling-actions">
                        <button type="button" onClick={() => void applySpellingSuggestions([segment.id])} disabled={isBusy}>Accept</button>
                        <button type="button" onClick={() => setSpellingSuggestions((current) => {
                          const next = { ...current };
                          delete next[segment.id];
                          return next;
                        })}>Keep original</button>
                      </div>
                    </div>}
                    {(segment.style?.cinematic ?? style.cinematic) && <div className="layer-editors"><label>DECORATIVE LAYER<input aria-label={`Decorative phrase for caption ${index + 1}`} value={segment.scriptText ?? ""} onChange={(event) => updateSegment(segment.id, { scriptText: event.target.value })} placeholder="Select a phrase to decorate" onClick={(e) => e.stopPropagation()} /></label><label>HEADLINE LAYER<input aria-label={`Headline phrase for caption ${index + 1}`} value={segment.headlineText ?? ""} onChange={(event) => updateSegment(segment.id, { headlineText: event.target.value })} placeholder="Headline phrase" onClick={(e) => e.stopPropagation()} /></label></div>}
                    <div className="timing-fields"><label><span>IN</span><input aria-label="Caption start time" type="number" min="0" max={project.duration} step="0.1" value={segment.start.toFixed(1)} onChange={(event) => updateSegment(segment.id, { start: Math.max(0, Number(event.target.value)) })} onClick={(e) => e.stopPropagation()} /></label><label><span>OUT</span><input aria-label="Caption end time" type="number" min="0" max={project.duration} step="0.1" value={segment.end.toFixed(1)} onChange={(event) => updateSegment(segment.id, { end: Math.max(segment.start + 0.1, Number(event.target.value)) })} onClick={(e) => e.stopPropagation()} /></label></div>
                    {index < segments.length - 1 && <button className="merge-caption" type="button" onClick={(e) => { e.stopPropagation(); mergeWithNext(segment.id); }}>Merge with next phrase</button>}
                  </article>
                ))}
                <button className="add-caption" onClick={() => {
                  pushHistory();
                  setSegments((current) => [...current, { id: crypto.randomUUID(), start: current.at(-1)?.end ?? 0, end: Math.min((current.at(-1)?.end ?? 0) + 2, project.duration), text: "New caption" }]);
                }}><Plus size={14} /> Add caption</button>
              </div>
            )}
            <div className="sidebar-footer"><button className="subtle-button" onClick={() => void runAutoTrim()} disabled={!segments.length || isBusy}><Scissors size={14} /> Auto Trim</button><button className="subtle-button" onClick={() => void exportFile("srt")} disabled={!segments.length || isBusy}><FileText size={13} /> SRT</button><button className="subtle-button" onClick={() => void exportFile("vtt")} disabled={!segments.length || isBusy}>VTT</button><button className="subtle-button" onClick={() => void exportFile("txt")} disabled={!segments.length || isBusy}>TXT</button></div>
          </aside>

          <section className="preview-column">
            <div className="preview-toolbar">
              <span><Film size={14} /> PREVIEW</span>
              {activeSegment && selectedSegmentId === activeSegment.id && (
                <div className="selection-actions" aria-label="Selected caption actions">
                  <button type="button" onClick={duplicateActiveCaption} disabled={activeSegment.locked} title="Duplicate caption"><Copy size={12} /> Duplicate</button>
                  <button type="button" onClick={() => handleResetPosition("original")} disabled={activeSegment.locked} title="Reset caption position and transform"><RotateCcw size={12} /> Reset</button>
                  <button type="button" onClick={deleteActiveCaption} disabled={activeSegment.locked} title="Delete caption"><Trash2 size={12} /> Delete</button>
                </div>
              )}
              <label className="select-wrap">
                <select aria-label="Export aspect ratio" className="preview-ratio" value={aspectRatio} onChange={(event) => setAspectRatio(event.target.value as typeof aspectRatio)}>
                  <option value="original">Original</option>
                  <option value="9:16">9:16 vertical</option>
                  <option value="1:1">1:1 square</option>
                  <option value="16:9">16:9 landscape</option>
                </select>
              </label>
              <label className="select-wrap">
                <select aria-label="Export resolution" className="preview-ratio" value={resolution} onChange={(event) => setResolution(event.target.value as typeof resolution)}>
                  <option value="720p">720p</option>
                  <option value="1080p">1080p</option>
                </select>
              </label>
              <button className="preview-fullscreen" title="Caption style" onClick={() => setTab("style")}><Settings2 size={14} /></button>
            </div>

            {/* Video Stage with Interactive Caption Canvas */}
            <div
              className="video-stage"
              ref={stageRef}
              onClick={() => setSelectedSegmentId(null)}
            >
              <video
                ref={videoRef}
                src={project.videoUrl}
                onLoadedMetadata={(event) => {
                  setDuration(event.currentTarget.duration || project.duration);
                }}
                onPlay={() => {
                  setPlaying(true);
                  setSelectedSegmentId(null);
                }}
                onPause={() => setPlaying(false)}
                playsInline
              />

              {/* Live Motion Recording Banner */}
              {recordingMotion && (
                <div className="record-motion-overlay" onClick={(e) => e.stopPropagation()}>
                  <span className="record-pulse-dot" />
                  <span>REC LIVE MOTION · {formatTime(currentTime)}</span>
                  <button type="button" className="record-stop-pill" onClick={stopRecordMotion}>Stop</button>
                </div>
              )}

              {/* Aspect-Ratio-Preserving Video Frame Overlay */}
              <div
                className="video-frame-overlay"
                style={{
                  left: `${videoRect.left}px`,
                  top: `${videoRect.top}px`,
                  width: `${videoRect.width || "100%"}px`,
                  height: `${videoRect.height || "100%"}px`,
                }}
              >
                {activeSegment && (
                  <TransformBox
                    positionX={currentTransform.positionX}
                    positionY={currentTransform.positionY}
                    scale={currentTransform.scale}
                    rotation={currentTransform.rotation}
                    opacity={currentTransform.opacity}
                    selected={selectedSegmentId === activeSegment.id}
                    onSelect={() => setSelectedSegmentId(activeSegment.id)}
                    locked={activeSegment.locked ?? false}
                    containerWidth={videoRect.width || 640}
                    containerHeight={videoRect.height || 360}
                    videoWidth={videoRef.current?.videoWidth || 1920}
                    videoHeight={videoRef.current?.videoHeight || 1080}
                    maxWidth={activeCaptionStyle.maxWidth ?? 90}
                    centerSnapping={activeCaptionStyle.centerSnapping ?? true}
                    safeAreaGuides={activeCaptionStyle.safeAreaGuides ?? false}
                    alignmentGuides={activeCaptionStyle.alignmentGuides ?? true}
                    onTransformChange={handleTransformChange}
                    onTransformStart={handleTransformStart}
                  >
                    {/* Render Inner Caption Content */}
                    {activeCaptionStyle.cinematic ? (() => {
                      const layers = captionLayers(activeSegment);
                      const backdrop = activeCaptionStyle.backgroundOpacity > 0 ? `${activeCaptionStyle.backgroundColor}${Math.round(activeCaptionStyle.backgroundOpacity * 255).toString(16).padStart(2, "0")}` : "transparent";
                      return (
                        <div className={`cinematic-caption ${activeSegment.animation?.enabled ? `animation-${activeCaptionStyle.animation ?? "pop"}` : ""}`}>
                          <div
                            className="cinematic-script"
                            style={{
                              color: activeCaptionStyle.scriptColor,
                              fontFamily: `"${activeCaptionStyle.scriptFontFamily}", Georgia, "Nirmala UI", serif`,
                              fontSize: `clamp(20px, ${activeCaptionStyle.scriptFontSize! / 19.2}cqw, ${activeCaptionStyle.scriptFontSize}px)`,
                              transform: `rotate(${activeCaptionStyle.scriptRotation}deg)`,
                              backgroundColor: backdrop,
                            }}
                          >
                            {layers.script}
                          </div>
                          <div
                            className="cinematic-headline"
                            style={{
                              color: activeCaptionStyle.headlineColor,
                              fontFamily: `"${activeCaptionStyle.headlineFontFamily}", Impact, "Nirmala UI", sans-serif`,
                              fontSize: `clamp(18px, ${activeCaptionStyle.headlineFontSize! / 19.2}cqw, ${activeCaptionStyle.headlineFontSize}px)`,
                              textAlign: activeCaptionStyle.alignment,
                              WebkitTextStroke: `${activeCaptionStyle.outlineWidth}px ${activeCaptionStyle.outlineColor}`,
                              backgroundColor: backdrop,
                            }}
                          >
                            {layers.headline.replace(/\p{Script=Latin}+/gu, (latin) => latin.toUpperCase())}
                          </div>
                        </div>
                      );
                    })() : (
                      <div
                        className={`caption-overlay effect-${template.effect} entrance-${activeCaptionStyle.entranceAnimation ?? "fade-in"} ${captionExiting ? `exit-${activeCaptionStyle.exitAnimation ?? "none"}` : ""} continuous-${activeCaptionStyle.continuousAnimation ?? "none"}`}
                        style={{
                          color: activeCaptionStyle.textGradient ? "transparent" : activeCaptionStyle.textColor,
                          backgroundImage: activeCaptionStyle.textGradient
                            ? `linear-gradient(90deg, ${activeCaptionStyle.gradientStart ?? activeCaptionStyle.textColor}, ${activeCaptionStyle.gradientEnd ?? activeCaptionStyle.highlightColor})`
                            : undefined,
                          backgroundClip: activeCaptionStyle.textGradient ? "text" : "border-box",
                          WebkitBackgroundClip: activeCaptionStyle.textGradient ? "text" : "border-box",
                          fontFamily: `"${activeCaptionStyle.fontFamily}", "Nirmala UI", "Noto Sans Telugu", sans-serif`,
                          fontSize: `${previewFontSize}px`,
                          textAlign: activeCaptionStyle.alignment,
                          fontWeight: activeCaptionStyle.fontWeight ?? activeCaptionStyle.weight,
                          fontStyle: activeCaptionStyle.italic ? "italic" : "normal",
                          lineHeight: activeCaptionStyle.lineSpacing ?? 1.25,
                          letterSpacing: `${activeCaptionStyle.letterSpacing ?? 0}em`,
                          display: activeCaptionStyle.maxLines ? "-webkit-box" : "block",
                          WebkitBoxOrient: activeCaptionStyle.maxLines ? "vertical" : undefined,
                          WebkitLineClamp: activeCaptionStyle.maxLines ?? "unset",
                          backgroundColor: activeCaptionStyle.backgroundOpacity ? `${activeCaptionStyle.backgroundColor}${Math.round(activeCaptionStyle.backgroundOpacity * 255).toString(16).padStart(2, "0")}` : "transparent",
                          WebkitTextStroke: `${activeCaptionStyle.outlineWidth * previewScale}px ${activeCaptionStyle.outlineColor}`,
                          textShadow: activeCaptionStyle.shadowBlur ? `0 ${Math.max(0.2, previewScale)}px ${Math.max(0.2, activeCaptionStyle.shadowBlur * previewScale)}px ${activeCaptionStyle.shadowColor ?? "#000000"}` : "none",
                          boxShadow: activeCaptionStyle.glowRadius && activeCaptionStyle.glowRadius > 0 ? `0 0 ${activeCaptionStyle.glowRadius}px ${activeCaptionStyle.glowColor}` : "none",
                          animationName: loopMotion === "none" ? activeMotion : `${activeMotion}, ${loopMotion}`,
                          animationDuration: loopMotion === "none" ? `${captionDurationMs}ms` : `${captionDurationMs}ms, 1800ms`,
                          animationDelay: loopMotion === "none" ? `${activeCaptionStyle.animationDelay ?? 0}ms` : `${activeCaptionStyle.animationDelay ?? 0}ms, 0ms`,
                          animationTimingFunction: loopMotion === "none" ? activeCaptionStyle.animationEasing ?? "ease-out" : `${activeCaptionStyle.animationEasing ?? "ease-out"}, ease-in-out`,
                          ["--animation-intensity" as string]: activeCaptionStyle.animationIntensity ?? 1,
                          animationIterationCount: loopMotion === "none" ? "1" : `1, ${activeCaptionStyle.animationLoop ? "infinite" : "1"}`,
                        }}
                      >
                        {(activeCaptionStyle.karaoke || activeCaptionStyle.continuousAnimation === "karaoke" || activeCaptionStyle.continuousAnimation === "active-word") && activeSegment.words?.length
                          && captionTextFromWords(activeSegment.words).normalize("NFC") === activeSegment.text.trim().normalize("NFC")
                          ? activeSegment.words.map((word) => (
                            <span key={word.id} className={currentTime >= word.start && currentTime <= word.end ? "caption-active-word" : ""} style={{ color: currentTime >= word.start && currentTime <= word.end ? activeCaptionStyle.highlightColor : activeCaptionStyle.textColor }}>
                              {word.text}{" "}
                            </span>
                          ))
                          : activeCaptionStyle.entranceAnimation === "word-reveal" || activeCaptionStyle.entranceAnimation === "stagger-words"
                            ? activeSegment.text.split(/(\s+)/u).map((part, index) => part.trim()
                              ? <span className="caption-reveal-word" key={`${index}-${part}`} style={{ animationDelay: `${(activeCaptionStyle.animationDelay ?? 0) + index * 65}ms` }}>{part}</span>
                              : part)
                            : activeSegment.text}
                      </div>
                    )}
                  </TransformBox>
                )}

                {!activeSegment && !segments.length && (
                  <div className="caption-overlay" style={{ left: "50%", top: "75%", transform: "translate(-50%, -50%)", color: "#ffffff88" }}>
                    Your captions will appear here
                  </div>
                )}
              </div>

              {!activeSegment && !playing && !recordingMotion && (
                <button className="stage-play" onClick={() => videoRef.current?.play()} aria-label="Play video">
                  <Play size={19} fill="currentColor" />
                </button>
              )}
            </div>

            {/* Transport Bar */}
            <div className="transport">
              <span className="transport-time">{formatTime(currentTime)} <i>/</i> {formatTime(duration || project.duration)}</span>
              <div className="transport-actions">
                <button className="icon-button" onClick={() => seek(currentTime - 5)} aria-label="Back five seconds">↶</button>
                <button className="play-button" onClick={() => playing ? videoRef.current?.pause() : void videoRef.current?.play()} aria-label={playing ? "Pause" : "Play"}>
                  {playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}
                </button>
                <button className="icon-button" onClick={() => seek(currentTime + 5)} aria-label="Forward five seconds">↷</button>
              </div>
              <span className="transport-speed">1× <ChevronDown size={11} /></span>
            </div>

            {/* Interactive Timeline with Trim Handles and Keyframe Diamonds */}
            <InteractiveTimeline
              duration={duration || project.duration}
              currentTime={currentTime}
              segments={displayedSegments}
              activeSegment={activeSegment}
              cuts={cuts}
              onSeek={seek}
              onTrimSegment={(segmentId, newStart, newEnd) => {
                updateSegment(segmentId, { start: newStart, end: newEnd });
              }}
              onTrimEnd={() => pushHistory()}
              onSelectSegment={(segmentId) => setSelectedSegmentId(segmentId)}
            />
          </section>

          {/* Right Panel Tabs */}
          <aside className="right-panel">
            <div className="right-tabs">
              <button className={tab === "templates" ? "selected" : ""} onClick={() => setTab("templates")}><Clapperboard size={14} /> Templates <span className="count">{templates.length}</span></button>
              <button className={tab === "style" ? "selected" : ""} onClick={() => setTab("style")}><Settings2 size={14} /> Style</button>
              <button className={tab === "animation" ? "selected" : ""} onClick={() => setTab("animation")}><Radio size={14} /> Animation</button>
              <button className={tab === "layers" ? "selected" : ""} onClick={() => setTab("layers")}><Layers size={14} /> Layers</button>
            </div>

            <div className="mode-picker">
              <label className="field-label" htmlFor="caption-mode">CAPTION OUTPUT</label>
              <select id="caption-mode" value={mode} onChange={(event) => setModeAndGenerate(event.target.value as CaptionMode)}>
                {modes.map((item) => <option key={item.id} value={item.id}>{item.label} · {item.native}</option>)}
              </select>
              <p className="mode-description">Natural Teluglish is the default derived track. The raw speech transcript stays unchanged; choose English translation only when you want translation.</p>
              {mode === "translation" && <label className="field-label" htmlFor="translation-language">TRANSLATE INTO<select id="translation-language" value={targetLanguage} onChange={(event) => selectTranslationLanguage(event.target.value)}>{supportedLanguages.map((language) => <option key={language.code} value={language.code}>{language.name}</option>)}</select></label>}
              {canTranslate && currentTranslation && <button className="translate-button" onClick={() => void createTranslation(currentTranslation.target, currentTranslation.targetLanguage, mode)} disabled={isBusy}><Languages size={13} /> {mode === "teluglish-roman" ? "Regenerate Teluglish with preferences" : mode === "roman" || mode === "native-mix" ? "Convert writing system" : "Create translation"}</button>}
            </div>

            {tab === "templates" && (
              <div className="template-content">
                <div className="template-heading"><div><h3>Caption Themes</h3><p>{captionThemes.length} curated themes · preview your caption before applying</p></div></div>
                <input className="catalog-search" aria-label="Search caption presets" placeholder="Search presets…" value={presetSearch} onChange={(event) => setPresetSearch(event.target.value)} />
                <div className="catalog-filter-row">
                  <select aria-label="Filter preset category" value={presetCategory} onChange={(event) => setPresetCategory(event.target.value)}>
                    <option>All</option>{visibleTemplateCategories.map((category) => <option key={category}>{category}</option>)}
                  </select>
                  <button type="button" className={showFavoritesOnly ? "catalog-favorite active" : "catalog-favorite"} onClick={() => setShowFavoritesOnly((current) => !current)}>★ Favorites</button>
                </div>
                <button type="button" className="legacy-theme-toggle" aria-pressed={showLegacyTemplates} onClick={() => {
                  setShowLegacyTemplates((current) => !current);
                  setPresetCategory("All");
                }}>
                  {showLegacyTemplates ? "Hide additional preset library" : `Browse ${templates.length} additional presets`}
                </button>
                <input ref={themeImportRef} type="file" accept="application/json,.json" hidden aria-label="Import caption theme JSON" onChange={(event) => void importThemeFile(event)} />
                <div className="catalog-actions theme-file-actions">
                  <button type="button" onClick={exportCurrentTheme}><ArrowDownToLine size={12} /> Export JSON</button>
                  <button type="button" onClick={() => themeImportRef.current?.click()}><CloudUpload size={12} /> Import JSON</button>
                </div>
                <div className="catalog-actions">
                  <button type="button" onClick={saveCurrentPreset}><Plus size={12} /> Save custom</button>
                  <button type="button" onClick={duplicateCurrentPreset}><Copy size={12} /> Duplicate</button>
                  {template.id?.startsWith("custom-") && <button type="button" onClick={renameCurrentPreset}>Rename</button>}
                  {template.id?.startsWith("custom-") && <button type="button" onClick={deleteCurrentCustomPreset}><Trash2 size={12} /> Delete</button>}
                </div>
                <label className="style-scope-control">Apply style to
                  <select aria-label="Style application scope" value={styleScope} onChange={(event) => setStyleScope(event.target.value as "selected" | "selection" | "track")}>
                    <option value="selected" disabled={!activeSegment}>Selected caption</option><option value="selection" disabled={!selectedSegmentIds.length}>Selected captions ({selectedSegmentIds.length})</option>
                    <option value="track">Entire caption track</option>
                  </select>
                </label>
                <div className="template-grid">
                  {visibleTemplates.map((item, index) => {
                    const previewStyle = item.style ?? {};
                    const isSelected = template.id ? template.id === item.id : template.name === item.name;
                    const words = themePreviewText.trim().split(/\s+/u).filter(Boolean).slice(0, 4);
                    const previewText = words.length ? words.join(" ") : "Caption preview";
                    const scriptText = words.slice(0, Math.max(1, Math.ceil(words.length / 3))).join(" ");
                    const headlineText = words.slice(Math.max(1, Math.ceil(words.length / 3))).join(" ");
                    return (
                      <article key={item.id ?? item.name} className="template-card-wrap">
                        <button className={`template-card ${isSelected ? "chosen" : ""}`} onClick={() => selectTemplate(item)} aria-label={`Preview and apply ${item.name} caption theme`} aria-pressed={isSelected}>
                          <span className={`template-thumb thumb-${index % 10}`} style={{ "--sample-color": item.color } as React.CSSProperties}>
                            <span className="thumb-art" />
                            <span className="theme-card-caption">
                              {previewStyle.cinematic ? (
                                <span className="theme-card-cinematic">
                                  <span style={{ color: previewStyle.scriptColor, fontFamily: `"${previewStyle.scriptFontFamily}", "Nirmala UI", "Noto Sans Telugu", cursive`, fontSize: "1.12em", textShadow: previewStyle.shadowBlur ? `0 1px ${Math.max(1, previewStyle.shadowBlur / 2)}px ${previewStyle.shadowColor ?? "#000"}` : "none", WebkitTextStroke: `${Math.min(1, previewStyle.outlineWidth ?? 0)}px ${previewStyle.outlineColor ?? "#111"}` }}>{scriptText || previewText}</span>
                                  {headlineText && <span style={{ color: previewStyle.headlineColor, fontFamily: `"${previewStyle.headlineFontFamily}", Impact, "Nirmala UI", "Noto Sans Telugu", sans-serif`, fontWeight: "bold", fontSize: "0.92em", textTransform: "uppercase", textShadow: previewStyle.shadowBlur ? `0 1px ${Math.max(1, previewStyle.shadowBlur / 2)}px ${previewStyle.shadowColor ?? "#000"}` : "none", WebkitTextStroke: `${Math.min(1, previewStyle.outlineWidth ?? 0)}px ${previewStyle.outlineColor ?? "#111"}` }}>{headlineText}</span>}
                                </span>
                              ) : (
                                <span
                                  className={`thumb-caption effect-${item.effect}`}
                                  style={{
                                    color: previewStyle.textColor ?? item.color,
                                    fontFamily: `"${previewStyle.fontFamily ?? item.font}", "Nirmala UI", "Noto Sans Telugu", sans-serif`,
                                    fontWeight: previewStyle.fontWeight ?? previewStyle.weight ?? "bold",
                                    fontSize: `${Math.max(10, Math.min(16, (previewStyle.fontSize ?? 42) / 3))}px`,
                                    lineHeight: previewStyle.lineSpacing ?? 1.2,
                                    letterSpacing: `${previewStyle.letterSpacing ?? 0}em`,
                                    textShadow: previewStyle.shadowBlur ? `0 1px ${Math.max(1, previewStyle.shadowBlur)}px ${previewStyle.shadowColor ?? "#000"}` : "none",
                                    WebkitTextStroke: `${previewStyle.outlineWidth ?? 0}px ${previewStyle.outlineColor ?? "#111"}`,
                                    backgroundColor: previewStyle.backgroundOpacity
                                      ? `${previewStyle.backgroundColor ?? "#111111"}${Math.round(previewStyle.backgroundOpacity * 255).toString(16).padStart(2, "0")}`
                                      : "transparent",
                                  }}
                                >
                                  {previewStyle.karaoke
                                    ? previewText.split(/\s+/u).map((word, wordIndex) => (
                                      <span key={`${wordIndex}-${word}`} style={{ color: wordIndex % 2 ? previewStyle.highlightColor ?? item.color : previewStyle.textColor ?? item.color }}>{word}{wordIndex < words.length - 1 ? " " : ""}</span>
                                    ))
                                    : previewText}
                                </span>
                              )}
                            </span>
                            <span className="thumb-category">{item.category}</span>
                          </span>
                          <span className="template-name">{item.name}{isSelected && <Check size={12} />}</span>
                        </button>
                        <button type="button" className={`preset-star ${favoritePresets.includes(item.id ?? item.name) ? "selected" : ""}`} aria-label={`${favoritePresets.includes(item.id ?? item.name) ? "Remove" : "Add"} ${item.name} ${favoritePresets.includes(item.id ?? item.name) ? "from" : "to"} favorites`} onClick={() => setFavoritePresets((current) => current.includes(item.id ?? item.name) ? current.filter((id) => id !== (item.id ?? item.name)) : [...current, item.id ?? item.name])}>★</button>
                      </article>
                    );
                  })}
                  {!visibleTemplates.length && <p className="catalog-empty">No matching presets. Try a different search or category.</p>}
                </div>
                <div className="template-tip"><Sparkles size={14} /><span>{template.id?.startsWith("theme-") ? `Selected theme: ${template.name}. Customize its style in the Style tab; preview changes immediately.` : "Theme cards preview the current caption text. Google Fonts load in the browser when selected; MP4 font availability depends on fonts installed on the rendering computer."}</span></div>
              </div>
            )}

            {tab === "style" && (
              <div className="style-content">
                <div className="style-section">
                  <div className="style-heading"><span>TYPEFACE</span><button className="custom-font" onClick={() => setShowFonts(true)}>Browse fonts <ArrowDownToLine size={12} /></button></div>
                  <label className="style-scope-control">Apply controls to
                    <select aria-label="Style editor application scope" value={styleScope} onChange={(event) => setStyleScope(event.target.value as "selected" | "selection" | "track")}>
                      <option value="selected" disabled={!activeSegment}>Selected caption</option><option value="selection" disabled={!selectedSegmentIds.length}>Selected captions ({selectedSegmentIds.length})</option><option value="track">Entire caption track</option>
                    </select>
                  </label>
                  <button className="font-select" onClick={() => setShowFonts(true)}><span style={{ fontFamily: `"${activeCaptionStyle.fontFamily}", "Nirmala UI", sans-serif` }}>{activeCaptionStyle.fontFamily}</span><ChevronDown size={14} /></button>
                  <div className="range-row"><label>Size</label><input aria-label="Caption font size" type="range" min="16" max="120" value={activeCaptionStyle.fontSize} onChange={(event) => changeStyle("fontSize", Number(event.target.value))} /><span>{activeCaptionStyle.fontSize}px</span></div>
                  <div className="range-row"><label>Weight</label><input aria-label="Caption font weight" type="range" min="100" max="900" step="100" value={activeCaptionStyle.fontWeight ?? (activeCaptionStyle.weight === "bold" ? 700 : 400)} onChange={(event) => changeStyle("fontWeight", event.target.valueAsNumber as NonNullable<StyleSettings["fontWeight"]>)} /><span>{activeCaptionStyle.fontWeight ?? (activeCaptionStyle.weight === "bold" ? 700 : 400)}</span></div>
                  <div className="toggle-row">
                    <button className={activeCaptionStyle.weight === "bold" ? "toggle selected" : "toggle"} onClick={() => changeStyle("weight", activeCaptionStyle.weight === "bold" ? "normal" : "bold")}><b>B</b> Bold</button>
                    <button className={activeCaptionStyle.italic ? "toggle selected" : "toggle"} onClick={() => changeStyle("italic", !activeCaptionStyle.italic)}><i>I</i> Italic</button>
                    <button className={`toggle align-toggle align-${activeCaptionStyle.alignment}`} onClick={() => changeStyle("alignment", activeCaptionStyle.alignment === "center" ? "left" : activeCaptionStyle.alignment === "left" ? "right" : "center")}>≡ Align</button>
                  </div>
                  <div className="range-row"><label>Letter space</label><input aria-label="Caption letter spacing" type="range" min="-0.05" max="0.12" step="0.01" value={activeCaptionStyle.letterSpacing ?? 0} onChange={(event) => changeStyle("letterSpacing", Number(event.target.value))} /><span>{(activeCaptionStyle.letterSpacing ?? 0).toFixed(2)}em</span></div>
                  <div className="range-row"><label>Max lines</label><input aria-label="Caption maximum lines" type="range" min="1" max="5" value={activeCaptionStyle.maxLines ?? 2} onChange={(event) => changeStyle("maxLines", Number(event.target.value))} /><span>{activeCaptionStyle.maxLines ?? 2}</span></div>
                </div>

                {activeCaptionStyle.cinematic && (
                  <div className="style-section layer-style-controls">
                    <div className="style-heading"><span>LAYER A · DECORATIVE SCRIPT</span></div>
                    <select aria-label="Decorative layer font" value={activeCaptionStyle.scriptFontFamily} onChange={(event) => changeStyle("scriptFontFamily", event.target.value as NonNullable<StyleSettings["scriptFontFamily"]>)}><option>Segoe Script</option><option>Georgia</option><option>Arial</option><option>Nirmala UI</option></select>
                    <ColorInput label="Script color" value={activeCaptionStyle.scriptColor ?? "#fff7ed"} onChange={(value) => changeStyle("scriptColor", value)} />
                    <div className="range-row"><label>Script size</label><input aria-label="Script layer size" type="range" min="24" max="140" value={activeCaptionStyle.scriptFontSize ?? 76} onChange={(event) => changeStyle("scriptFontSize", Number(event.target.value))} /><span>{activeCaptionStyle.scriptFontSize}px</span></div>
                    <div className="range-row"><label>Rotation</label><input aria-label="Script layer rotation" type="range" min="-180" max="180" value={activeCaptionStyle.scriptRotation ?? -4} onChange={(event) => changeStyle("scriptRotation", Number(event.target.value))} /><span>{activeCaptionStyle.scriptRotation}°</span></div>
                    <div className="style-heading layer-subheading"><span>LAYER B · HEADLINE</span></div>
                    <select aria-label="Headline layer font" value={activeCaptionStyle.headlineFontFamily} onChange={(event) => changeStyle("headlineFontFamily", event.target.value as NonNullable<StyleSettings["headlineFontFamily"]>)}><option>Impact</option><option>Arial</option><option>Georgia</option><option>Nirmala UI</option></select>
                    <ColorInput label="Headline color" value={activeCaptionStyle.headlineColor ?? "#ff3434"} onChange={(value) => changeStyle("headlineColor", value)} />
                    <div className="range-row"><label>Headline size</label><input aria-label="Headline layer size" type="range" min="24" max="140" value={activeCaptionStyle.headlineFontSize ?? 64} onChange={(event) => changeStyle("headlineFontSize", Number(event.target.value))} /><span>{activeCaptionStyle.headlineFontSize}px</span></div>
                  </div>
                )}

                <div className="style-section">
                  <div className="style-heading"><span>COLOR & EFFECTS</span></div>
                  <ColorInput label="Text color" value={activeCaptionStyle.textColor} onChange={(value) => changeStyle("textColor", value)} />
                  <div className="toggle-row"><button className={activeCaptionStyle.textGradient ? "toggle selected" : "toggle"} onClick={() => changeStyle("textGradient", !activeCaptionStyle.textGradient)}>Gradient text · preview only</button></div>
                  {activeCaptionStyle.textGradient && <><ColorInput label="Gradient start" value={activeCaptionStyle.gradientStart ?? "#ffffff"} onChange={(value) => changeStyle("gradientStart", value)} /><ColorInput label="Gradient end" value={activeCaptionStyle.gradientEnd ?? "#ffe34d"} onChange={(value) => changeStyle("gradientEnd", value)} /></>}
                  <ColorInput label="Highlight" value={activeCaptionStyle.highlightColor} onChange={(value) => changeStyle("highlightColor", value)} />
                  <ColorInput label="Background" value={activeCaptionStyle.backgroundColor} onChange={(value) => changeStyle("backgroundColor", value)} />
                  <div className="range-row"><label>Opacity</label><input aria-label="Caption background opacity" type="range" min="0" max="100" value={activeCaptionStyle.backgroundOpacity * 100} onChange={(event) => changeStyle("backgroundOpacity", Number(event.target.value) / 100)} /><span>{Math.round(activeCaptionStyle.backgroundOpacity * 100)}%</span></div>
                  <ColorInput label="Outline" value={activeCaptionStyle.outlineColor} onChange={(value) => changeStyle("outlineColor", value)} />
                  <div className="range-row"><label>Thickness</label><input aria-label="Caption outline thickness" type="range" min="0" max="8" value={activeCaptionStyle.outlineWidth} onChange={(event) => changeStyle("outlineWidth", Number(event.target.value))} /><span>{activeCaptionStyle.outlineWidth}px</span></div>
                  <ColorInput label="Shadow" value={activeCaptionStyle.shadowColor ?? "#000000"} onChange={(value) => changeStyle("shadowColor", value)} />
                  <div className="range-row"><label>Blur</label><input aria-label="Shadow blur" type="range" min="0" max="20" value={activeCaptionStyle.shadowBlur ?? 3} onChange={(event) => changeStyle("shadowBlur", Number(event.target.value))} /><span>{activeCaptionStyle.shadowBlur ?? 3}px</span></div>
                  <ColorInput label="Glow" value={activeCaptionStyle.glowColor ?? "#d2fa56"} onChange={(value) => changeStyle("glowColor", value)} />
                  <div className="range-row"><label>Glow size</label><input aria-label="Caption glow intensity" type="range" min="0" max="30" value={activeCaptionStyle.glowRadius ?? 0} onChange={(event) => changeStyle("glowRadius", Number(event.target.value))} /><span>{activeCaptionStyle.glowRadius ?? 0}px</span></div>
                </div>

                <div className="style-section">
                  <div className="style-heading"><span>PLACEMENT & GUIDES</span></div>
                  <div className="range-row"><label>Horizontal</label><input aria-label="Caption horizontal position" type="range" min="5" max="95" value={activeSegment?.positionX ?? activeCaptionStyle.positionX ?? 50} onChange={(event) => {
                    const positionX = Number(event.target.value);
                    changeStyle("positionX", positionX);
                    if (activeSegment) updateSegment(activeSegment.id, { positionX });
                  }} /><span>{Math.round(activeSegment?.positionX ?? activeCaptionStyle.positionX ?? 50)}%</span></div>
                  <div className="range-row"><label>Vertical</label><input aria-label="Caption vertical position" type="range" min="5" max="95" value={activeSegment?.positionY ?? activeCaptionStyle.positionY ?? 75} onChange={(event) => {
                    const positionY = Number(event.target.value);
                    changeStyle("positionY", positionY);
                    if (activeSegment) updateSegment(activeSegment.id, { positionY });
                  }} /><span>{Math.round(activeSegment?.positionY ?? activeCaptionStyle.positionY ?? 75)}%</span></div>
                  <div className="range-row"><label>Rotation</label><input aria-label="Caption rotation" type="range" min="-180" max="180" value={activeSegment?.rotation ?? activeCaptionStyle.rotation ?? 0} onChange={(event) => {
                    const rotation = Number(event.target.value);
                    changeStyle("rotation", rotation);
                    if (activeSegment) updateSegment(activeSegment.id, { rotation });
                  }} /><span>{Math.round(activeSegment?.rotation ?? activeCaptionStyle.rotation ?? 0)}°</span></div>
                  <div className="range-row"><label>Scale</label><input aria-label="Caption scale" type="range" min="0.3" max="3" step="0.05" value={activeSegment?.scale ?? activeCaptionStyle.scale ?? 1} onChange={(event) => {
                    const scale = Number(event.target.value);
                    changeStyle("scale", scale);
                    if (activeSegment) updateSegment(activeSegment.id, { scale });
                  }} /><span>{(activeSegment?.scale ?? activeCaptionStyle.scale ?? 1).toFixed(2)}×</span></div>
                  <div className="range-row"><label>Max width</label><input aria-label="Caption maximum text width" type="range" min="50" max="100" value={activeCaptionStyle.maxWidth ?? 90} onChange={(event) => changeStyle("maxWidth", Number(event.target.value))} /><span>{activeCaptionStyle.maxWidth ?? 90}%</span></div>
                  <div className="range-row"><label>Line space</label><input aria-label="Caption line spacing" type="range" min="1" max="2" step="0.05" value={activeCaptionStyle.lineSpacing ?? 1.3} onChange={(event) => changeStyle("lineSpacing", Number(event.target.value))} /><span>{(activeCaptionStyle.lineSpacing ?? 1.3).toFixed(2)}</span></div>
                  <div className="placement-buttons">
                    {(["top", "center", "bottom"] as const).map((position) => (
                      <button key={position} className={activeCaptionStyle.position === position ? "picked" : ""} onClick={() => {
                        changeStyle("position", position);
                        changeStyle("positionY", position === "top" ? 20 : position === "center" ? 50 : 82);
                        if (activeSegment) updateSegment(activeSegment.id, { positionY: position === "top" ? 20 : position === "center" ? 50 : 82 });
                      }}>
                        <span className={`placement-preview ${position}`} /><span>{position[0].toUpperCase() + position.slice(1)}</span>
                      </button>
                    ))}
                  </div>

                  <div className="toggle-row" style={{ marginTop: "12px" }}>
                    <button className={activeCaptionStyle.safeAreaGuides ? "toggle selected" : "toggle"} onClick={() => changeStyle("safeAreaGuides", !activeCaptionStyle.safeAreaGuides)}>Safe Guides</button>
                    <button className={activeCaptionStyle.alignmentGuides !== false ? "toggle selected" : "toggle"} onClick={() => changeStyle("alignmentGuides", activeCaptionStyle.alignmentGuides === false)}>Snap Guides</button>
                    <button className={activeCaptionStyle.centerSnapping !== false ? "toggle selected" : "toggle"} onClick={() => changeStyle("centerSnapping", activeCaptionStyle.centerSnapping === false)}>Center Snap</button>
                  </div>
                  <button className="save-theme reset-style" type="button" onClick={resetCaptionStyle}><RotateCcw size={13} /> Reset caption style</button>
                </div>

                <button className="save-theme" onClick={saveCurrentPreset}><Check size={14} /> Save as my theme</button>
              </div>
            )}

            {tab === "animation" && (
              <div className="style-content">
                <div className="style-section">
                  <div className="style-heading"><span>CAPTION TEXT MOTION</span></div>
                  <label className="field-label">ENTRANCE
                    <select aria-label="Caption entrance animation" value={activeCaptionStyle.entranceAnimation ?? "fade-in"} onChange={(event) => changeStyle("entranceAnimation", event.target.value as NonNullable<StyleSettings["entranceAnimation"]>)}>
                      {["none", "fade-in", "slide-up", "slide-down", "slide-left", "slide-right", "pop-in", "zoom-in", "bounce-in", "typewriter", "word-reveal", "letter-reveal", "stagger-words", "blur-clear", "rotate-in", "elastic-in"].map((effect) => <option key={effect} value={effect}>{effect.replaceAll("-", " ")}</option>)}
                    </select>
                  </label>
                  <label className="field-label">EXIT
                    <select aria-label="Caption exit animation" value={activeCaptionStyle.exitAnimation ?? "fade-out"} onChange={(event) => changeStyle("exitAnimation", event.target.value as NonNullable<StyleSettings["exitAnimation"]>)}>
                      {["none", "fade-out", "slide-up-out", "slide-down-out", "slide-left-out", "slide-right-out", "zoom-out", "pop-out", "rotate-out", "blur-out"].map((effect) => <option key={effect} value={effect}>{effect.replaceAll("-", " ")}</option>)}
                    </select>
                  </label>
                  <label className="field-label">CONTINUOUS / WORD EFFECT
                    <select aria-label="Caption continuous animation" value={activeCaptionStyle.continuousAnimation ?? "none"} onChange={(event) => changeStyle("continuousAnimation", event.target.value as NonNullable<StyleSettings["continuousAnimation"]>)}>
                      {["none", "pulse", "floating", "gentle-bounce", "breathing-scale", "neon-glow", "karaoke", "active-word", "subtle-shake", "looping-highlight"].map((effect) => <option key={effect} value={effect}>{effect.replaceAll("-", " ")}</option>)}
                    </select>
                  </label>
                  <div className="range-row"><label>Duration</label><input aria-label="Caption animation duration" type="range" min="100" max="1800" step="50" value={activeCaptionStyle.animationDuration ?? 400} onChange={(event) => changeStyle("animationDuration", Number(event.target.value))} /><span>{activeCaptionStyle.animationDuration ?? 400}ms</span></div>
                  <div className="range-row"><label>Delay</label><input aria-label="Caption animation delay" type="range" min="0" max="1000" step="25" value={activeCaptionStyle.animationDelay ?? 0} onChange={(event) => changeStyle("animationDelay", Number(event.target.value))} /><span>{activeCaptionStyle.animationDelay ?? 0}ms</span></div>
                  <div className="range-row"><label>Intensity</label><input aria-label="Caption animation intensity" type="range" min="0.2" max="2" step="0.1" value={activeCaptionStyle.animationIntensity ?? 1} onChange={(event) => changeStyle("animationIntensity", Number(event.target.value))} /><span>{(activeCaptionStyle.animationIntensity ?? 1).toFixed(1)}×</span></div>
                  <label className="field-label">EASING
                    <select aria-label="Caption animation easing" value={activeCaptionStyle.animationEasing ?? "ease-out"} onChange={(event) => changeStyle("animationEasing", event.target.value as NonNullable<StyleSettings["animationEasing"]>)}>
                      <option value="linear">Linear</option><option value="ease-in">Ease in</option><option value="ease-out">Ease out</option><option value="ease-in-out">Ease in-out</option>
                    </select>
                  </label>
                  <div className="toggle-row"><button className={activeCaptionStyle.animationLoop ? "toggle selected" : "toggle"} onClick={() => changeStyle("animationLoop", !activeCaptionStyle.animationLoop)}>Loop continuous effect</button></div>
                  <div className="catalog-actions"><button type="button" onClick={() => activeSegment && seek(activeSegment.start)} disabled={!activeSegment}><Play size={12} /> Replay preview</button><button type="button" onClick={() => { changeStyle("entranceAnimation", "none"); changeStyle("exitAnimation", "none"); changeStyle("continuousAnimation", "none"); }}><RotateCcw size={12} /> Reset effects</button></div>
                  <p className="animation-export-note">MP4 supports fade/slide/pop/zoom entrances, fade-out, and timed karaoke. Typewriter, per-word reveals, blur, rotate, and continuous CSS effects are preview-only. Word effects require real word timestamps.</p>
                </div>
                <AnimationPanel
                  segment={activeSegment}
                  currentTime={currentTime}
                  duration={duration || project.duration}
                  recordingMotion={recordingMotion}
                  onStartRecordMotion={startRecordMotion}
                  onStopRecordMotion={stopRecordMotion}
                  onAddKeyframe={handleAddKeyframe}
                  onDeleteKeyframe={handleDeleteKeyframe}
                  onSeekTo={seek}
                  onChangeEasing={(easing: EasingType) => {
                    if (!activeSegment) return;
                    pushHistory();
                    updateSegment(activeSegment.id, {
                      animation: { enabled: true, keyframes: activeSegment.animation?.keyframes ?? [], easing },
                    });
                  }}
                  onToggleLoop={(loop: boolean) => {
                    if (!activeSegment) return;
                    pushHistory();
                    updateSegment(activeSegment.id, {
                      animation: { enabled: true, keyframes: activeSegment.animation?.keyframes ?? [], loop },
                    });
                  }}
                  onDuplicateAnimation={handleDuplicateAnimation}
                  onResetAnimation={handleResetAnimation}
                  onToggleAnimationEnabled={(enabled: boolean) => {
                    if (!activeSegment) return;
                    pushHistory();
                    updateSegment(activeSegment.id, {
                      animation: { enabled, keyframes: activeSegment.animation?.keyframes ?? [] },
                    });
                  }}
                />
              </div>
            )}

            {tab === "layers" && (
              <LayersPanel
                segment={activeSegment}
                activeLayerId={selectedLayerId}
                onSelectLayer={(layerId) => setSelectedLayerId(layerId)}
                onAddLayer={handleAddLayer}
                onUpdateLayer={handleUpdateLayer}
                onDuplicateLayer={handleDuplicateLayer}
                onDeleteLayer={handleDeleteLayer}
                onReorderLayer={handleReorderLayer}
                onUpdateSegment={(patch) => {
                  if (activeSegment) updateSegment(activeSegment.id, patch);
                }}
              />
            )}

            <div className="mode-footer"><span>CAPTION LANGUAGE</span><div className="mode-chip-row"><button className={mode === "teluglish-roman" ? "active" : ""} onClick={() => setModeAndGenerate("teluglish-roman")}>ROMAN</button><button className={mode === "native-mix" ? "active" : ""} onClick={() => setModeAndGenerate("native-mix")}>తె + EN</button><button className={mode === "english-translation" ? "active" : ""} onClick={() => setModeAndGenerate("english-translation")}>EN</button><button className="mode-more" onClick={() => setTab("style")}><MoreHorizontal size={15} /></button></div></div>
          </aside>
        </section>
      )}

      {(working || job) && <div className="working-toast"><LoaderCircle size={16} />{working || job?.message}<span>{job && `${job.progress}%`}</span></div>}
      {error && <div className="error-toast" role="alert"><span>{error}</span><button onClick={() => setError("")} aria-label="Dismiss error"><X size={15} /></button></div>}
      {showTrim && <div className="modal-backdrop"><section className="trim-modal" role="dialog" aria-modal="true" aria-labelledby="trim-title"><div className="modal-title"><div><div className="eyebrow"><Scissors size={13} /> EDITING SUGGESTIONS</div><h2 id="trim-title">A little more momentum.</h2><p>Review every suggestion. Nothing changes until you accept it.</p></div><button className="small-icon" onClick={() => setShowTrim(false)} aria-label="Close"><X size={17} /></button></div>{cuts?.length ? <div className="cut-list">{cuts.map((cut) => <label className={`cut-item ${cut.accepted ? "cut-accepted" : ""}`} key={cut.id}><input type="checkbox" checked={cut.accepted} onChange={(event) => setCuts((current) => current?.map((item) => item.id === cut.id ? { ...item, accepted: event.target.checked } : item) ?? null)} /><span><b>{cut.reason}</b><small>{formatTime(cut.start)} → {formatTime(cut.end)} · {Math.max(0, cut.end - cut.start).toFixed(1)}s</small></span><button type="button" className="cut-preview" onClick={() => seek(cut.start)}>Preview</button></label>)}</div> : <div className="empty-trim"><Check size={21} /><strong>Nothing to trim just yet.</strong><span>No long pauses or obvious filler words were detected in this transcript.</span></div>}<div className="modal-actions"><button className="subtle-button" onClick={() => setShowTrim(false)}>Keep everything</button><button className="primary-button" onClick={() => setShowTrim(false)}><Check size={14} /> Save suggestions</button></div></section></div>}
      {showFonts && <div className="modal-backdrop"><section className="font-modal" role="dialog" aria-modal="true" aria-labelledby="font-title"><div className="modal-title"><div><div className="eyebrow"><FileAudio2 size={13} /> FONT LIBRARY</div><h2 id="font-title">Browse {fontFamilies.length} font families.</h2><p>Google Fonts load on demand in preview. Telugu-capable fonts are identified; other families fall back to Nirmala UI for Telugu glyphs.</p></div><button className="small-icon" onClick={() => setShowFonts(false)} aria-label="Close"><X size={17} /></button></div><input className="font-search" placeholder="Search fonts…" value={fontSearch} onChange={(event) => setFontSearch(event.target.value)} /><select className="font-category-filter" aria-label="Filter font category" value={fontCategory} onChange={(event) => setFontCategory(event.target.value as "All" | FontCategory)}><option>All</option>{[...new Set(fontFamilies.map((font) => font.category))].map((category) => <option key={category}>{category}</option>)}</select><div className="font-list">{fontFamilies.filter((font) => font.family.toLowerCase().includes(fontSearch.toLowerCase()) && (fontCategory === "All" || font.category === fontCategory)).map((font) => <button key={font.family} onClick={() => { changeStyle("fontFamily", font.family); setShowFonts(false); }}><span style={{ fontFamily: `"${font.family}", "Nirmala UI", sans-serif` }}>{font.family}<small className="font-specimen">తెలుగు · Ekkada unnava?</small></span><small>{font.category} · {font.teluguSupport === "verified" ? "Telugu" : "fallback"} · {font.exportSupport === "verified-system" ? "system font" : "MP4 system-dependent"}</small></button>)}</div><div className="font-note"><strong>Selected font: {activeCaptionStyle.fontFamily} · {fontLoadStatus === "loading" ? "loading" : fontLoadStatus === "available" ? "available in browser" : "unavailable; using fallback"}</strong><span>Web fonts are not bundled into MP4 renders. The FFmpeg renderer uses a matching font installed on its host, or its explicit system fallback; font selection does not claim that an uninstalled family is available for export.</span></div></section></div>}
      {showVocabulary && <div className="modal-backdrop"><section className="font-modal vocabulary-modal" role="dialog" aria-modal="true" aria-labelledby="vocabulary-title">
        <div className="modal-title"><div><div className="eyebrow"><Languages size={13} /> SPEECH VOCABULARY</div><h2 id="vocabulary-title">Choose your spellings.</h2><p>Set preferred Roman spellings for Telugu words, names, places, and brands. Aliases help the model recognize them, but are applied only when a matching word is already in the transcript. Audio spelling review also checks each suggestion against its original time range.</p></div><button className="small-icon" onClick={() => setShowVocabulary(false)} aria-label="Close"><X size={17} /></button></div>
        <form className="vocabulary-entry" onSubmit={(event) => {
          event.preventDefault();
          const preferred = vocabularyEntry.trim();
          const aliases = [...new Set([preferred, ...vocabularyAliasesEntry.split(",").map((alias) => alias.trim()).filter(Boolean)])];
          if (preferred && !vocabulary.some((item) => item.preferred.toLocaleLowerCase() === preferred.toLocaleLowerCase())) {
            setVocabulary((current) => [...current, { preferred, aliases }]);
          }
          setVocabularyEntry("");
          setVocabularyAliasesEntry("");
        }}>
          <input aria-label="Add a preferred spelling" value={vocabularyEntry} onChange={(event) => setVocabularyEntry(event.target.value)} placeholder="Preferred Roman spelling or name" maxLength={100} />
          <input aria-label="Add spoken or misspelled aliases" value={vocabularyAliasesEntry} onChange={(event) => setVocabularyAliasesEntry(event.target.value)} placeholder="Telugu / phonetic aliases, comma separated" maxLength={500} />
          <button type="submit" disabled={!vocabularyEntry.trim()}>Add</button>
        </form>
        <div className="vocabulary-list">{vocabulary.map((term, index) => <div className="vocabulary-term" key={`${index}-${term.preferred}`}>
          <input aria-label={`Preferred spelling ${index + 1}`} value={term.preferred} onChange={(event) => {
            const preferred = event.target.value;
            setVocabulary((current) => current.map((item, itemIndex) => itemIndex === index
              ? { ...item, preferred, aliases: [preferred, ...item.aliases.filter((alias) => alias !== item.preferred)] }
              : item));
          }} maxLength={100} />
          <input aria-label={`Spoken aliases ${index + 1}`} value={term.aliases.filter((alias) => alias !== term.preferred).join(", ")} onChange={(event) => {
            const aliases = [...new Set([term.preferred, ...event.target.value.split(",").map((alias) => alias.trim()).filter(Boolean)])];
            setVocabulary((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, aliases } : item));
          }} maxLength={500} />
          <button type="button" aria-label={`Remove ${term.preferred}`} onClick={() => setVocabulary((current) => current.filter((_item, itemIndex) => itemIndex !== index))}><X size={13} /></button>
        </div>)}</div>
        <div className="modal-actions"><button className="primary-button" onClick={() => setShowVocabulary(false)}>Done</button></div>
      </section></div>}
      {showGeminiSetup && <div className="modal-backdrop"><section className="font-modal key-modal" role="dialog" aria-modal="true" aria-labelledby="gemini-setup-title"><div className="modal-title"><div><div className="eyebrow"><AudioLines size={13} /> GEMINI VOICE CAPTIONS</div><h2 id="gemini-setup-title">Configure the caption service.</h2><p>The backend needs a Google Gemini API key before it can transcribe audio. The key must stay server-side and is never entered into this browser.</p></div><button className="small-icon" onClick={() => setShowGeminiSetup(false)} aria-label="Close"><X size={17} /></button></div><div className="font-note"><strong>Set up a Gemini API key</strong><span>Add <code>GEMINI_API_KEY=your_key</code> to the project root <code>.env</code> file, then restart the backend. Get a key from <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">Google AI Studio</a>.</span></div><div className="modal-actions"><button className="subtle-button" onClick={() => setShowGeminiSetup(false)}>Close</button><button className="primary-button" onClick={() => { void api<{ gemini: boolean }>("/api/health").then((status) => { setGeminiAvailable(status.gemini); setServiceError(""); if (status.gemini) setShowGeminiSetup(false); }).catch((statusError: unknown) => { const message = statusError instanceof Error ? statusError.message : "Could not reach the caption service."; setServiceError(message); setGeminiAvailable(null); setError(message); }); }}>Check connection</button></div></section></div>}
      <input ref={inputRef} className="visually-hidden" type="file" accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm" onChange={(event: ChangeEvent<HTMLInputElement>) => void uploadVideo(event.target.files?.[0])} />
    </main>
  );
}

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="color-row"><span>{label}</span><input aria-label={`${label} color`} type="color" value={value} onChange={(event) => onChange(event.target.value)} /><input className="hex-input" aria-label={`${label} hex value`} value={value.toUpperCase()} onChange={(event) => /^#[\da-f]{6}$/i.test(event.target.value) && onChange(event.target.value)} maxLength={7} /></label>;
}

function formatTime(time: number): string {
  const safeTime = Number.isFinite(time) ? Math.max(0, time) : 0;
  return `${Math.floor(safeTime / 60).toString().padStart(2, "0")}:${Math.floor(safeTime % 60).toString().padStart(2, "0")}`;
}

export default App;
