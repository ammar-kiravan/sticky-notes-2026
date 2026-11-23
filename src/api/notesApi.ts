import type { Note, NoteId } from "../domain/note";

/**
 * The REST resource that stores the notes. Ids are generated on the client, so
 * both writes are idempotent and can be repeated safely after a failure.
 */
export interface NotesApi {
  /** `GET /notes` */
  list(): Promise<Note[]>;
  /** `PUT /notes/:id`: creates the note or replaces the stored one. */
  save(note: Note): Promise<void>;
  /** `DELETE /notes/:id`: succeeds even when the note is already gone. */
  remove(id: NoteId): Promise<void>;
}
