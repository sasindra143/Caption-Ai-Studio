import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Lock, RotateCcw } from "lucide-react";

export interface TransformBoxProps {
  positionX: number; // 0 to 100 (%)
  positionY: number; // 0 to 100 (%)
  scale: number; // e.g. 1.0
  rotation: number; // degrees
  opacity: number;
  maxWidth: number;
  selected: boolean;
  onSelect: () => void;
  locked?: boolean;
  videoWidth: number;
  videoHeight: number;
  containerWidth: number;
  containerHeight: number;
  centerSnapping?: boolean;
  safeAreaGuides?: boolean;
  alignmentGuides?: boolean;
  onTransformChange: (patch: { positionX?: number; positionY?: number; scale?: number; rotation?: number }) => void;
  onTransformStart: () => void;
  children: React.ReactNode;
}

type DragAction = "move" | "resize-se" | "resize-sw" | "resize-ne" | "resize-nw" | "rotate";

export function TransformBox({
  positionX,
  positionY,
  scale,
  rotation,
  opacity,
  maxWidth,
  selected,
  onSelect,
  locked = false,
  containerWidth,
  containerHeight,
  centerSnapping = true,
  safeAreaGuides = false,
  alignmentGuides = true,
  onTransformChange,
  onTransformStart,
  children,
}: TransformBoxProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [activeGesture, setActiveGesture] = useState<DragAction | null>(null);
  const [showSnapX, setShowSnapX] = useState(false);
  const [showSnapY, setShowSnapY] = useState(false);
  const [displayAngle, setDisplayAngle] = useState(rotation);

  const gestureRef = useRef<{
    action: DragAction;
    pointerId: number;
    startX: number;
    startY: number;
    startPosX: number;
    startPosY: number;
    startScale: number;
    startRotation: number;
    boxCenterClientX: number;
    boxCenterClientY: number;
  } | null>(null);

  useEffect(() => {
    setDisplayAngle(rotation);
  }, [rotation]);

  function startDrag(event: ReactPointerEvent<HTMLElement>, action: DragAction) {
    if (event.button !== 0) return;
    event.stopPropagation();
    if (!selected) {
      onSelect();
      return;
    }
    if (locked) return;
    event.preventDefault();
    onTransformStart();

    const rect = boxRef.current?.getBoundingClientRect();
    const centerX = rect ? rect.left + rect.width / 2 : event.clientX;
    const centerY = rect ? rect.top + rect.height / 2 : event.clientY;

    gestureRef.current = {
      action,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startPosX: positionX,
      startPosY: positionY,
      startScale: scale,
      startRotation: rotation,
      boxCenterClientX: centerX,
      boxCenterClientY: centerY,
    };

    setActiveGesture(action);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId || locked) return;
    event.stopPropagation();

    const deltaClientX = event.clientX - gesture.startX;
    const deltaClientY = event.clientY - gesture.startY;

    if (gesture.action === "move") {
      const deltaXPercent = (deltaClientX / containerWidth) * 100;
      const deltaYPercent = (deltaClientY / containerHeight) * 100;

      let nextX = gesture.startPosX + deltaXPercent;
      let nextY = gesture.startPosY + deltaYPercent;

      // Snapping
      let snappedX = false;
      let snappedY = false;
      if (centerSnapping) {
        if (Math.abs(nextX - 50) < 1.8) {
          nextX = 50;
          snappedX = true;
        }
        if (Math.abs(nextY - 50) < 1.8) {
          nextY = 50;
          snappedY = true;
        }
      }

      setShowSnapX(snappedX);
      setShowSnapY(snappedY);

      const boxRect = boxRef.current?.getBoundingClientRect();
      const minX = boxRect ? Math.min(50, (boxRect.width / containerWidth) * 50) : 3;
      const minY = boxRect ? Math.min(50, (boxRect.height / containerHeight) * 50) : 3;
      nextX = Math.max(minX, Math.min(100 - minX, nextX));
      nextY = Math.max(minY, Math.min(100 - minY, nextY));

      onTransformChange({
        positionX: Math.round(nextX * 10) / 10,
        positionY: Math.round(nextY * 10) / 10,
      });
    } else if (gesture.action.startsWith("resize-")) {
      // Calculate distance from center to cursor vs start distance
      const startDist = Math.hypot(
        gesture.startX - gesture.boxCenterClientX,
        gesture.startY - gesture.boxCenterClientY,
      );
      const currentDist = Math.hypot(
        event.clientX - gesture.boxCenterClientX,
        event.clientY - gesture.boxCenterClientY,
      );

      const ratio = startDist > 5 ? currentDist / startDist : 1;
      let nextScale = gesture.startScale * ratio;
      // Clamp scale
      nextScale = Math.max(0.25, Math.min(3.0, nextScale));

      onTransformChange({
        scale: Math.round(nextScale * 100) / 100,
      });
    } else if (gesture.action === "rotate") {
      const angleRad = Math.atan2(
        event.clientY - gesture.boxCenterClientY,
        event.clientX - gesture.boxCenterClientX,
      );
      const startAngleRad = Math.atan2(
        gesture.startY - gesture.boxCenterClientY,
        gesture.startX - gesture.boxCenterClientX,
      );

      const deltaDeg = ((angleRad - startAngleRad) * 180) / Math.PI;
      let nextRotation = (gesture.startRotation + deltaDeg) % 360;

      // Keyboard modifier: Shift key snaps to 15-degree increments
      if (event.shiftKey) {
        nextRotation = Math.round(nextRotation / 15) * 15;
      }

      // Snap to 0 if very close
      if (Math.abs(nextRotation) < 2) nextRotation = 0;

      setDisplayAngle(Math.round(nextRotation));
      onTransformChange({
        rotation: Math.round(nextRotation),
      });
    }
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (gestureRef.current?.pointerId !== event.pointerId) return;
    event.stopPropagation();

    gestureRef.current = null;
    setActiveGesture(null);
    setShowSnapX(false);
    setShowSnapY(false);

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

  }

  return (
    <>
      {/* Alignment Guides */}
      {selected && alignmentGuides && showSnapX && (
        <div
          className="snap-guide-line snap-vertical"
          style={{ left: "50%" }}
          aria-hidden="true"
        />
      )}
      {selected && alignmentGuides && showSnapY && (
        <div
          className="snap-guide-line snap-horizontal"
          style={{ top: "50%" }}
          aria-hidden="true"
        />
      )}
      {selected && safeAreaGuides && (
        <div className="safe-area-guide" aria-hidden="true">
          <span className="safe-area-label">TITLE SAFE AREA (90%)</span>
        </div>
      )}

      {/* Main Transformation Box */}
      <div
        ref={boxRef}
        className={`caption-transform-box ${selected ? "is-selected" : "is-unselected"} ${activeGesture ? "active-gesture" : ""} ${locked ? "is-locked" : ""}`}
        style={{
          left: `${positionX}%`,
          top: `${positionY}%`,
          maxWidth: `${maxWidth}%`,
          transform: `translate(-50%, -50%) rotate(${rotation}deg) scale(${scale})`,
          opacity,
        }}
        onPointerDown={(event) => startDrag(event, "move")}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={(event) => {
          event.stopPropagation();
          if (!selected) onSelect();
        }}
      >
        {/* Caption Content */}
        <div className="transform-content" style={{ pointerEvents: "none" }}>
          {children}
        </div>

        {/* Lock Overlay if Locked */}
        {locked ? (
          <div className="transform-lock-indicator" title="Layer is locked. Unlock in Layers to edit.">
            <Lock size={14} /> <span>Locked</span>
          </div>
        ) : (
          <>
            {/* Outline Bounding Box */}
            <div className="transform-selection-outline" />

            {/* 4 Corner Resize Handles */}
            <div className="transform-handle handle-nw" onPointerDown={(event) => startDrag(event, "resize-nw")} />
            <div className="transform-handle handle-ne" onPointerDown={(event) => startDrag(event, "resize-ne")} />
            <div className="transform-handle handle-se" onPointerDown={(event) => startDrag(event, "resize-se")} />
            <div className="transform-handle handle-sw" onPointerDown={(event) => startDrag(event, "resize-sw")} />

            {/* Top Rotation Stem & Handle */}
            <div className="transform-rotate-stem" />
            <div
              className="transform-rotate-handle"
              title="Drag to rotate (Shift snaps 15°)"
              aria-label="Rotate caption"
              onPointerDown={(event) => startDrag(event, "rotate")}
            >
              <RotateCcw size={11} strokeWidth={2.5} />
            </div>

            {/* Rotation Degree Badge during Rotation */}
            {activeGesture === "rotate" && (
              <div className="rotation-angle-badge" aria-live="polite">
                {displayAngle}°
              </div>
            )}

          </>
        )}
      </div>
    </>
  );
}
