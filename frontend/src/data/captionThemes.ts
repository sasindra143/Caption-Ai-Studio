import type { StyleSettings } from "../domain";
import type { CaptionPreset, PresetCategory } from "./captionCatalog";

type ThemeDefinition = {
  name: string;
  category: PresetCategory;
  font: string;
  text: string;
  highlight: string;
  weight?: "normal" | "bold";
  size?: number;
  outline?: string;
  outlineWidth?: number;
  shadow?: number;
  background?: string;
  backgroundOpacity?: number;
  position?: "top" | "center" | "bottom";
  positionY?: number;
  lineSpacing?: number;
  maxWidth?: number;
  entrance?: NonNullable<StyleSettings["entranceAnimation"]>;
  exit?: NonNullable<StyleSettings["exitAnimation"]>;
  continuous?: NonNullable<StyleSettings["continuousAnimation"]>;
  karaoke?: boolean;
  italic?: boolean;
  letterSpacing?: number;
  cinematic?: boolean;
  scriptFont?: string;
  headlineFont?: string;
  scriptColor?: string;
  headlineColor?: string;
};

const definitions: ThemeDefinition[] = [
  { name: "Signature Script + Red Impact", category: "Cursive and handwritten", font: "Impact", text: "#ffffff", highlight: "#f20d22", size: 66, weight: "bold", outline: "#171111", outlineWidth: 1.5, shadow: 4, position: "center", positionY: 42, lineSpacing: 1.05, maxWidth: 90, entrance: "slide-up", cinematic: true, scriptFont: "Segoe Script", headlineFont: "Impact", scriptColor: "#ffffff", headlineColor: "#f20d22" },
  { name: "Red Script Split", category: "Cursive and handwritten", font: "Impact", text: "#ffffff", highlight: "#f20d22", size: 52, weight: "bold", outline: "#171111", outlineWidth: 1.5, shadow: 4, positionY: 78, lineSpacing: 1.05, maxWidth: 92, entrance: "slide-up", cinematic: true, scriptFont: "Segoe Script", headlineFont: "Impact", scriptColor: "#ffffff", headlineColor: "#f20d22" },
  { name: "Gold Script Split", category: "Cinematic and film", font: "Impact", text: "#fff6dc", highlight: "#f4b942", size: 48, weight: "bold", outline: "#21190d", outlineWidth: 1, shadow: 3, positionY: 78, lineSpacing: 1.05, maxWidth: 92, entrance: "fade-in", cinematic: true, scriptFont: "Segoe Script", headlineFont: "Anton", scriptColor: "#fff6dc", headlineColor: "#f4b942" },
  { name: "Neon Cyan Split", category: "Neon and gaming", font: "Orbitron", text: "#f5fcff", highlight: "#20e6ff", size: 46, weight: "bold", outline: "#071522", outlineWidth: 1.5, shadow: 5, positionY: 78, lineSpacing: 1.05, maxWidth: 92, entrance: "pop-in", cinematic: true, scriptFont: "Segoe Script", headlineFont: "Orbitron", scriptColor: "#f5fcff", headlineColor: "#20e6ff" },
  { name: "Lime Script Split", category: "Social-media creator", font: "Anton", text: "#ffffff", highlight: "#b9ff35", size: 50, weight: "bold", outline: "#14180b", outlineWidth: 1.5, shadow: 3, positionY: 78, lineSpacing: 1.05, maxWidth: 92, entrance: "pop-in", cinematic: true, scriptFont: "Segoe Script", headlineFont: "Anton", scriptColor: "#ffffff", headlineColor: "#b9ff35" },
  { name: "Center Script", category: "Cursive and handwritten", font: "Segoe Script", text: "#fffdf8", highlight: "#f2c078", size: 54, weight: "normal", outline: "#241d1a", outlineWidth: 0.5, shadow: 3, position: "center", positionY: 48, maxWidth: 86, entrance: "fade-in" },
  { name: "Script Duo", category: "Cursive and handwritten", font: "Dancing Script", text: "#ffffff", highlight: "#f5a6b8", size: 50, outline: "#171717", outlineWidth: 0.5, shadow: 3, positionY: 77, maxWidth: 90, entrance: "fade-in" },
  { name: "Red Signature", category: "Cursive and handwritten", font: "Satisfy", text: "#fffdf8", highlight: "#ef233c", size: 48, outline: "#191919", outlineWidth: 0.75, shadow: 3, positionY: 78, entrance: "slide-up" },
  { name: "Lyrical Pop", category: "Cursive and handwritten", font: "Pacifico", text: "#ffffff", highlight: "#ffd166", size: 46, outline: "#121212", outlineWidth: 1, shadow: 3, positionY: 76, entrance: "pop-in" },
  { name: "Ink Flow", category: "Cursive and handwritten", font: "Caveat", text: "#ffffff", highlight: "#a7c7e7", size: 54, outline: "#171717", outlineWidth: 0.5, shadow: 2, positionY: 80, lineSpacing: 1.25, entrance: "fade-in" },
  { name: "Bold Impact", category: "Viral and bold", font: "Anton", text: "#ffffff", highlight: "#ffcc00", size: 54, weight: "bold", outline: "#111111", outlineWidth: 2, shadow: 2, positionY: 78, maxWidth: 94, entrance: "pop-in" },
  { name: "Viral Stack", category: "Viral and bold", font: "Archivo Black", text: "#ffffff", highlight: "#ff4d6d", size: 48, weight: "bold", outline: "#101010", outlineWidth: 1.5, shadow: 3, positionY: 77, lineSpacing: 1.05, entrance: "bounce-in" },
  { name: "Punch Headline", category: "Viral and bold", font: "Bebas Neue", text: "#f8f9fa", highlight: "#ff595e", size: 52, weight: "bold", outline: "#161616", outlineWidth: 1.25, shadow: 3, positionY: 79, maxWidth: 92, entrance: "slide-up" },
  { name: "Red Power Words", category: "Viral and bold", font: "Oswald", text: "#ffffff", highlight: "#ff3030", size: 46, weight: "bold", outline: "#151515", outlineWidth: 1.5, shadow: 2, positionY: 78, entrance: "pop-in" },

  { name: "Karaoke Highlight", category: "Special effects", font: "Inter", text: "#ffffff", highlight: "#d2fa56", size: 42, weight: "bold", outline: "#151515", outlineWidth: 1, shadow: 1, positionY: 82, karaoke: true, continuous: "karaoke", entrance: "fade-in" },
  { name: "Word Pop", category: "Special effects", font: "Poppins", text: "#ffffff", highlight: "#00e5ff", size: 44, weight: "bold", outline: "#101010", outlineWidth: 1, shadow: 2, karaoke: true, positionY: 78, entrance: "pop-in" },
  { name: "Active Word Glow", category: "Special effects", font: "Montserrat", text: "#f7f7ff", highlight: "#a855f7", size: 42, weight: "bold", outline: "#12121c", outlineWidth: 1, shadow: 3, karaoke: true, continuous: "active-word", positionY: 80, entrance: "fade-in" },
  { name: "Editorial", category: "Cinematic and film", font: "Playfair Display", text: "#f8f4ec", highlight: "#d8b879", size: 40, outline: "#141414", outlineWidth: 0.5, shadow: 3, positionY: 78, maxWidth: 84, entrance: "fade-in" },
  { name: "Cinematic Serif", category: "Cinematic and film", font: "Lora", text: "#fffdf8", highlight: "#e5c07b", size: 38, outline: "#161616", outlineWidth: 0.5, shadow: 4, positionY: 80, lineSpacing: 1.4, entrance: "fade-in", exit: "fade-out" },
  { name: "Film Subtitle", category: "Cinematic and film", font: "Georgia", text: "#ffffff", highlight: "#ffffff", size: 36, outline: "#080808", outlineWidth: 0.75, shadow: 2, background: "#101010", backgroundOpacity: 0.2, positionY: 86, maxWidth: 88, entrance: "fade-in", exit: "fade-out" },
  { name: "Premium Gold", category: "Cinematic and film", font: "Merriweather", text: "#fff4d6", highlight: "#e9c46a", size: 38, outline: "#221b10", outlineWidth: 0.5, shadow: 4, positionY: 78, entrance: "fade-in" },

  { name: "Neon Script", category: "Neon and gaming", font: "Caveat", text: "#e7fbff", highlight: "#00f5d4", size: 52, outline: "#04131b", outlineWidth: 1, shadow: 6, positionY: 78, continuous: "neon-glow", entrance: "fade-in" },
  { name: "Electric Blue", category: "Neon and gaming", font: "Orbitron", text: "#f4fbff", highlight: "#00a6fb", size: 40, weight: "bold", outline: "#06152b", outlineWidth: 1.5, shadow: 5, positionY: 79, entrance: "zoom-in" },
  { name: "Cyber Stack", category: "Neon and gaming", font: "Rajdhani", text: "#ffffff", highlight: "#f72585", size: 46, weight: "bold", outline: "#160a21", outlineWidth: 1.5, shadow: 4, background: "#111827", backgroundOpacity: 0.24, positionY: 78, entrance: "slide-up" },

  { name: "Sticker Pop", category: "Social-media creator", font: "Baloo 2", text: "#ffffff", highlight: "#ff70a6", size: 44, weight: "bold", outline: "#291c2c", outlineWidth: 2, shadow: 2, positionY: 78, entrance: "bounce-in" },
  { name: "Comic Caption", category: "Social-media creator", font: "Bangers", text: "#fffdf2", highlight: "#ffbe0b", size: 48, weight: "bold", outline: "#161616", outlineWidth: 2, shadow: 2, positionY: 78, entrance: "pop-in" },
  { name: "Marker Highlight", category: "Social-media creator", font: "Kalam", text: "#ffffff", highlight: "#f9c74f", size: 42, weight: "bold", outline: "#191919", outlineWidth: 0.5, shadow: 1, background: "#f9c74f", backgroundOpacity: 0.32, positionY: 80, entrance: "fade-in" },

  { name: "Clean Subtitle", category: "Minimal and clean", font: "Inter", text: "#ffffff", highlight: "#d2fa56", size: 38, outline: "#101010", outlineWidth: 1, shadow: 1, positionY: 84, maxWidth: 88, entrance: "fade-in" },
  { name: "Podcast Clean", category: "Podcast and talking-head", font: "Manrope", text: "#ffffff", highlight: "#c7fa56", size: 38, outline: "#111111", outlineWidth: 0.5, shadow: 1, background: "#090909", backgroundOpacity: 0.58, positionY: 84, maxWidth: 90, entrance: "fade-in" },
  { name: "Broadcast Bar", category: "Educational and business", font: "Roboto", text: "#ffffff", highlight: "#d2fa56", size: 36, outline: "#101010", outlineWidth: 0, shadow: 0, background: "#101010", backgroundOpacity: 0.72, positionY: 82, maxWidth: 90, entrance: "slide-up" },
  { name: "Accessible Caption", category: "Telugu captions", font: "Noto Sans Telugu", text: "#ffffff", highlight: "#ffe34d", size: 42, weight: "bold", outline: "#111111", outlineWidth: 1.5, shadow: 2, positionY: 82, maxWidth: 92, lineSpacing: 1.4, entrance: "fade-in" },

  { name: "Telugu Creator", category: "Telugu captions", font: "Noto Sans Telugu", text: "#ffffff", highlight: "#d2fa56", size: 42, weight: "bold", outline: "#111111", outlineWidth: 1, shadow: 1, positionY: 82, maxWidth: 92, lineSpacing: 1.4, entrance: "pop-in" },
  { name: "Telugu-English Mix", category: "Telugu-English mixed captions", font: "Noto Sans Telugu", text: "#ffffff", highlight: "#ffcb77", size: 40, weight: "normal", outline: "#141414", outlineWidth: 0.75, shadow: 2, positionY: 82, maxWidth: 92, lineSpacing: 1.4, entrance: "fade-in" },
  { name: "Teluglish Karaoke", category: "Telugu-English mixed captions", font: "Noto Sans Telugu", text: "#ffffff", highlight: "#ffdf00", size: 42, weight: "bold", outline: "#111111", outlineWidth: 1, shadow: 1, positionY: 82, maxWidth: 92, lineSpacing: 1.35, karaoke: true, continuous: "karaoke", entrance: "fade-in" },

  { name: "Script Lessons", category: "Cursive and handwritten", font: "Impact", text: "#ffffff", highlight: "#ff2737", size: 46, weight: "bold", outline: "#171111", outlineWidth: 1.5, shadow: 3, positionY: 78, maxWidth: 92, cinematic: true, scriptFont: "Segoe Script", headlineFont: "Impact", scriptColor: "#fffdf8", headlineColor: "#ff2737", entrance: "slide-up" },
  { name: "None", category: "Minimal and clean", font: "Inter", text: "#f7f7f7", highlight: "#ffffff", size: 38, weight: "normal", outline: "#111111", outlineWidth: 0, shadow: 0, positionY: 82, maxWidth: 90, entrance: "none" },
  { name: "Lyrical Pop", category: "Cursive and handwritten", font: "Pacifico", text: "#fff9ed", highlight: "#ffd166", size: 46, outline: "#231b18", outlineWidth: 0.75, shadow: 3, positionY: 78, maxWidth: 88, entrance: "pop-in" },
  { name: "Center Script", category: "Cursive and handwritten", font: "Segoe Script", text: "#fff8ec", highlight: "#ff4164", size: 50, outline: "#201518", outlineWidth: 0.5, shadow: 3, position: "center", positionY: 48, maxWidth: 88, cinematic: true, scriptFont: "Segoe Script", headlineFont: "Georgia", scriptColor: "#fff8ec", headlineColor: "#ff4164", entrance: "fade-in" },
  { name: "Hand Wiggle", category: "Cursive and handwritten", font: "Caveat", text: "#fffdf4", highlight: "#bcff50", size: 50, outline: "#111111", outlineWidth: 0.5, shadow: 2, positionY: 80, maxWidth: 90, continuous: "subtle-shake", entrance: "word-reveal" },
  { name: "Hand Underline", category: "Cursive and handwritten", font: "Kalam", text: "#fffdf6", highlight: "#ff5d5d", size: 44, outline: "#141414", outlineWidth: 0.5, shadow: 1, positionY: 80, maxWidth: 90, karaoke: true, continuous: "active-word", entrance: "fade-in" },
  { name: "Red Signature", category: "Cursive and handwritten", font: "Impact", text: "#f52c38", highlight: "#ffffff", size: 50, weight: "bold", outline: "#1c1010", outlineWidth: 1.5, shadow: 4, positionY: 78, maxWidth: 92, cinematic: true, scriptFont: "Segoe Script", headlineFont: "Impact", scriptColor: "#fffdf8", headlineColor: "#f52c38", entrance: "slide-up" },
  { name: "Glow Caps", category: "Neon and gaming", font: "Montserrat", text: "#f9fbff", highlight: "#f9fbff", size: 42, weight: "bold", outline: "#10121b", outlineWidth: 0, shadow: 7, positionY: 78, maxWidth: 90, continuous: "neon-glow", entrance: "fade-in", letterSpacing: 0.08 },
  { name: "Italic Glow", category: "Neon and gaming", font: "Manrope", text: "#fffaff", highlight: "#bdff44", size: 42, weight: "bold", outline: "#181221", outlineWidth: 0.5, shadow: 6, positionY: 80, maxWidth: 90, continuous: "neon-glow", entrance: "fade-in", italic: true },
  { name: "Mint Pop", category: "Social-media creator", font: "Oswald", text: "#68f5bc", highlight: "#ffffff", size: 48, weight: "bold", outline: "#09271e", outlineWidth: 1, shadow: 2, positionY: 78, maxWidth: 90, karaoke: true, entrance: "pop-in" },
  { name: "Paper Tags", category: "Editorial and retro", font: "Georgia", text: "#fff0dc", highlight: "#ffd1a7", size: 36, weight: "bold", outline: "#48291e", outlineWidth: 0, shadow: 1, background: "#b85c3e", backgroundOpacity: 0.94, positionY: 78, maxWidth: 90, karaoke: true, entrance: "fade-in", letterSpacing: 0.015 },
  { name: "Ekdam", category: "Viral and bold", font: "Poppins", text: "#ff9d27", highlight: "#fff2db", size: 48, weight: "bold", outline: "#24150c", outlineWidth: 0.75, shadow: 3, positionY: 78, maxWidth: 90, karaoke: true, entrance: "pop-in" },
  { name: "Kinetic Stack", category: "Viral and bold", font: "Anton", text: "#ffffff", highlight: "#c5ff37", size: 48, weight: "bold", outline: "#111111", outlineWidth: 1.5, shadow: 2, positionY: 78, maxWidth: 90, karaoke: true, continuous: "active-word", entrance: "word-reveal" },
  { name: "Trio Lockup", category: "Cinematic and film", font: "Georgia", text: "#fffdf5", highlight: "#f1d49e", size: 44, weight: "bold", outline: "#181512", outlineWidth: 0.75, shadow: 3, positionY: 78, maxWidth: 90, cinematic: true, scriptFont: "Georgia", headlineFont: "Impact", scriptColor: "#fffdf5", headlineColor: "#f1d49e", entrance: "fade-in" },
  { name: "Neon Script", category: "Neon and gaming", font: "Caveat", text: "#c9ff53", highlight: "#ffffff", size: 54, outline: "#0f2413", outlineWidth: 0.5, shadow: 7, positionY: 78, maxWidth: 92, continuous: "neon-glow", entrance: "fade-in" },
  { name: "Zyada", category: "Neon and gaming", font: "Rajdhani", text: "#43ff76", highlight: "#eaffef", size: 46, weight: "bold", outline: "#06200f", outlineWidth: 1, shadow: 6, positionY: 78, maxWidth: 90, karaoke: true, continuous: "neon-glow", entrance: "slide-up" },
  { name: "Magazine", category: "Editorial and retro", font: "Playfair Display", text: "#f7f1e8", highlight: "#d2b882", size: 40, weight: "bold", outline: "#17130f", outlineWidth: 0.5, shadow: 2, positionY: 78, maxWidth: 86, karaoke: true, italic: true, entrance: "fade-in", letterSpacing: 0.04 },
  { name: "Ink Flow", category: "Cursive and handwritten", font: "Great Vibes", text: "#fff8ed", highlight: "#e8d7c1", size: 50, outline: "#17120e", outlineWidth: 0.5, shadow: 3, positionY: 78, maxWidth: 90, entrance: "fade-in" },
  { name: "Editorial", category: "Editorial and retro", font: "Manrope", text: "#f7f3eb", highlight: "#ffffff", size: 34, weight: "normal", outline: "#111111", outlineWidth: 0, shadow: 0, positionY: 78, maxWidth: 92, karaoke: true, entrance: "fade-in", letterSpacing: 0.1 },
  { name: "Viral Minimalist", category: "Minimal and clean", font: "Inter", text: "#ffffff", highlight: "#36d77a", size: 44, weight: "bold", outline: "#111111", outlineWidth: 0, shadow: 1, positionY: 78, maxWidth: 90, karaoke: true, entrance: "pop-in" },
  { name: "Script Duo", category: "Cursive and handwritten", font: "Anton", text: "#e4ff52", highlight: "#ff3b55", size: 50, weight: "bold", outline: "#12120d", outlineWidth: 1.25, shadow: 3, positionY: 78, maxWidth: 92, cinematic: true, scriptFont: "Segoe Script", headlineFont: "Anton", scriptColor: "#ff3b55", headlineColor: "#e4ff52", entrance: "slide-up" },
  { name: "Pop Viral", category: "Social-media creator", font: "Bangers", text: "#ffffff", highlight: "#8dff16", size: 48, weight: "bold", outline: "#111111", outlineWidth: 1.5, shadow: 2, positionY: 78, maxWidth: 90, karaoke: true, entrance: "bounce-in" },
  { name: "Active Box", category: "Special effects", font: "Poppins", text: "#ffffff", highlight: "#111111", size: 40, weight: "bold", outline: "#171717", outlineWidth: 0, shadow: 1, background: "#ffad18", backgroundOpacity: 0.96, positionY: 78, maxWidth: 90, karaoke: true, entrance: "pop-in" },
  { name: "Typo Stairs", category: "Special effects", font: "Oswald", text: "#fffaff", highlight: "#f5a6ff", size: 46, weight: "bold", outline: "#111111", outlineWidth: 0.75, shadow: 2, positionY: 78, maxWidth: 90, entrance: "stagger-words" },
  { name: "Word Stairs", category: "Special effects", font: "Anton", text: "#ffffff", highlight: "#63d9ff", size: 46, weight: "bold", outline: "#111111", outlineWidth: 1, shadow: 2, positionY: 78, maxWidth: 90, karaoke: true, entrance: "word-reveal" },
  { name: "Word Scatter", category: "Special effects", font: "Bangers", text: "#ffffff", highlight: "#ffcf34", size: 48, weight: "bold", outline: "#17120b", outlineWidth: 1.5, shadow: 2, positionY: 78, maxWidth: 90, entrance: "bounce-in", continuous: "subtle-shake" },
  { name: "Slide Glow", category: "Neon and gaming", font: "Manrope", text: "#f7fff8", highlight: "#39e87d", size: 46, weight: "bold", outline: "#092012", outlineWidth: 0.75, shadow: 5, positionY: 78, maxWidth: 90, karaoke: true, continuous: "neon-glow", entrance: "slide-left" },
  { name: "Letter Slide", category: "Special effects", font: "Inter", text: "#ffffff", highlight: "#a7ddff", size: 40, weight: "normal", outline: "#111111", outlineWidth: 0, shadow: 1, positionY: 80, maxWidth: 90, entrance: "letter-reveal" },
  { name: "Punch Line", category: "Viral and bold", font: "Permanent Marker", text: "#ffd33d", highlight: "#ffffff", size: 46, weight: "bold", outline: "#211b0b", outlineWidth: 1, shadow: 2, positionY: 78, maxWidth: 90, karaoke: true, entrance: "pop-in" },
  { name: "Bounce Up", category: "Social-media creator", font: "Poppins", text: "#ffffff", highlight: "#a8ff35", size: 42, weight: "bold", outline: "#171717", outlineWidth: 0.75, shadow: 2, positionY: 78, maxWidth: 90, entrance: "bounce-in" },
  { name: "Fade Up", category: "Minimal and clean", font: "Manrope", text: "#f8f8f8", highlight: "#ffffff", size: 40, weight: "normal", outline: "#111111", outlineWidth: 0, shadow: 1, positionY: 82, maxWidth: 90, entrance: "slide-up" },
  { name: "Fade Down", category: "Minimal and clean", font: "Inter", text: "#eeeeee", highlight: "#ffffff", size: 38, weight: "normal", outline: "#111111", outlineWidth: 0, shadow: 0, position: "top", positionY: 16, maxWidth: 90, entrance: "slide-down" },
  { name: "Flux Glow", category: "Neon and gaming", font: "Orbitron", text: "#f4fff7", highlight: "#21ee76", size: 42, weight: "bold", outline: "#092312", outlineWidth: 0.75, shadow: 7, positionY: 78, maxWidth: 90, karaoke: true, continuous: "neon-glow", entrance: "fade-in" },
  { name: "Shadow Fade", category: "Cinematic and film", font: "Inter", text: "#f5f8ff", highlight: "#79b8ff", size: 40, weight: "normal", outline: "#10131a", outlineWidth: 0, shadow: 4, positionY: 82, maxWidth: 90, karaoke: true, entrance: "blur-clear", exit: "fade-out" },
  { name: "Pill Pop", category: "Social-media creator", font: "Poppins", text: "#ffffff", highlight: "#39e87d", size: 38, weight: "bold", outline: "#111111", outlineWidth: 0, shadow: 2, background: "#151515", backgroundOpacity: 0.96, positionY: 80, maxWidth: 90, karaoke: true, entrance: "pop-in" },
  { name: "Bold Punch", category: "Viral and bold", font: "Archivo Black", text: "#ffffff", highlight: "#ffd91a", size: 44, weight: "bold", outline: "#111111", outlineWidth: 1.5, shadow: 2, positionY: 78, maxWidth: 92, karaoke: true, entrance: "pop-in" },
  { name: "MrBeast", category: "Viral and bold", font: "Anton", text: "#ffffff", highlight: "#ffda1a", size: 50, weight: "bold", outline: "#111111", outlineWidth: 2, shadow: 3, positionY: 78, maxWidth: 92, karaoke: true, entrance: "bounce-in" },
  { name: "Hormozi", category: "Educational and business", font: "Montserrat", text: "#f5f5f5", highlight: "#ffd51f", size: 44, weight: "bold", outline: "#121212", outlineWidth: 1.25, shadow: 2, positionY: 78, maxWidth: 92, karaoke: true, entrance: "pop-in" },
  { name: "Clean", category: "Minimal and clean", font: "Inter", text: "#f6f6f6", highlight: "#4ddd82", size: 38, weight: "normal", outline: "#111111", outlineWidth: 0, shadow: 1, positionY: 82, maxWidth: 90, karaoke: true, entrance: "fade-in" },
  { name: "Impact", category: "Viral and bold", font: "Anton", text: "#fffdf4", highlight: "#ffe12b", size: 48, weight: "bold", outline: "#111111", outlineWidth: 2, shadow: 3, positionY: 78, maxWidth: 92, karaoke: true, entrance: "pop-in" },
];

