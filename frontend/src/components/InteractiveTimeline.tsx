import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Eye, Type, Volume2, Play, Pause, ZoomIn, ZoomOut, Plus } from "lucide-react";
import type { CaptionSegment } from "../domain";

export interface InteractiveTimelineProps {
  duration: number;
  currentTime: number;
  playing?: boolean;
  segments: CaptionSegment[];
  activeSegment: CaptionSegment | undefined;
  cuts?: Array<{ id: string; start: number; end: number; reason: string; accepted: boolean }> | null;
  onSeek: (time: number) => void;
  onTogglePlay?: () => void;
  onTrimSegment: (segmentId: string, start: number, end: number) => void;
  onTrimEnd: () => void;
  onSelectSegment: (segmentId: string) => void;
  onFillGaps?: () => void;
}

export function InteractiveTimeline({
  duration,
  currentTime,
  playing = false,
  segments,
  activeSegment,
  cuts,
  onSeek,
  onTogglePlay,
  onTrimSegment,
  onTrimEnd,
  onSelectSegment,
  onFillGaps,
}: InteractiveTimelineProps) {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const trimGestureRef = useRef<{
    pointerId: number;
    segmentId: string;
    handle: "start" | "end";
    origStart: number;
    origEnd: number;
    startX: number;
  } | null>(null);

  const safeDuration = duration > 0 ? duration : 1;

  function handleTimelineClick(event: React.MouseEvent<HTMLDivElement>) {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    onSeek(ratio * safeDuration);
  }

  function startTrim(
    event: ReactPointerEvent<HTMLSpanElement>,
    segment: CaptionSegment,
    handle: "start" | "end",
  ) {
    if (segment.locked || event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();

    trimGestureRef.current = {
      pointerId: event.pointerId,
      segmentId: segment.id,
      handle,
      origStart: segment.start,
      origEnd: segment.end,
      startX: event.clientX,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleTrimMove(event: ReactPointerEvent<HTMLSpanElement>) {
    const gesture = trimGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId || !timelineRef.current) return;
    event.stopPropagation();

    const rect = timelineRef.current.getBoundingClientRect();
    const deltaX = event.clientX - gesture.startX;
    const deltaTime = (deltaX / rect.width) * safeDuration;

    if (gesture.handle === "start") {
      const nextStart = Math.max(0, Math.min(gesture.origEnd - 0.2, gesture.origStart + deltaTime));
      onTrimSegment(gesture.segmentId, Math.round(nextStart * 10) / 10, gesture.origEnd);
    } else {
      const nextEnd = Math.max(gesture.origStart + 0.2, Math.min(safeDuration, gesture.origEnd + deltaTime));
      onTrimSegment(gesture.segmentId, gesture.origStart, Math.round(nextEnd * 10) / 10);
    }
  }

  function handleTrimUp(event: ReactPointerEvent<HTMLSpanElement>) {
    if (trimGestureRef.current?.pointerId !== event.pointerId) return;
    event.stopPropagation();

    trimGestureRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    onTrimEnd();
  }

  const playheadPercent = (currentTime / safeDuration) * 100;

  // Time ruler notches
  const numNotches = 10;
  const timeNotches = Array.from({ length: numNotches + 1 }, (_, i) => (safeDuration * i) / numNotches);

  return (
    <div className="fluxo-timeline-root">
      {/* Top Header / Transport Controls Bar */}
      <div className="fluxo-timeline-topbar">
        <div className="fluxo-time-readout">
          <span className="fluxo-current-time">{formatTime(currentTime)}</span>
          <span className="fluxo-divider">/</span>
          <span className="fluxo-total-time">{formatTime(safeDuration)}</span>
          <span className="fluxo-layer-count">1 VIDEO LAYER</span>
        </div>

        <div className="fluxo-center-controls">
          <button
            type="button"
            className="fluxo-play-circle"
            onClick={onTogglePlay}
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" style={{ marginLeft: "2px" }} />}
          </button>
        </div>

        <div className="fluxo-right-controls">
          {onFillGaps && (
            <button type="button" className="fluxo-fillgaps-btn" onClick={onFillGaps} title="Fill gaps between captions">
              <Plus size={12} /> Fill gaps
            </button>
          )}

          <div className="fluxo-zoom-widget">
            <ZoomOut size={13} />
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="fluxo-zoom-slider"
              aria-label="Timeline zoom"
            />
            <ZoomIn size={13} />
          </div>
        </div>
      </div>

      {/* Main Track Workspace with Left Track Headers and Scrollable Track Area */}
      <div className="fluxo-track-layout">
        {/* Track Headers on Left */}
        <div className="fluxo-track-headers">
          <div className="fluxo-track-header track-header-ruler" />
          <div className="fluxo-track-header" title="Video Track 1">
            <span className="track-badge">V1</span>
            <Eye size={12} className="track-icon-btn" />
          </div>
          <div className="fluxo-track-header" title="Captions Track">
            <span className="track-badge">T</span>
            <Type size={12} className="track-icon-btn" />
          </div>
          <div className="fluxo-track-header" title="Audio Track 1">
            <span className="track-badge">A1</span>
            <Volume2 size={12} className="track-icon-btn" />
          </div>
        </div>

        {/* Multi-Track Stage */}
        <div
          className="fluxo-timeline-stage"
          ref={timelineRef}
          onClick={handleTimelineClick}
        >
          {/* 1. Time Ruler */}
          <div className="fluxo-timeline-ruler">
            {timeNotches.map((sec, idx) => (
              <span
                key={idx}
                className="fluxo-ruler-notch"
                style={{ left: `${(sec / safeDuration) * 100}%` }}
              >
                {formatTimecode(sec)}
              </span>
            ))}
          </div>

          {/* 2. Video Filmstrip Track (V1) */}
          <div className="fluxo-video-track">
            <div className="fluxo-filmstrip-strip">
              {Array.from({ length: 12 }, (_, i) => (
                <div key={i} className="fluxo-filmstrip-frame" />
              ))}
            </div>
          </div>

          {/* 3. Captions Capsules Track (T) */}
          <div className="fluxo-captions-track">
            {segments.map((seg) => {
              const isActive = activeSegment?.id === seg.id;
              const leftPercent = (seg.start / safeDuration) * 100;
              const widthPercent = Math.max(1.8, ((seg.end - seg.start) / safeDuration) * 100);

              if (isActive) {
                const keyframes = seg.animation?.keyframes ?? [];
                return (
                  <div
                    key={seg.id}
                    className={`fluxo-caption-capsule is-active ${seg.locked ? "is-locked" : ""}`}
                    style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {!seg.locked && (
                      <span
                        className="trim-handle trim-handle-start"
                        title="Drag start"
                        onPointerDown={(e) => startTrim(e, seg, "start")}
                        onPointerMove={handleTrimMove}
                        onPointerUp={handleTrimUp}
                        onPointerCancel={handleTrimUp}
                      >
                        ‹
                      </span>
                    )}

                    <div
                      className="capsule-text"
                      onClick={() => onSeek(seg.start)}
                      title={seg.text}
                    >
                      {seg.text}
                    </div>

                    {keyframes.map((kf) => {
                      const segSpan = seg.end - seg.start;
                      const kfOffsetInSeg = kf.time - seg.start;
                      const kfPercent = segSpan > 0 ? (kfOffsetInSeg / segSpan) * 100 : 0;
                      if (kfPercent < 0 || kfPercent > 100) return null;
                      return (
                        <button
                          key={kf.id}
                          type="button"
                          className="keyframe-diamond-marker"
                          style={{ left: `${kfPercent}%` }}
                          title={`Keyframe at ${kf.time.toFixed(2)}s`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSeek(kf.time);
                          }}
                        >
                          ◆
                        </button>
                      );
                    })}

                    {!seg.locked && (
                      <span
                        className="trim-handle trim-handle-end"
                        title="Drag end"
                        onPointerDown={(e) => startTrim(e, seg, "end")}
                        onPointerMove={handleTrimMove}
                        onPointerUp={handleTrimUp}
                        onPointerCancel={handleTrimUp}
                      >
                        ›
                      </span>
                    )}
                  </div>
                );
              }

              return (
                <button
                  key={seg.id}
                  type="button"
                  className="fluxo-caption-capsule"
                  style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
                  title={seg.text}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectSegment(seg.id);
                    onSeek(seg.start);
                  }}
                >
                  <span className="capsule-text">{seg.text}</span>
                </button>
              );
            })}
          </div>

          {/* 4. Audio Waveform Track (A1) */}
          <div className="fluxo-audio-track">
            <div className="fluxo-audio-waveform">
              {Array.from({ length: 80 }, (_, idx) => (
                <span
                  key={idx}
                  className="fluxo-waveform-bar"
                  style={{ height: `${16 + ((idx * 37 + 23) % 70)}%` }}
                />
              ))}
            </div>
          </div>

          {/* Cuts overlays if any */}
          {cuts?.filter((c) => c.accepted).map((cut) => (
            <div
              key={cut.id}
              className="timeline-cut-overlay"
              style={{
                left: `${(cut.start / safeDuration) * 100}%`,
                width: `${((cut.end - cut.start) / safeDuration) * 100}%`,
              }}
            />
          ))}

          {/* Vertical Playhead Scrubber */}
          <div
            className="fluxo-playhead-line"
            style={{ left: `${playheadPercent}%` }}
          >
            <div className="fluxo-playhead-head" />
          </div>
        </div>
      </div>

      {/* Bottom Shortcuts Bar */}
      <div className="fluxo-timeline-shortcuts">
        <span>SHIFT+CLICK / DRAG = MULTI-SELECT</span>
        <span>·</span>
        <span>S SPLIT</span>
        <span>·</span>
        <span>DEL</span>
        <span>·</span>
        <span>CTRL+Z / Y</span>
        <span>·</span>
        <span>HOME / END</span>
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const mins = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  const ms = Math.floor((safe % 1) * 10);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${ms}`;
}

function formatTimecode(seconds: number): string {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const mins = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}
