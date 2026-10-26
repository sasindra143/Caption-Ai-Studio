export type CaptionMode =
  | "original"
  | "english"
  | "telugu"
  | "roman"
  | "teluglish-roman"
  | "native-mix"
  | "english-translation"
  | "telugu-translation"
  | "bilingual"
  | "translation";

export interface CaptionWord {
  id: string;
  start: number;
  end: number;
  text: string;
}

export type EasingType = "linear" | "ease-in" | "ease-out" | "ease-in-out" | "smooth";

export interface Keyframe {
  id: string;
  time: number; // Video timestamp in seconds
  positionX: number; // 0 to 100 (% of video frame width)
  positionY: number; // 0 to 100 (% of video frame height)
  scale: number; // scale multiplier e.g. 1.0 (range 0.2 to 3.0)
  rotation: number; // degrees -360 to 360
  opacity: number; // 0 to 1
  easing?: EasingType;
}

export interface CaptionAnimation {
  enabled: boolean;
  loop?: boolean;
  easing?: EasingType;
  keyframes: Keyframe[];
}

export type EntranceAnimation =
  | "none" | "fade-in" | "slide-up" | "slide-down" | "slide-left" | "slide-right"
  | "pop-in" | "zoom-in" | "bounce-in" | "typewriter" | "word-reveal"
  | "letter-reveal" | "stagger-words" | "blur-clear" | "rotate-in" | "elastic-in";
export type ExitAnimation =
  | "none" | "fade-out" | "slide-up-out" | "slide-down-out" | "slide-left-out"
  | "slide-right-out" | "zoom-out" | "pop-out" | "rotate-out" | "blur-out";
export type ContinuousAnimation =
  | "none" | "pulse" | "floating" | "gentle-bounce" | "breathing-scale"
  | "neon-glow" | "karaoke" | "active-word" | "subtle-shake" | "looping-highlight";

export interface CaptionLayer {
  id: string;
  name: string;
  text: string;
  visible: boolean;
  locked: boolean;
  positionX?: number; // 0 to 100
  positionY?: number; // 0 to 100
  scale?: number;
  rotation?: number;
  opacity?: number;
  fontFamily?: string;
  fontSize?: number;
  textColor?: string;
  outlineColor?: string;
  outlineWidth?: number;
  shadowColor?: string;
  shadowBlur?: number;
  glowColor?: string;
  glowRadius?: number;
  backgroundColor?: string;
  backgroundOpacity?: number;
  alignment?: "left" | "center" | "right";
  animation?: CaptionAnimation;
}

export interface CaptionSegment {
  id: string;
  start: number;
  end: number;
  text: string;
  words?: CaptionWord[];
  scriptText?: string;
  headlineText?: string;
  style?: Partial<StyleSettings>;
  positionX?: number; // 0 to 100 (% of video frame width)
  positionY?: number; // 0 to 100 (% of video frame height)
  scale?: number; // 0.2 to 3.0
  rotation?: number; // -360 to 360
  opacity?: number; // 0 to 1
  locked?: boolean;
  visible?: boolean;
  animation?: CaptionAnimation;
  layers?: CaptionLayer[];
}

export interface Project {
  id: string;
  name: string;
  originalName: string;
  mediaPath: string;
  duration: number;
  createdAt: string;
  status: "uploaded" | "transcribing" | "ready" | "error";
  sourceLanguage?: string;
  segments: CaptionSegment[];
  translations: Record<string, CaptionSegment[] | undefined>;
  error?: string;
}

export interface StyleSettings {
  fontFamily: string;
  fontSize: number;
  textColor: string;
  backgroundColor: string;
  backgroundOpacity: number;
  outlineColor: string;
  outlineWidth: number;
  highlightColor: string;
  weight: "normal" | "bold";
  italic: boolean;
  position: "top" | "center" | "bottom";
  alignment: "left" | "center" | "right";
  positionX?: number;
  positionY?: number;
  scale?: number;
  rotation?: number;
  opacity?: number;
  shadowColor?: string;
  shadowBlur?: number;
  glowColor?: string;
  glowRadius?: number;
  lineSpacing?: number;
  maxWidth?: number;
  karaoke?: boolean;
  cinematic?: boolean;
  scriptFontFamily?: string;
  headlineFontFamily?: string;
  scriptColor?: string;
  headlineColor?: string;
  scriptFontSize?: number;
  headlineFontSize?: number;
  scriptRotation?: number;
  animation?: "none" | "fade" | "pop" | "slide" | "zoom" | "bounce" | "custom";
  entranceAnimation?: EntranceAnimation;
  exitAnimation?: ExitAnimation;
  continuousAnimation?: ContinuousAnimation;
  animationDuration?: number;
  animationDelay?: number;
  animationIntensity?: number;
  animationEasing?: "linear" | "ease-in" | "ease-out" | "ease-in-out";
  animationLoop?: boolean;
  letterSpacing?: number;
  maxLines?: number;
  fontWeight?: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
  textGradient?: boolean;
  gradientStart?: string;
  gradientEnd?: string;
  safeAreaGuides?: boolean;
  alignmentGuides?: boolean;
  centerSnapping?: boolean;
  gridSnapping?: boolean;
  topBannerText?: string;
  bottomBannerText?: string;
}
