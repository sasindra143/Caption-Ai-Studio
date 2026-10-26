import type { StyleSettings } from "../domain";

export const presetCategories = [
  "Viral and bold",
  "Cursive and handwritten",
  "Cinematic and film",
  "Neon and gaming",
  "Podcast and talking-head",
  "Minimal and clean",
  "Social-media creator",
  "Educational and business",
  "Telugu captions",
  "Telugu-English mixed captions",
  "Editorial and retro",
  "Special effects",
] as const;

export type PresetCategory = (typeof presetCategories)[number];
export type EntranceEffect =
  | "none" | "fade-in" | "slide-up" | "slide-down" | "slide-left" | "slide-right"
  | "pop-in" | "zoom-in" | "bounce-in" | "typewriter" | "word-reveal"
  | "letter-reveal" | "stagger-words" | "blur-clear" | "rotate-in" | "elastic-in";
export type ExitEffect =
  | "none" | "fade-out" | "slide-up-out" | "slide-down-out" | "slide-left-out"
  | "slide-right-out" | "zoom-out" | "pop-out" | "rotate-out" | "blur-out";
export type ContinuousEffect =
  | "none" | "pulse" | "floating" | "gentle-bounce" | "breathing-scale"
  | "neon-glow" | "karaoke" | "active-word" | "subtle-shake" | "looping-highlight";

export interface CaptionPreset {
  id: string;
  name: string;
  category: PresetCategory;
  style: Partial<StyleSettings>;
  entrance: EntranceEffect;
  exit: ExitEffect;
  continuous: ContinuousEffect;
  duration: number;
  delay: number;
  easing: "linear" | "ease-in" | "ease-out" | "ease-in-out";
  intensity: number;
  loop: boolean;
}

export type FontCategory =
  | "Sans-serif" | "Serif" | "Display" | "Condensed" | "Rounded"
  | "Script" | "Handwritten" | "Monospace" | "Retro" | "Decorative"
  | "Telugu-compatible" | "Bilingual";

export interface FontFamily {
  family: string;
  category: FontCategory;
  source: "Google Fonts" | "System";
  teluguSupport: "verified" | "fallback";
  exportSupport: "system-dependent" | "verified-system";
}

const fontGroups: Array<[FontCategory, string]> = [
  ["Sans-serif", "Inter, Poppins, Montserrat, Roboto, Open Sans, Lato, Source Sans 3, Nunito Sans, Manrope, Work Sans"],
  ["Sans-serif", "DM Sans, Rubik, Ubuntu, Fira Sans, Noto Sans, Assistant, Mulish, Karla, Oxygen, IBM Plex Sans"],
  ["Serif", "Playfair Display, Lora, Merriweather, Libre Baskerville, Cormorant Garamond, Crimson Text, Spectral, Source Serif 4, DM Serif Display, EB Garamond"],
  ["Serif", "Bodoni Moda, Fraunces, Alegreya, Bitter, Vollkorn, Arvo, Zilla Slab, Cardo, Noto Serif, Literata"],
  ["Display", "Anton, Archivo Black, Bangers, Bowlby One SC, Bungee, Changa One, Fjalla One, Staatliches, Teko, Russo One"],
  ["Display", "Alfa Slab One, Black Ops One, Bungee Shade, Graduate, Titan One, Paytone One, Saira Stencil One, Squada One, Bevan, Ranchers"],
  ["Condensed", "Oswald, Bebas Neue, Roboto Condensed, Archivo Narrow, Fira Sans Condensed, Yanone Kaffeesatz, Barlow Condensed, Saira Condensed, Teko, Pathway Gothic One"],
  ["Condensed", "Barlow Semi Condensed, Encode Sans Condensed, IBM Plex Sans Condensed, News Cycle, Antonio, Big Shoulders Display, Fjalla One, Passion One, Six Caps, BenchNine"],
  ["Rounded", "Quicksand, Nunito, Comfortaa, Varela Round, M PLUS Rounded 1c, Dosis, Baloo 2, Fredoka, Asap, Urbanist"],
  ["Rounded", "Sniglet, Lilita One, Grandstander, Bubblegum Sans, Coiny, Itim, M PLUS 1p, Gabarito, Raleway, Red Hat Display"],
  ["Script", "Great Vibes, Pacifico, Dancing Script, Satisfy, Sacramento, Allura, Alex Brush, Parisienne, Tangerine, Yellowtail"],
  ["Handwritten", "Caveat, Permanent Marker, Kalam, Patrick Hand, Indie Flower, Shadows Into Light, Architects Daughter, Homemade Apple, Gloria Hallelujah, Handlee"],
  ["Monospace", "JetBrains Mono, Fira Code, IBM Plex Mono, Source Code Pro, Space Mono, Roboto Mono, Inconsolata, Ubuntu Mono, Anonymous Pro, Azeret Mono"],
  ["Retro", "Righteous, Monoton, Press Start 2P, Silkscreen, Bungee Inline, Limelight, Rye, Special Elite, Audiowide, Chicle"],
  ["Decorative", "Abril Fatface, Creepster, Grenze Gotisch, Uncial Antiqua, Pirata One, Ewert, Butcherman, Nosifer, Fascinate, Londrina Solid"],
  ["Display", "Orbitron, Oxanium, Rajdhani, Michroma, Chakra Petch, Yeseva One, Rubik Glitch, Outfit, Figtree, Geologica"],
  ["Telugu-compatible", "Noto Sans Telugu, Noto Serif Telugu, Mandali, Ramabhadra, Hind, Noto Sans Telugu UI, Gurajada, Suranna, Tenali Ramakrishna, Mallanna"],
  ["Bilingual", "Noto Sans, Noto Serif, Hind, Noto Sans Display, Noto Serif Display, Tiro Telugu, Baloo Tammudu 2, Anek Telugu, Noto Sans Telugu, Noto Serif Telugu"],
];

