import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NotesApi } from '../api/notesApi';
import type { Note } from '../domain/note';
import { createNotesSync } from './notesSync';

const DEBOUNCE_MS = 400;

function note(id: string, text = ''): Note {
  return { id, x: 0, y: 0, width: 200, height: 200, text, color: 'yellow', z: 1 };
}

interface Deferred {
  resolve(): void;
  reject(): void;
}

/** An API whose writes stay pending until the test settles them. */
function createControlledApi(stored: Note[] = []) {
  const pending: Deferred[] = [];
  const defer = () =>
    new Promise<void>((resolve, reject) => {
      pending.push({ resolve, reject: () => reject(new Error('offline')) });
    });

  const api = {
    list: vi.fn<NotesApi['list']>(() => Promise.resolve(stored)),
    save: vi.fn<NotesApi['save']>(defer),
    remove: vi.fn<NotesApi['remove']>(defer),
  };

  /** Settles every request issued so far and lets the sync engine react. */
  async function settle(outcome: keyof Deferred = 'resolve'): Promise<void> {
    pending.splice(0).forEach((request) => request[outcome]());
    await vi.advanceTimersByTimeAsync(0);
  }

  return { api, settle };
}

async function start(stored: Note[] = []) {
  const { api, settle } = createControlledApi(stored);
  const sync = createNotesSync(api, { debounceMs: DEBOUNCE_MS });
  const loaded = await sync.load();
  sync.update(loaded);
  return { api, settle, sync };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('createNotesSync', () => {
  it('has nothing to send right after loading', async () => {
    const { api, sync } = await start([note('a')]);

    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);

    expect(sync.getStatus()).toBe('saved');
    expect(api.save).not.toHaveBeenCalled();
    expect(api.remove).not.toHaveBeenCalled();
  });

  it('sends nothing before the app has reported its notes', async () => {
    const { api } = createControlledApi([note('a')]);
    const sync = createNotesSync(api, { debounceMs: DEBOUNCE_MS });
    await sync.load();

    sync.retry();
    sync.flushBeforeExit();
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);

    expect(api.remove).not.toHaveBeenCalled();
  });

  it('saves new and changed notes and removes missing ones', async () => {
    const a = note('a');
    const b = note('b');
    const { api, settle, sync } = await start([a, b]);

    const editedA = { ...a, text: 'edited' };
    const c = note('c');
    sync.update([editedA, c]);
    expect(sync.getStatus()).toBe('saving');

    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    expect(api.save.mock.calls).toEqual([[editedA], [c]]);
    expect(api.remove.mock.calls).toEqual([['b']]);

    await settle();
    expect(sync.getStatus()).toBe('saved');
  });

  it('collapses a burst of changes into one request', async () => {
    const { api, sync } = await start([note('a')]);

    sync.update([note('a', 'h')]);
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS - 1);
    sync.update([note('a', 'he')]);
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS - 1);
    sync.update([note('a', 'hey')]);
    expect(api.save).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    expect(api.save.mock.calls).toEqual([[note('a', 'hey')]]);
  });

  it('sends nothing when the changes cancel each other out', async () => {
    const a = note('a');
    const { api, sync } = await start([a]);

    sync.update([]);
    expect(sync.getStatus()).toBe('saving');
    sync.update([{ ...a }]);
    expect(sync.getStatus()).toBe('saved');

    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    expect(api.save).not.toHaveBeenCalled();
    expect(api.remove).not.toHaveBeenCalled();
  });

  it('follows up with the changes made while requests were in flight', async () => {
    const { api, settle, sync } = await start([note('a')]);

    sync.update([note('a', 'first')]);
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    sync.update([note('a', 'second')]);
    expect(api.save).toHaveBeenCalledTimes(1);

    await settle();
    expect(api.save.mock.calls).toEqual([[note('a', 'first')], [note('a', 'second')]]);
    expect(sync.getStatus()).toBe('saving');

    await settle();
    expect(sync.getStatus()).toBe('saved');
    expect(api.save).toHaveBeenCalledTimes(2);
  });

  it('reports a failure and sends the same change again on retry', async () => {
    const { api, settle, sync } = await start();
    const statuses: string[] = [];
    sync.subscribe(() => statuses.push(sync.getStatus()));

    sync.update([note('a')]);
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    await settle('reject');
    expect(sync.getStatus()).toBe('failed');

    sync.retry();
    expect(api.save.mock.calls).toEqual([[note('a')], [note('a')]]);

    await settle();
    expect(statuses).toEqual(['saving', 'failed', 'saving', 'saved']);
  });

  it('retries a failed change together with the next one', async () => {
    const { api, settle, sync } = await start();

    sync.update([note('a')]);
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    await settle('reject');

    sync.update([note('a'), note('b')]);
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);

    expect(api.save.mock.calls).toEqual([[note('a')], [note('a')], [note('b')]]);
    await settle();
    expect(sync.getStatus()).toBe('saved');
  });

  it('issues pending requests at once when the page is closing', async () => {
    const { api, sync } = await start([note('a')]);

    sync.update([note('b')]);
    sync.flushBeforeExit();

    expect(api.save.mock.calls).toEqual([[note('b')]]);
    expect(api.remove.mock.calls).toEqual([['a']]);
  });

  it('restores a note on exit whose deletion is still in flight', async () => {
    const a = note('a');
    const { api, sync } = await start([a]);

    sync.update([]);
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    expect(api.remove.mock.calls).toEqual([['a']]);

    // The deletion is undone before the server has answered.
    sync.update([a]);
    sync.flushBeforeExit();

    expect(api.save.mock.calls).toEqual([[a]]);
  });

  it('removes a note on exit whose creation is still in flight', async () => {
    const { api, sync } = await start();

    sync.update([note('a')]);
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    expect(api.save.mock.calls).toEqual([[note('a')]]);

    sync.update([]);
    sync.flushBeforeExit();

    expect(api.remove.mock.calls).toEqual([['a']]);
  });

  it('does not repeat a request on exit that is already in flight', async () => {
    const { api, sync } = await start();

    sync.update([note('a')]);
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    sync.flushBeforeExit();

    expect(api.save).toHaveBeenCalledTimes(1);
  });

  it('stops notifying a listener that has unsubscribed', async () => {
    const { sync } = await start();
    const listener = vi.fn();

    const unsubscribe = sync.subscribe(listener);
    unsubscribe();
    sync.update([note('a')]);

    expect(listener).not.toHaveBeenCalled();
  });
});
