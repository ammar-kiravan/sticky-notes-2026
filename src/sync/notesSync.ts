import type { NotesApi } from '../api/notesApi';
import type { Note } from '../domain/note';
import { applyChanges, diffNotes } from './diffNotes';
import type { NoteChange, ServerNotes } from './diffNotes';

export type SyncStatus = 'saved' | 'saving' | 'failed';

export interface NotesSync {
  /** Fetches the notes and remembers them as what the server holds. */
  load(): Promise<readonly Note[]>;
  /** Reports the current local notes. What differs from the server is sent after a short pause. */
  update(notes: readonly Note[]): void;
  retry(): void;
  /** Sends what is still unsaved right away, for when the page is being closed. */
  flushBeforeExit(): void;
  getStatus(): SyncStatus;
  subscribe(listener: () => void): () => void;
}

export interface NotesSyncOptions {
  /** How long to wait for further changes before sending, so that typing becomes one request. */
  readonly debounceMs?: number;
}

/**
 * Keeps the server in line with the local notes by sending the difference between
 * them rather than one request per action. A failed request is simply part of the
 * next difference.
 */
export function createNotesSync(
  api: NotesApi,
  { debounceMs = 400 }: NotesSyncOptions = {},
): NotesSync {
  /** What the server has confirmed. */
  let server: ServerNotes = new Map();
  /** Requests on their way. While there are any, no other batch is started. */
  let sending: readonly NoteChange[] = [];
  /** `null` until the app reports its notes, so that nothing is sent before the first load. */
  let local: readonly Note[] | null = null;
  let status: SyncStatus = 'saved';
  let timer: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<() => void>();

  function setStatus(next: SyncStatus): void {
    if (status === next) return;
    status = next;
    listeners.forEach((listener) => listener());
  }

  function unsaved(): NoteChange[] {
    return local ? diffNotes(server, local) : [];
  }

  function send(change: NoteChange): Promise<void> {
    return change.type === 'save' ? api.save(change.note) : api.remove(change.id);
  }

  async function flush(): Promise<void> {
    clearTimeout(timer);
    if (sending.length > 0) return;

    // One batch at a time, which keeps the requests for a note in order. Whatever changed
    // while a batch was out goes in the next one.
    let changes = unsaved();
    while (changes.length > 0) {
      setStatus('saving');
      sending = changes;
      const results = await Promise.allSettled(changes.map(send));
      sending = [];

      const succeeded = changes.filter((_, index) => results[index]?.status === 'fulfilled');
      server = applyChanges(server, succeeded);
      if (succeeded.length < changes.length) {
        setStatus('failed');
        return;
      }
      changes = unsaved();
    }
    setStatus('saved');
  }

  return {
    async load() {
      const notes = await api.list();
      server = new Map(notes.map((note) => [note.id, note]));
      return notes;
    },

    update(notes) {
      local = notes;
      // A batch is out; the flush that sent it sends this as well once it returns.
      if (sending.length > 0) return;

      clearTimeout(timer);
      if (unsaved().length === 0) {
        setStatus('saved');
        return;
      }
      setStatus('saving');
      timer = setTimeout(() => void flush(), debounceMs);
    },

    retry() {
      void flush();
    },

    flushBeforeExit() {
      if (!local) return;
      // Compared with the server as it will be once the batch in flight lands, so that undoing
      // one of those requests (restoring a note being deleted) is sent too. Repeating these
      // later is harmless: saving and removing by id are idempotent.
      for (const change of diffNotes(applyChanges(server, sending), local)) {
        send(change).catch(() => {});
      }
    },

    getStatus: () => status,

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
