import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Note } from "../domain/note";
import { createMemoryStorage, createMockNotesApi } from "./mockNotesApi";

const note: Note = {
  id: "a",
  x: 10,
  y: 20,
  width: 200,
  height: 180,
  text: "hi",
  color: "green",
  z: 1,
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createMockNotesApi", () => {
  it("answers only after the configured latency", async () => {
    const api = createMockNotesApi({
      storage: createMemoryStorage(),
      latencyMs: 300,
    });
    const onListed = vi.fn();

    void api.list().then(onListed);
    await vi.advanceTimersByTimeAsync(299);
    expect(onListed).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(onListed).toHaveBeenCalledWith([]);
  });

  it("stores, replaces and removes notes", async () => {
    const storage = createMemoryStorage();
    const api = createMockNotesApi({ storage, latencyMs: 0 });
    const call = async <T>(request: Promise<T>): Promise<T> => {
      await vi.runAllTimersAsync();
      return request;
    };

    await call(api.save(note));
    await call(api.save({ ...note, text: "edited" }));
    expect(await call(api.list())).toEqual([{ ...note, text: "edited" }]);

    // A second client on the same storage sees the same data, as it would after a reload.
    const reloaded = createMockNotesApi({ storage, latencyMs: 0 });
    expect(await call(reloaded.list())).toEqual([{ ...note, text: "edited" }]);

    await call(api.remove(note.id));
    await call(api.remove(note.id));
    expect(await call(api.list())).toEqual([]);
  });

  it("applies a request as soon as it is issued, before the response arrives", () => {
    const storage = createMemoryStorage();
    const api = createMockNotesApi({ storage, latencyMs: 300 });

    void api.save(note);

    expect(storage.getItem("sticky-notes/notes")).toBe(JSON.stringify([note]));
  });

  it("starts empty when the stored data is corrupt", async () => {
    const storage = createMemoryStorage();
    storage.setItem("sticky-notes/notes", "{not json");
    const api = createMockNotesApi({ storage, latencyMs: 0 });

    const listed = api.list();
    await vi.runAllTimersAsync();

    expect(await listed).toEqual([]);
  });

  it("rejects without touching the data when a failure is simulated", async () => {
    const storage = createMemoryStorage();
    const api = createMockNotesApi({ storage, latencyMs: 0, failureRate: 1 });

    const saved = api.save(note);
    const outcome = expect(saved).rejects.toThrow("Simulated network failure");
    await vi.runAllTimersAsync();

    await outcome;
    expect(storage.getItem("sticky-notes/notes")).toBeNull();
  });
});
