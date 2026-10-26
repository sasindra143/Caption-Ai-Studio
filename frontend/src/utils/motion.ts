import type { CaptionSegment, EasingType } from "../domain";

export interface TransformValues {
  positionX: number;
  positionY: number;
  scale: number;
  rotation: number;
  opacity: number;
}

export function applyEasing(t: number, easing: EasingType = "smooth"): number {
  const clamped = Math.max(0, Math.min(1, t));
  switch (easing) {
    case "linear":
      return clamped;
    case "ease-in":
      return clamped * clamped;
    case "ease-out":
      return 1 - (1 - clamped) * (1 - clamped);
    case "ease-in-out":
      return clamped < 0.5 ? 2 * clamped * clamped : 1 - Math.pow(-2 * clamped + 2, 2) / 2;
    case "smooth":
    default:
      return clamped * clamped * (3 - 2 * clamped);
  }
}

export function interpolateTransform(
  segment: CaptionSegment | undefined,
  currentTime: number,
  fallback: TransformValues = { positionX: 50, positionY: 75, scale: 1, rotation: 0, opacity: 1 },
): TransformValues {
  if (!segment) return fallback;

  const keyframes = segment.animation?.enabled ? segment.animation.keyframes : undefined;

  if (!keyframes || keyframes.length === 0) {
    return {
      positionX: segment.positionX ?? fallback.positionX,
      positionY: segment.positionY ?? fallback.positionY,
      scale: segment.scale ?? fallback.scale,
      rotation: segment.rotation ?? fallback.rotation,
      opacity: segment.opacity ?? fallback.opacity,
    };
  }

  const sorted = [...keyframes].sort((a, b) => a.time - b.time);
  if (sorted.length === 1) {
    const k = sorted[0];
    return {
      positionX: k.positionX,
      positionY: k.positionY,
      scale: k.scale,
      rotation: k.rotation,
      opacity: k.opacity,
    };
  }

  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  let evalTime = currentTime;

  if (segment.animation?.loop && last.time > first.time) {
    const loopDuration = last.time - first.time;
    evalTime = first.time + (((currentTime - first.time) % loopDuration) + loopDuration) % loopDuration;
  }

  if (evalTime <= first.time) {
    return {
      positionX: first.positionX,
      positionY: first.positionY,
      scale: first.scale,
      rotation: first.rotation,
      opacity: first.opacity,
    };
  }

  if (evalTime >= last.time) {
    return {
      positionX: last.positionX,
      positionY: last.positionY,
      scale: last.scale,
      rotation: last.rotation,
      opacity: last.opacity,
    };
  }

  // Find surrounding keyframes
  for (let i = 0; i < sorted.length - 1; i++) {
    const kA = sorted[i];
    const kB = sorted[i + 1];
    if (evalTime >= kA.time && evalTime <= kB.time) {
      const span = kB.time - kA.time;
      const rawProgress = span > 0 ? (evalTime - kA.time) / span : 0;
      const easing = kB.easing ?? segment.animation?.easing ?? "smooth";
      const eased = applyEasing(rawProgress, easing);

      return {
        positionX: Math.round((kA.positionX + (kB.positionX - kA.positionX) * eased) * 100) / 100,
        positionY: Math.round((kA.positionY + (kB.positionY - kA.positionY) * eased) * 100) / 100,
        scale: Math.round((kA.scale + (kB.scale - kA.scale) * eased) * 100) / 100,
        rotation: Math.round((kA.rotation + (kB.rotation - kA.rotation) * eased) * 10) / 10,
        opacity: Math.round((kA.opacity + (kB.opacity - kA.opacity) * eased) * 100) / 100,
      };
    }
  }

  return {
    positionX: last.positionX,
    positionY: last.positionY,
    scale: last.scale,
    rotation: last.rotation,
    opacity: last.opacity,
  };
}

export interface VideoContentRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function getVideoContentRect(
  containerWidth: number,
  containerHeight: number,
  videoWidth: number,
  videoHeight: number,
): VideoContentRect {
  if (!videoWidth || !videoHeight || !containerWidth || !containerHeight) {
    return { left: 0, top: 0, width: containerWidth, height: containerHeight };
  }

  const videoAspect = videoWidth / videoHeight;
  const containerAspect = containerWidth / containerHeight;

  if (containerAspect > videoAspect) {
    // Pillarbox
    const height = containerHeight;
    const width = height * videoAspect;
    const left = (containerWidth - width) / 2;
    return { left, top: 0, width, height };
  } else {
    // Letterbox
    const width = containerWidth;
    const height = width / videoAspect;
    const top = (containerHeight - height) / 2;
    return { left: 0, top, width, height };
  }
}
