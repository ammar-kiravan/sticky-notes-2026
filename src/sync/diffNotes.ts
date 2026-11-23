import { notesEqual } from '../domain/note';
import type { Note, NoteId } from '../domain/note';

export type ServerNotes = ReadonlyMap<NoteId, Note>;

/** One request to the server: `PUT /notes/:id` or `DELETE /notes/:id`. */
export type NoteChange =
  { readonly type: 'save'; readonly note: Note } | { readonly type: 'remove'; readonly id: NoteId };

/** The requests that bring the server's notes in line with the local ones. */
export function diffNotes(server: ServerNotes, local: readonly Note[]): NoteChange[] {
  const changes: NoteChange[] = [];

  for (const note of local) {
    const saved = server.get(note.id);
    if (!saved || !notesEqual(saved, note)) changes.push({ type: 'save', note });
  }

  const localIds = new Set(local.map((note) => note.id));
  for (const id of server.keys()) {
    if (!localIds.has(id)) changes.push({ type: 'remove', id });
  }

  return changes;
}

/** The server's notes once the given requests have succeeded. */
export function applyChanges(server: ServerNotes, changes: readonly NoteChange[]): ServerNotes {
  const next = new Map(server);
  for (const change of changes) {
    if (change.type === 'save') next.set(change.note.id, change.note);
    else next.delete(change.id);
  }
  return next;
}