function toStyle(theme: ThemeDefinition, index: number): Partial<StyleSettings> {
  return {
    fontFamily: theme.font,
    fontSize: theme.size ?? 42,
    textColor: theme.text,
    highlightColor: theme.highlight,
    weight: theme.weight ?? "bold",
    fontWeight: theme.weight === "normal" ? 400 : 700,
    italic: theme.italic ?? (["Dancing Script", "Satisfy", "Pacifico", "Caveat", "Great Vibes"].includes(theme.font) || (theme.font === "Segoe Script" && index !== 0)),
    outlineColor: theme.outline ?? "#111111",
    outlineWidth: theme.outlineWidth ?? 1,
    shadowColor: "#000000",
    shadowBlur: theme.shadow ?? 2,
    backgroundColor: theme.background ?? "#111111",
    backgroundOpacity: theme.backgroundOpacity ?? 0,
    position: theme.position ?? "bottom",
    positionX: 50,
    positionY: theme.positionY ?? 82,
    alignment: "center",
    lineSpacing: theme.lineSpacing ?? 1.25,
    maxWidth: theme.maxWidth ?? 90,
    letterSpacing: theme.letterSpacing ?? 0,
    maxLines: 2,
    karaoke: theme.karaoke ?? false,
    cinematic: theme.cinematic ?? false,
    scriptFontFamily: theme.scriptFont ?? "Segoe Script",
    headlineFontFamily: theme.headlineFont ?? "Impact",
    scriptColor: theme.scriptColor ?? theme.text,
    headlineColor: theme.headlineColor ?? theme.highlight,
    scriptFontSize: 84,
    headlineFontSize: theme.size ?? 66,
    scriptRotation: -2,
    animation: theme.entrance === "fade-in" ? "fade" : theme.entrance === "slide-up" ? "slide" : theme.entrance === "pop-in" ? "pop" : theme.entrance === "zoom-in" ? "zoom" : "bounce",
    entranceAnimation: theme.entrance ?? "fade-in",
    exitAnimation: theme.exit ?? "none",
    continuousAnimation: theme.continuous ?? "none",
    animationDuration: 320,
    animationDelay: 0,
    animationEasing: "ease-out",
    animationIntensity: 0.8,
    animationLoop: false,
  };
}

export const captionThemes: CaptionPreset[] = definitions.map((theme, index) => ({
  id: `theme-${String(index + 1).padStart(2, "0")}`,
  name: theme.name,
  category: theme.category,
  style: toStyle(theme, index),
  entrance: theme.entrance ?? "fade-in",
  exit: theme.exit ?? "none",
  continuous: theme.continuous ?? "none",
  duration: 320,
  delay: 0,
  easing: "ease-out",
  intensity: 0.8,
  loop: false,
}));

export const captionThemeCategories = [...new Set(definitions.map(({ category }) => category))];