const verifiedSystemFonts = new Set(["Arial", "Georgia", "Impact", "Nirmala UI", "Nirmala UI", "Segoe UI", "Verdana"]);
const nativeSystemFonts: FontFamily[] = [...verifiedSystemFonts].map((family) => ({
  family,
  category: family === "Georgia" ? "Serif" : "Sans-serif",
  source: "System",
  teluguSupport: family === "Nirmala UI" ? "verified" : "fallback",
  exportSupport: "verified-system",
}));

const googleFontFamilies: FontFamily[] = fontGroups.flatMap(([category, names]) =>
  names.split(", ").map((family) => ({
    family,
    category,
    source: "Google Fonts" as const,
    teluguSupport: ["Noto Sans Telugu", "Noto Serif Telugu", "Mandali", "Ramabhadra", "Hind", "Gurajada", "Suranna", "Tenali Ramakrishna", "Mallanna", "Anek Telugu", "Baloo Tammudu 2", "Tiro Telugu"].includes(family)
      ? "verified" as const
      : "fallback" as const,
    exportSupport: (verifiedSystemFonts.has(family) ? "verified-system" : "system-dependent") as FontFamily["exportSupport"],
  })),
);

export const fontFamilies: FontFamily[] = [
  ...nativeSystemFonts,
  ...googleFontFamilies.filter((font, index, all) => all.findIndex((item) => item.family === font.family) === index),
];

