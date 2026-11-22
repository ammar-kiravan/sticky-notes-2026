import type { Rect } from '../domain/geometry';
import type { Note, NoteColor, NoteId } from '../domain/note';

export interface NotesState {
  readonly notes: readonly Note[];
  /** The note removed last, kept around so that the removal can be undone. */
  readonly lastRemoved: Note | null;
}

export type NoteChanges = Partial<Pick<Note, 'x' | 'y' | 'width' | 'height' | 'text' | 'color'>>;

export type NotesAction =
  | { readonly type: 'notesLoaded'; readonly notes: readonly Note[] }
  | {
      readonly type: 'noteAdded';
      readonly id: NoteId;
      readonly rect: Rect;
      readonly color: NoteColor;
    }
  | { readonly type: 'noteChanged'; readonly id: NoteId; readonly changes: NoteChanges }
  | { readonly type: 'noteRaised'; readonly id: NoteId }
  | { readonly type: 'noteRemoved'; readonly id: NoteId }
  | { readonly type: 'removalUndone' }
  | { readonly type: 'undoDismissed' };

export const initialNotesState: NotesState = { notes: [], lastRemoved: null };

export function notesReducer(state: NotesState, action: NotesAction): NotesState {
  switch (action.type) {
    case 'notesLoaded':
      return { notes: action.notes, lastRemoved: null };

    case 'noteAdded': {
      const { x, y, width, height } = action.rect;
      const note: Note = {
        id: action.id,
        x,
        y,
        width,
        height,
        text: '',
        color: action.color,
        z: topZ(state.notes) + 1,
      };
      return { ...state, notes: [...state.notes, note] };
    }

    case 'noteChanged':
      return {
        ...state,
        notes: state.notes.map((note) =>
          note.id === action.id ? { ...note, ...action.changes } : note,
        ),
      };

    case 'noteRaised': {
      const target = state.notes.find((note) => note.id === action.id);
      if (!target || isOnTop(target, state.notes)) return state;
      const raised = { ...target, z: topZ(state.notes) + 1 };
      return { ...state, notes: state.notes.map((note) => (note === target ? raised : note)) };
    }

    case 'noteRemoved': {
      const removed = state.notes.find((note) => note.id === action.id);
      if (!removed) return state;
      return { notes: state.notes.filter((note) => note !== removed), lastRemoved: removed };
    }

    case 'removalUndone': {
      if (!state.lastRemoved) return state;
      // Other notes may have been raised since the removal, so the old `z` could collide.
      const restored = { ...state.lastRemoved, z: topZ(state.notes) + 1 };
      return { notes: [...state.notes, restored], lastRemoved: null };
    }

    case 'undoDismissed':
      return state.lastRemoved ? { ...state, lastRemoved: null } : state;
  }
}

function topZ(notes: readonly Note[]): number {
  return notes.reduce((top, note) => Math.max(top, note.z), 0);
}

function isOnTop(target: Note, notes: readonly Note[]): boolean {
  return notes.every((note) => note === target || note.z < target.z);
}
