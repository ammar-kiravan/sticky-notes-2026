import { clamp } from '../utils/geometry';
import { MIN_NOTE_SIZE, isNoteColor } from '../domain/note';
import type { Note, NoteId } from '../domain/note';

/** Far above any stacking value the app produces, far below the largest CSS z-index. */
const MAX_Z = 1_000_000_000;

/** Turns untrusted JSON into notes, dropping malformed entries and repeated ids. */
export function parseNotes(value: unknown): Note[] {
  if (!Array.isArray(value)) return [];

  const notes = new Map<NoteId, Note>();
  for (const item of value) {
    const note = parseNote(item);
    if (note && !notes.has(note.id)) notes.set(note.id, note);
  }
  return [...notes.values()];
}

function parseNote(value: unknown): Note | null {
  if (!isRecord(value)) return null;

  const { id, x, y, width, height, text, color, z } = value;
  const valid =
    typeof id === 'string' &&
    id !== '' &&
    typeof text === 'string' &&
    isNoteColor(color) &&
    isFiniteNumber(x) &&
    isFiniteNumber(y) &&
    isFiniteNumber(width) &&
    isFiniteNumber(height) &&
    isFiniteNumber(z);
  if (!valid) return null;

  return {
    id,
    x: Math.max(0, x),
    y: Math.max(0, y),
    width: Math.max(MIN_NOTE_SIZE.width, width),
    height: Math.max(MIN_NOTE_SIZE.height, height),
    text,
    color,
    // A CSS z-index: whole, and positive to stay above the board's surface.
    z: clamp(Math.round(z), 1, MAX_Z),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