const paletteByCategory: Record<PresetCategory, string[]> = {
  "Viral and bold": ["#ffffff", "#ffe34d", "#ff5b5b", "#65edff", "#d8ff4d", "#ff9c42", "#ff62be", "#b9a0ff", "#e9f0ff", "#a8ffcb"],
  "Cursive and handwritten": ["#fff7ed", "#ffe2c6", "#f6d7ff", "#e9e6ff", "#c9f3ff", "#fff0a8", "#fbd0d0", "#e1ffd4", "#ffffff", "#ffc7e8"],
  "Cinematic and film": ["#fffaf0", "#f7f4ed", "#e7e4da", "#ffe8b0", "#e4eeff", "#fff2d5", "#d8e8dc", "#ffffff", "#f9d5c4", "#e0e0e0"],
  "Neon and gaming": ["#00f5ff", "#ff28d7", "#bbff00", "#fffb00", "#8c6bff", "#ff5c00", "#00ff9c", "#ff3864", "#3ae7ff", "#ffffff"],
  "Podcast and talking-head": ["#ffffff", "#f2f2ed", "#ffe9d2", "#e7f2ff", "#fff3a8", "#e3ffe7", "#ffdddd", "#f5e6ff", "#ffffff", "#dffaff"],
  "Minimal and clean": ["#ffffff", "#f4f4f4", "#f2efe8", "#e8f1f2", "#fffaf0", "#f5f2ff", "#edf8ee", "#fceee9", "#f5f5f5", "#e9edf5"],
  "Social-media creator": ["#ffffff", "#faff65", "#ff6f91", "#7af6ff", "#baff5e", "#ffb86c", "#e5b7ff", "#ffffff", "#7cffc4", "#ff8d5c"],
  "Educational and business": ["#ffffff", "#e8f2ff", "#e8ffe9", "#fff4d6", "#f1eaff", "#e9fbfa", "#fff0ec", "#f6f6f0", "#d7f1ff", "#fff"],
  "Telugu captions": ["#ffffff", "#fff4dc", "#eaf4ff", "#fff1ed", "#eeffe8", "#f8edff", "#fff9d6", "#e4f7f5", "#ffffff", "#f3f3f3"],
  "Telugu-English mixed captions": ["#ffffff", "#fff2b8", "#e9f4ff", "#eeffe8", "#ffe7f3", "#e8ffff", "#f6edff", "#fff0dd", "#ffffff", "#e9ecef"],
  "Editorial and retro": ["#f8eddb", "#f9d877", "#f1a28e", "#c8e0cf", "#e1d2f3", "#fff8e9", "#e6b7aa", "#d4ebea", "#f6db8e", "#ffffff"],
  "Special effects": ["#ffffff", "#ff4de1", "#44eaff", "#c5ff3f", "#ff9d43", "#a891ff", "#ff536e", "#fff329", "#7dffbf", "#d7efff"],
};

const fontByCategory: Record<PresetCategory, string[]> = {
  "Viral and bold": ["Anton", "Archivo Black", "Bebas Neue", "Oswald", "Bangers", "Teko", "Impact", "Roboto Condensed", "Passion One", "Barlow Condensed"],
  "Cursive and handwritten": ["Caveat", "Pacifico", "Dancing Script", "Permanent Marker", "Kalam", "Patrick Hand", "Satisfy", "Indie Flower", "Great Vibes", "Shadows Into Light"],
  "Cinematic and film": ["Playfair Display", "Cormorant Garamond", "Lora", "Merriweather", "DM Serif Display", "Libre Baskerville", "Spectral", "EB Garamond", "Georgia", "Fraunces"],
  "Neon and gaming": ["Orbitron", "Audiowide", "Oxanium", "Rajdhani", "Teko", "Press Start 2P", "Russo One", "Michroma", "Chakra Petch", "Bungee"],
  "Podcast and talking-head": ["Inter", "DM Sans", "Manrope", "Roboto", "Lato", "Open Sans", "Noto Sans", "Nunito Sans", "Work Sans", "Source Sans 3"],
  "Minimal and clean": ["Inter", "Manrope", "DM Sans", "Roboto", "Noto Sans", "Lato", "Mulish", "Karla", "Assistant", "Urbanist"],
  "Social-media creator": ["Poppins", "Montserrat", "Archivo Black", "Anton", "Rubik", "Nunito", "Bebas Neue", "Outfit", "Barlow Condensed", "Fredoka"],
  "Educational and business": ["Inter", "Source Sans 3", "IBM Plex Sans", "Roboto", "Noto Sans", "Lato", "Merriweather", "Noto Serif", "Manrope", "Hind"],
  "Telugu captions": ["Noto Sans Telugu", "Mandali", "Ramabhadra", "Nirmala UI", "Gurajada", "Suranna", "Mallanna", "Tenali Ramakrishna", "Noto Serif Telugu", "Hind"],
  "Telugu-English mixed captions": ["Noto Sans Telugu", "Hind", "Noto Sans", "Anek Telugu", "Baloo Tammudu 2", "Nirmala UI", "Noto Serif Telugu", "Mandali", "Inter", "Noto Sans Display"],
  "Editorial and retro": ["Bodoni Moda", "Abril Fatface", "Rye", "Special Elite", "DM Serif Display", "Playfair Display", "Limelight", "Vollkorn", "Fraunces", "Yeseva One"],
  "Special effects": ["Bungee Shade", "Monoton", "Creepster", "Righteous", "Black Ops One", "Bungee Inline", "Audiowide", "Chicle", "Rubik Glitch", "Bowlby One SC"],
};

