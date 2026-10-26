import type { CaptionSegment, StyleSettings } from "../domain";

export interface StudioSnapshot {
  segments: CaptionSegment[];
  style: StyleSettings;
}

export class HistoryManager {
  private undoStack: StudioSnapshot[] = [];
  private redoStack: StudioSnapshot[] = [];
  private maxDepth: number;

  constructor(maxDepth = 50) {
    this.maxDepth = maxDepth;
  }

  public push(snapshot: StudioSnapshot): void {
    // Deep clone snapshot to prevent mutating past states
    const copy: StudioSnapshot = JSON.parse(JSON.stringify(snapshot));
    this.undoStack.push(copy);
    if (this.undoStack.length > this.maxDepth) {
      this.undoStack.shift();
    }
    // Clear redo stack upon new action
    this.redoStack = [];
  }

  public undo(currentSnapshot: StudioSnapshot): StudioSnapshot | null {
    if (this.undoStack.length === 0) return null;
    const currentCopy: StudioSnapshot = JSON.parse(JSON.stringify(currentSnapshot));
    this.redoStack.push(currentCopy);
    const previous = this.undoStack.pop()!;
    return JSON.parse(JSON.stringify(previous));
  }

  public redo(currentSnapshot: StudioSnapshot): StudioSnapshot | null {
    if (this.redoStack.length === 0) return null;
    const currentCopy: StudioSnapshot = JSON.parse(JSON.stringify(currentSnapshot));
    this.undoStack.push(currentCopy);
    const next = this.redoStack.pop()!;
    return JSON.parse(JSON.stringify(next));
  }

  public canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  public clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }
}
