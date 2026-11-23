import type { Rect, Size } from "../utils/geometry";

export const NOTE_COLORS = [
  "yellow",
  "orange",
  "pink",
  "purple",
  "blue",
  "green",
] as const;

export type NoteColor = (typeof NOTE_COLORS)[number];

export type NoteId = string;

export interface Note extends Rect {
  readonly id: NoteId;
  readonly text: string;
  readonly color: NoteColor;
  /** Stacking order: the note with the highest value is drawn on top. */
  readonly z: number;
}

export const MIN_NOTE_SIZE: Size = { width: 160, height: 120 };
export const DEFAULT_NOTE_SIZE: Size = { width: 220, height: 200 };
export const DEFAULT_NOTE_COLOR: NoteColor = "yellow";

export function isNoteColor(value: unknown): value is NoteColor {
  return NOTE_COLORS.some((color) => color === value);
}

export function notesEqual(a: Note, b: Note): boolean {
  return (
    a === b ||
    (a.id === b.id &&
      a.x === b.x &&
      a.y === b.y &&
      a.width === b.width &&
      a.height === b.height &&
      a.text === b.text &&
      a.color === b.color &&
      a.z === b.z)
  );
}
