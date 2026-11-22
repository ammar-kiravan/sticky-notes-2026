import type { NotesApi } from '../api/notesApi';
import { notesEqual } from '../domain/note';
import type { Note, NoteId } from '../domain/note';

export type SyncStatus = 'saved' | 'saving' | 'failed';

export interface NotesSync {
  /** Fetches the notes and takes them as the server state to compare against. */
  load(): Promise<readonly Note[]>;
  /** Reports the current local notes. Differences from the server are sent after a short pause. */
  update(notes: readonly Note[]): void;
  /** Sends the pending changes again after a failure. */
  retry(): void;
  /** Issues the requests for all pending changes without waiting for the page to stay alive. */
  flushBeforeExit(): void;
  getStatus(): SyncStatus;
  subscribe(listener: () => void): () => void;
}

export interface NotesSyncOptions {
  /** How long to wait for further changes before sending, so that bursts become one request. */
  readonly debounceMs?: number;
}

type SyncOperation =
  { readonly type: 'save'; readonly note: Note } | { readonly type: 'remove'; readonly id: NoteId };

type ServerNotes = ReadonlyMap<NoteId, Note>;

/**
 * Keeps the server in line with the local notes. Rather than mirroring each
 * user action as a request, it compares the local state with what the server
 * has acknowledged and sends only the difference. Changes that cancel out
 * before they are sent cost nothing, a burst of keystrokes becomes one request,
 * and a failed request is simply part of the next difference.
 */
export function createNotesSync(
  api: NotesApi,
  { debounceMs = 400 }: NotesSyncOptions = {},
): NotesSync {
  /** The notes as the server has confirmed them. */
  let acknowledged: ServerNotes = new Map();
  /** Requests that have been sent and not answered yet. */
  let inFlight: readonly SyncOperation[] = [];
  /** Stays `null` until the app reports its state, so that nothing is sent before the first load. */
  let local: readonly Note[] | null = null;
  let status: SyncStatus = 'saved';
  let timer: ReturnType<typeof setTimeout> | undefined;
  let flushing = false;
  const listeners = new Set<() => void>();

  function setStatus(next: SyncStatus): void {
    if (status === next) return;
    status = next;
    listeners.forEach((listener) => listener());
  }

  /** The requests that would bring `server` in line with the local notes. */
  function pendingOperations(server: ServerNotes = acknowledged): SyncOperation[] {
    if (local === null) return [];

    const operations: SyncOperation[] = [];
    const localIds = new Set<NoteId>();
    for (const note of local) {
      localIds.add(note.id);
      const known = server.get(note.id);
      if (!known || !notesEqual(known, note)) operations.push({ type: 'save', note });
    }
    for (const id of server.keys()) {
      if (!localIds.has(id)) operations.push({ type: 'remove', id });
    }
    return operations;
  }

  function send(operation: SyncOperation): Promise<void> {
    return operation.type === 'save' ? api.save(operation.note) : api.remove(operation.id);
  }

  async function attempt(operation: SyncOperation): Promise<boolean> {
    try {
      await send(operation);
      return true;
    } catch {
      return false;
    }
  }

  /** Only one flush runs at a time, which keeps the requests for any one note in order. */
  async function flush(): Promise<void> {
    clearTimeout(timer);
    if (flushing) return;

    flushing = true;
    try {
      // Loops because the local notes may have changed again while requests were in flight.
      for (;;) {
        const operations = pendingOperations();
        if (operations.length === 0) {
          setStatus('saved');
          return;
        }

        setStatus('saving');
        inFlight = operations;
        const outcomes = await Promise.all(operations.map(attempt));
        inFlight = [];

        const succeeded = operations.filter((_, index) => outcomes[index]);
        acknowledged = applyOperations(acknowledged, succeeded);

        if (succeeded.length < operations.length) {
          setStatus('failed');
          return;
        }
      }
    } finally {
      flushing = false;
    }
  }

  return {
    async load() {
      const notes = await api.list();
      acknowledged = new Map(notes.map((note) => [note.id, note]));
      return notes;
    },

    update(notes) {
      local = notes;
      // A running flush picks the new state up by itself once its requests return.
      if (flushing) return;

      clearTimeout(timer);
      if (pendingOperations().length === 0) {
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
      // Requests in flight have already left, so what matters is the state the server will be
      // in once they land. Comparing with `acknowledged` alone would miss a change that undoes
      // one of them, such as restoring a note whose deletion is on its way.
      const expected = applyOperations(acknowledged, inFlight);
      // Fire-and-forget on purpose. Should the page live on after all, the regular flush repeats
      // these requests, which is harmless because they are idempotent.
      for (const operation of pendingOperations(expected)) void attempt(operation);
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

function applyOperations(server: ServerNotes, operations: readonly SyncOperation[]): ServerNotes {
  const next = new Map(server);
  for (const operation of operations) {
    if (operation.type === 'save') next.set(operation.note.id, operation.note);
    else next.delete(operation.id);
  }
  return next;
}
