import {
  ChevronLeft, ChevronRight, CircleDot, Copy, Plus, Radio,
  Repeat, RotateCcw, Sparkles, Trash2,
} from "lucide-react";
import type { CaptionSegment, EasingType, Keyframe } from "../domain";

export interface AnimationPanelProps {
  segment: CaptionSegment | undefined;
  currentTime: number;
  duration: number;
  recordingMotion: boolean;
  onStartRecordMotion: () => void;
  onStopRecordMotion: () => void;
  onAddKeyframe: (keyframe?: Partial<Keyframe>) => void;
  onDeleteKeyframe: (keyframeId: string) => void;
  onUpdateKeyframe?: (keyframeId: string, patch: Partial<Keyframe>) => void;
  onSeekTo: (timestamp: number) => void;
  onChangeEasing: (easing: EasingType) => void;
  onToggleLoop: (loop: boolean) => void;
  onDuplicateAnimation: () => void;
  onResetAnimation: () => void;
  onToggleAnimationEnabled: (enabled: boolean) => void;
}

export function AnimationPanel({
  segment,
  currentTime,
  recordingMotion,
  onStartRecordMotion,
  onStopRecordMotion,
  onAddKeyframe,
  onDeleteKeyframe,
  onSeekTo,
  onChangeEasing,
  onToggleLoop,
  onDuplicateAnimation,
  onResetAnimation,
  onToggleAnimationEnabled,
}: AnimationPanelProps) {
  const animation = segment?.animation;
  const keyframes = animation?.keyframes ?? [];
  const sortedKeyframes = [...keyframes].sort((a, b) => a.time - b.time);

  // Find if current playhead is at or near an existing keyframe (within 0.08s)
  const activeKeyframe = sortedKeyframes.find((k) => Math.abs(k.time - currentTime) < 0.08);

  const prevKeyframe = [...sortedKeyframes].reverse().find((k) => k.time < currentTime - 0.05);
  const nextKeyframe = sortedKeyframes.find((k) => k.time > currentTime + 0.05);

  const currentEasing = animation?.easing ?? "smooth";

  return (
    <div className="animation-panel">
      {/* Motion Recording Header Card */}
      <div className={`record-motion-card ${recordingMotion ? "recording-active" : ""}`}>
        <div className="record-card-top">
          <div className="record-card-info">
            <span className="record-eyebrow">
              <Radio size={13} className={recordingMotion ? "record-pulse-icon" : ""} />
              {recordingMotion ? "RECORDING LIVE MOTION" : "MOUSE MOTION CAPTURE"}
            </span>
            <h4>{recordingMotion ? "Move caption with mouse..." : "Record Motion"}</h4>
            <p>
              {recordingMotion
                ? "Dragging the caption in the video preview records its path with live timestamps."
                : "Play the video while moving your caption with the mouse to generate smooth motion paths."}
            </p>
          </div>
        </div>

        <div className="record-actions">
          {recordingMotion ? (
            <button
              type="button"
              className="stop-record-btn"
              onClick={onStopRecordMotion}
            >
              <CircleDot size={14} className="record-pulse-dot" /> Stop Recording
            </button>
          ) : (
            <button
              type="button"
              className="start-record-btn"
              onClick={onStartRecordMotion}
              disabled={!segment || segment.locked}
              title={segment?.locked ? "Layer is locked. Unlock to record motion." : "Start mouse recording"}
            >
              <Radio size={14} /> Record Motion
            </button>
          )}
        </div>
      </div>

      {/* Animation Enable & Timeline Navigation Header */}
      <div className="anim-section">
        <div className="anim-header">
          <div className="anim-header-left">
            <span>KEYFRAME MOTION</span>
            <span className="keyframe-count-badge">{keyframes.length} keyframes</span>
          </div>
          <label className="anim-toggle-label">
            <input
              type="checkbox"
              checked={animation?.enabled ?? false}
              onChange={(e) => onToggleAnimationEnabled(e.target.checked)}
            />
            <span>Enable</span>
          </label>
        </div>

        {/* Keyframe Step Navigation */}
        <div className="keyframe-nav-row">
          <button
            type="button"
            className="keyframe-nav-btn"
            disabled={!prevKeyframe}
            onClick={() => prevKeyframe && onSeekTo(prevKeyframe.time)}
            title={prevKeyframe ? `Jump to prev keyframe (${prevKeyframe.time.toFixed(2)}s)` : "No previous keyframe"}
          >
            <ChevronLeft size={14} /> Prev
          </button>

          <button
            type="button"
            className={`keyframe-add-btn ${activeKeyframe ? "is-at-keyframe" : ""}`}
            onClick={() => onAddKeyframe()}
            title="Create a keyframe at current playhead"
          >
            <Plus size={14} /> {activeKeyframe ? "Update Keyframe" : "Add Keyframe"}
          </button>

          <button
            type="button"
            className="keyframe-nav-btn"
            disabled={!nextKeyframe}
            onClick={() => nextKeyframe && onSeekTo(nextKeyframe.time)}
            title={nextKeyframe ? `Jump to next keyframe (${nextKeyframe.time.toFixed(2)}s)` : "No next keyframe"}
          >
            Next <ChevronRight size={14} />
          </button>
        </div>

        {/* Easing Curves */}
        <div className="easing-row">
          <label className="field-label" htmlFor="motion-easing">EASING INTERPOLATION</label>
          <select
            id="motion-easing"
            value={currentEasing}
            onChange={(e) => onChangeEasing(e.target.value as EasingType)}
          >
            <option value="smooth">Smooth cubic Bézier</option>
            <option value="ease-in-out">Ease in-out</option>
            <option value="ease-out">Ease out</option>
            <option value="ease-in">Ease in</option>
            <option value="linear">Linear</option>
          </select>
        </div>

        {/* Loop Toggle & Utilities */}
        <div className="anim-utility-row">
          <button
            type="button"
            className={`loop-toggle-btn ${animation?.loop ? "loop-active" : ""}`}
            onClick={() => onToggleLoop(!animation?.loop)}
          >
            <Repeat size={13} /> Loop motion: {animation?.loop ? "On" : "Off"}
          </button>

          <button
            type="button"
            className="utility-btn"
            onClick={onDuplicateAnimation}
            disabled={!keyframes.length}
            title="Duplicate motion keyframes"
          >
            <Copy size={13} /> Duplicate
          </button>

          <button
            type="button"
            className="utility-btn danger-hover"
            onClick={onResetAnimation}
            disabled={!keyframes.length}
            title="Clear all keyframes"
          >
            <RotateCcw size={13} /> Reset
          </button>
        </div>
      </div>

      {/* Keyframes List View */}
      <div className="anim-section keyframes-list-section">
        <div className="anim-header">
          <span>KEYFRAME TRACK</span>
          <span className="current-playhead-readout">{currentTime.toFixed(2)}s</span>
        </div>

        {sortedKeyframes.length === 0 ? (
          <div className="empty-keyframes">
            <Sparkles size={18} />
            <span>No keyframes yet</span>
            <small>Click "Add Keyframe" or drag the caption to create your first motion point.</small>
          </div>
        ) : (
          <div className="keyframes-list">
            {sortedKeyframes.map((kf, index) => {
              const isSelected = activeKeyframe?.id === kf.id;
              return (
                <div
                  key={kf.id}
                  className={`keyframe-item ${isSelected ? "keyframe-active" : ""}`}
                  onClick={() => onSeekTo(kf.time)}
                >
                  <div className="kf-point-badge">
                    <span className="kf-index">#{index + 1}</span>
                    <span className="kf-time">{kf.time.toFixed(2)}s</span>
                  </div>

                  <div className="kf-props">
                    <span>X: {Math.round(kf.positionX)}%</span>
                    <span>Y: {Math.round(kf.positionY)}%</span>
                    <span>S: {kf.scale.toFixed(1)}×</span>
                    <span>R: {Math.round(kf.rotation)}°</span>
                  </div>

                  <button
                    type="button"
                    className="kf-delete-btn"
                    title="Delete keyframe"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteKeyframe(kf.id);
                    }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