const entrances: EntranceEffect[] = [
  "fade-in", "slide-up", "slide-down", "slide-left", "slide-right",
  "pop-in", "zoom-in", "bounce-in", "typewriter", "word-reveal",
  "letter-reveal", "stagger-words", "blur-clear", "rotate-in", "elastic-in",
];
const exits: ExitEffect[] = [
  "fade-out", "slide-up-out", "slide-down-out", "slide-left-out", "slide-right-out",
  "zoom-out", "pop-out", "rotate-out", "blur-out", "none",
];
const continuous: ContinuousEffect[] = [
  "none", "pulse", "floating", "gentle-bounce", "breathing-scale",
  "neon-glow", "karaoke", "active-word", "subtle-shake", "looping-highlight",
];

export const captionPresets: CaptionPreset[] = presetCategories.flatMap((category, categoryIndex) =>
  Array.from({ length: 10 }, (_, index) => {
    const variant = index + categoryIndex;
    const color = paletteByCategory[category][index];
    const fontFamily = fontByCategory[category][index];
    const animationEntrance = entrances[(index * 3 + categoryIndex) % entrances.length];
    const wordEffect = (category === "Telugu captions" || category === "Telugu-English mixed captions") && index % 2 === 0;
    const preset: CaptionPreset = {
      id: `caption-${String(categoryIndex + 1).padStart(2, "0")}-${String(index + 1).padStart(2, "0")}`,
      name: `${category} · ${[
        "Signature", "Spotlight", "Studio", "Motion", "Accent",
        "Classic", "Story", "Focus", "Frame", "Select",
      ][index]}`,
      category,
      style: {
        fontFamily,
        fontSize: 34 + ((variant * 7) % 19),
        textColor: color,
        highlightColor: paletteByCategory[category][(index + 3) % 10],
        weight: index % 3 === 0 ? "normal" : "bold",
        outlineColor: index % 4 === 0 ? "#101010" : "#171717",
        outlineWidth: [0, 0.75, 1.25, 2, 0.5][(variant + index) % 5],
        shadowColor: "#000000",
        shadowBlur: [0, 1, 2, 4, 6][(variant * 2 + index) % 5],
        backgroundColor: ["#101010", "#111827", "#151515", "#08202a"][variant % 4],
        backgroundOpacity: [0, 0.12, 0.25, 0.4, 0.68][(variant + index) % 5],
        alignment: (["left", "center", "right"] as const)[(variant + index) % 3],
        position: (["bottom", "center", "top"] as const)[(variant + categoryIndex) % 3],
        positionX: [50, 50, 50, 42, 58][index % 5],
        positionY: [82, 76, 68, 50, 24][(index + categoryIndex) % 5],
        lineSpacing: [1.1, 1.2, 1.3, 1.4, 1.5][(variant + index) % 5],
        maxWidth: [72, 78, 84, 90, 96][(variant * 3 + index) % 5],
        letterSpacing: [-0.02, 0, 0.01, 0.03, 0.05][(variant + index) % 5],
        maxLines: 2 + (index % 2),
        karaoke: wordEffect || index === 8,
        entranceAnimation: animationEntrance,
        exitAnimation: exits[(index * 3 + categoryIndex) % exits.length],
        continuousAnimation: continuous[(index + categoryIndex * 2) % continuous.length],
        animationDuration: 280 + ((variant * 73) % 620),
        animationDelay: (index % 4) * 60,
        animationEasing: (["linear", "ease-in", "ease-out", "ease-in-out"] as const)[(index + categoryIndex) % 4],
        animationIntensity: 0.35 + (index % 5) * 0.15,
        animationLoop: index % 2 === 0,
      },
      entrance: animationEntrance,
      exit: exits[(index * 3 + categoryIndex) % exits.length],
      continuous: continuous[(index + categoryIndex * 2) % continuous.length],
      duration: 280 + ((variant * 73) % 620),
      delay: (index % 4) * 60,
      easing: (["linear", "ease-in", "ease-out", "ease-in-out"] as const)[(index + categoryIndex) % 4],
      intensity: 0.35 + (index % 5) * 0.15,
      loop: index % 2 === 0,
    };
    return preset;
  }),
);

export function googleFontStylesheet(family: string): string {
  return `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, "+")}:wght@400;500;600;700&display=swap`;
}
