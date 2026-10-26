import { useState } from "react";
import {
  ArrowDown, ArrowUp, Copy, Eye, EyeOff, Layers, Lock, Plus,
  Sparkles, Trash2, Unlock,
} from "lucide-react";
import type { CaptionLayer, CaptionSegment } from "../domain";

export interface LayersPanelProps {
  segment: CaptionSegment | undefined;
  activeLayerId: string;
  onSelectLayer: (layerId: string) => void;
  onAddLayer: () => void;
  onUpdateLayer: (layerId: string, patch: Partial<CaptionLayer>) => void;
  onDuplicateLayer: (layerId: string) => void;
  onDeleteLayer: (layerId: string) => void;
  onReorderLayer: (layerId: string, direction: "up" | "down") => void;
  onUpdateSegment: (patch: Partial<CaptionSegment>) => void;
}

export function LayersPanel({
  segment,
  activeLayerId,
  onSelectLayer,
  onAddLayer,
  onUpdateLayer,
  onDuplicateLayer,
  onDeleteLayer,
  onReorderLayer,
  onUpdateSegment,
}: LayersPanelProps) {
  const [editingId, setEditingId] = useState<string | null>(null);

  if (!segment) {
    return (
      <div className="layers-panel">
        <div className="empty-layers">
          <Layers size={20} />
          <span>No caption selected</span>
          <small>Select or seek to a caption to manage its layers.</small>
        </div>
      </div>
    );
  }

  // Segment can have custom layers in segment.layers, plus default main track
  const layers = segment.layers ?? [];

  return (
    <div className="layers-panel">
      <div className="layers-header">
        <div className="layers-header-left">
          <span>TEXT & CAPTION LAYERS</span>
          <span className="layers-count">{1 + layers.length}</span>
        </div>
        <button
          type="button"
          className="add-layer-btn"
          onClick={onAddLayer}
          title="Add a new text layer"
        >
          <Plus size={13} /> Add Layer
        </button>
      </div>

      <div className="layers-list">
        {/* Layer 1: Primary Caption Segment */}
        <div
          className={`layer-item ${activeLayerId === "main" ? "layer-active" : ""}`}
          onClick={() => onSelectLayer("main")}
        >
          <div className="layer-row-top">
            <div className="layer-info">
              <span className="layer-pill">MAIN</span>
              <span className="layer-name-title" title={segment.text}>
                {segment.text.slice(0, 32) || "Caption Text"}
              </span>
            </div>

            <div className="layer-controls" onClick={(e) => e.stopPropagation()}>
              {/* Visibility toggle */}
              <button
                type="button"
                className={`layer-icon-btn ${segment.visible === false ? "is-off" : ""}`}
                title={segment.visible === false ? "Show layer" : "Hide layer"}
                onClick={() => onUpdateSegment({ visible: segment.visible === false ? true : false })}
              >
                {segment.visible === false ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>

              {/* Lock toggle */}
              <button
                type="button"
                className={`layer-icon-btn ${segment.locked ? "is-locked" : ""}`}
                title={segment.locked ? "Unlock layer" : "Lock layer"}
                onClick={() => onUpdateSegment({ locked: !segment.locked })}
              >
                {segment.locked ? <Lock size={13} /> : <Unlock size={13} />}
              </button>
            </div>
          </div>

          <div className="layer-row-bottom">
            <span className="layer-timing">
              {segment.start.toFixed(1)}s → {segment.end.toFixed(1)}s ({(segment.end - segment.start).toFixed(1)}s)
            </span>
            {segment.animation?.enabled && (
              <span className="layer-anim-badge">
                <Sparkles size={10} /> {segment.animation.keyframes.length} keyframes
              </span>
            )}
          </div>
        </div>

        {/* Custom Secondary Layers */}
        {layers.map((layer, index) => {
          const isActive = activeLayerId === layer.id;
          return (
            <div
              key={layer.id}
              className={`layer-item ${isActive ? "layer-active" : ""}`}
              onClick={() => onSelectLayer(layer.id)}
            >
              <div className="layer-row-top">
                <div className="layer-info">
                  <span className="layer-pill secondary">L{index + 2}</span>
                  {editingId === layer.id ? (
                    <input
                      className="layer-rename-input"
                      value={layer.name}
                      autoFocus
                      onChange={(e) => onUpdateLayer(layer.id, { name: e.target.value })}
                      onBlur={() => setEditingId(null)}
                      onKeyDown={(e) => e.key === "Enter" && setEditingId(null)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span
                      className="layer-name-title"
                      title="Double-click to rename"
                      onDoubleClick={() => setEditingId(layer.id)}
                    >
                      {layer.name || "Text Layer"}
                    </span>
                  )}
                </div>

                <div className="layer-controls" onClick={(e) => e.stopPropagation()}>
                  {/* Reorder Up */}
                  <button
                    type="button"
                    className="layer-icon-btn"
                    disabled={index === 0}
                    title="Move layer up"
                    onClick={() => onReorderLayer(layer.id, "up")}
                  >
                    <ArrowUp size={12} />
                  </button>

                  {/* Reorder Down */}
                  <button
                    type="button"
                    className="layer-icon-btn"
                    disabled={index === layers.length - 1}
                    title="Move layer down"
                    onClick={() => onReorderLayer(layer.id, "down")}
                  >
                    <ArrowDown size={12} />
                  </button>

                  {/* Visibility */}
                  <button
                    type="button"
                    className={`layer-icon-btn ${!layer.visible ? "is-off" : ""}`}
                    title={layer.visible ? "Hide layer" : "Show layer"}
                    onClick={() => onUpdateLayer(layer.id, { visible: !layer.visible })}
                  >
                    {layer.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                  </button>

                  {/* Lock */}
                  <button
                    type="button"
                    className={`layer-icon-btn ${layer.locked ? "is-locked" : ""}`}
                    title={layer.locked ? "Unlock layer" : "Lock layer"}
                    onClick={() => onUpdateLayer(layer.id, { locked: !layer.locked })}
                  >
                    {layer.locked ? <Lock size={13} /> : <Unlock size={13} />}
                  </button>

                  {/* Duplicate */}
                  <button
                    type="button"
                    className="layer-icon-btn"
                    title="Duplicate layer"
                    onClick={() => onDuplicateLayer(layer.id)}
                  >
                    <Copy size={12} />
                  </button>

                  {/* Delete */}
                  <button
                    type="button"
                    className="layer-icon-btn danger"
                    title="Delete layer"
                    onClick={() => onDeleteLayer(layer.id)}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>

              <div className="layer-row-bottom">
                <span className="layer-text-preview" title={layer.text}>
                  {layer.text || "(empty text)"}
                </span>
                {layer.animation?.enabled && (
                  <span className="layer-anim-badge">
                    <Sparkles size={10} /> {layer.animation.keyframes.length} keyframes
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
