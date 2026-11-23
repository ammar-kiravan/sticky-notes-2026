import type { Rect } from '../../utils/geometry';
import type { Note, NoteColor, NoteId } from '../../domain/note';

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

export function notesLoaded(notes: readonly Note[]): NotesAction {
  return { type: 'notesLoaded', notes };
}

export function noteAdded(id: NoteId, rect: Rect, color: NoteColor): NotesAction {
  return { type: 'noteAdded', id, rect, color };
}

export function noteChanged(id: NoteId, changes: NoteChanges): NotesAction {
  return { type: 'noteChanged', id, changes };
}

export function noteRaised(id: NoteId): NotesAction {
  return { type: 'noteRaised', id };
}

export function noteRemoved(id: NoteId): NotesAction {
  return { type: 'noteRemoved', id };
}

export function removalUndone(): NotesAction {
  return { type: 'removalUndone' };
}

export function undoDismissed(): NotesAction {
  return { type: 'undoDismissed' };
}
