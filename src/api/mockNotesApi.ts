import type { Note } from '../domain/note';
import type { NotesApi } from './notesApi';
import { parseNotes } from './parseNotes';

export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>;

export interface MockNotesApiOptions {
  readonly storage?: KeyValueStorage;
  readonly latencyMs?: number;
  /** Probability, from 0 to 1, that a request fails. */
  readonly failureRate?: number;
}

const STORAGE_KEY = 'sticky-notes/notes';

/** An in-browser stand-in for the notes backend, with `localStorage` as its database. */
export function createMockNotesApi({
  storage = defaultStorage(),
  latencyMs = 300,
  failureRate = 0,
}: MockNotesApiOptions = {}): NotesApi {
  function read(): Note[] {
    try {
      return parseNotes(JSON.parse(storage.getItem(STORAGE_KEY) ?? '[]'));
    } catch {
      return [];
    }
  }

  function write(notes: readonly Note[]): void {
    storage.setItem(STORAGE_KEY, JSON.stringify(notes));
  }

  /**
   * Handles the request at once and delays only the response, so a request sent
   * while the page closes still lands, as with `fetch(url, { keepalive: true })`.
   */
  function respond<T>(handle: () => T): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      let settle: () => void;
      try {
        if (Math.random() < failureRate) throw new Error('Simulated network failure');
        const result = handle();
        settle = () => resolve(result);
      } catch (error) {
        settle = () => reject(error instanceof Error ? error : new Error(String(error)));
      }
      setTimeout(settle, latencyMs);
    });
  }

  return {
    list: () => respond(read),
    save: (note) =>
      respond(() => {
        const notes = read();
        const index = notes.findIndex((stored) => stored.id === note.id);
        if (index === -1) notes.push(note);
        else notes[index] = note;
        write(notes);
      }),
    remove: (id) => respond(() => write(read().filter((note) => note.id !== id))),
  };
}

export function createMemoryStorage(): KeyValueStorage {
  const items = new Map<string, string>();
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => {
      items.set(key, value);
    },
  };
}

function defaultStorage(): KeyValueStorage {
  try {
    return window.localStorage;
  } catch {
    // Reading `localStorage` throws when the browser blocks site data.
    return createMemoryStorage();
  }
}
