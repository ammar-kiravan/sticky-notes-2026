import { describe, expect, it } from "vitest";
import type { Note } from "../../domain/note";
import {
  noteAdded,
  noteChanged,
  noteRaised,
  noteRemoved,
  removalUndone,
  undoDismissed,
} from "./actions";
import type { NotesAction } from "./actions";
import { initialNotesState, notesReducer } from "./reducer";
import type { NotesState } from "./reducer";

function note(id: string, z: number): Note {
  return {
    id,
    x: 0,
    y: 0,
    width: 200,
    height: 200,
    text: "",
    color: "yellow",
    z,
  };
}

function reduce(state: NotesState, ...actions: NotesAction[]): NotesState {
  return actions.reduce(notesReducer, state);
}

const loaded: NotesState = {
  notes: [note("a", 1), note("b", 2), note("c", 3)],
  lastRemoved: null,
};

describe("notesReducer", () => {
  it("adds a note on top of the existing ones", () => {
    const state = notesReducer(
      loaded,
      noteAdded("d", { x: 10, y: 20, width: 300, height: 250 }, "blue"),
    );

    expect(state.notes.at(-1)).toEqual({
      id: "d",
      x: 10,
      y: 20,
      width: 300,
      height: 250,
      text: "",
      color: "blue",
      z: 4,
    });
  });

  it("gives the first note on an empty board a positive z", () => {
    const state = notesReducer(
      initialNotesState,
      noteAdded("a", { x: 0, y: 0, width: 200, height: 200 }, "yellow"),
    );

    expect(state.notes[0]?.z).toBe(1);
  });

  it("changes only the targeted note and keeps the others identical", () => {
    const state = notesReducer(
      loaded,
      noteChanged("b", { text: "hello", x: 42 }),
    );

    expect(state.notes[1]).toMatchObject({
      id: "b",
      text: "hello",
      x: 42,
      y: 0,
    });
    expect(state.notes[0]).toBe(loaded.notes[0]);
    expect(state.notes[2]).toBe(loaded.notes[2]);
  });

  it("raises a note above the others without reordering the list", () => {
    const state = notesReducer(loaded, noteRaised("a"));

    expect(state.notes.map((n) => n.id)).toEqual(["a", "b", "c"]);
    expect(state.notes[0]?.z).toBe(4);
  });

  it("returns the same state when the raised note is already on top", () => {
    expect(notesReducer(loaded, noteRaised("c"))).toBe(loaded);
  });

  it("still raises a note that only shares the highest z with another", () => {
    const tied: NotesState = {
      notes: [note("a", 5), note("b", 5)],
      lastRemoved: null,
    };

    const state = notesReducer(tied, noteRaised("a"));

    expect(state.notes[0]?.z).toBe(6);
  });

  it("remembers a removed note and restores it on top when undone", () => {
    const removed = notesReducer(loaded, noteRemoved("b"));
    expect(removed.notes.map((n) => n.id)).toEqual(["a", "c"]);
    expect(removed.lastRemoved?.id).toBe("b");

    const restored = reduce(removed, noteRaised("a"), removalUndone());
    expect(restored.lastRemoved).toBeNull();
    expect(restored.notes.map((n) => n.id)).toEqual(["a", "c", "b"]);
    expect(restored.notes.at(-1)?.z).toBe(5);
  });

  it("can no longer undo once the offer has been dismissed", () => {
    const state = reduce(
      loaded,
      noteRemoved("b"),
      undoDismissed(),
      removalUndone(),
    );

    expect(state.notes.map((n) => n.id)).toEqual(["a", "c"]);
  });

  it("ignores actions for notes that do not exist", () => {
    expect(notesReducer(loaded, noteRemoved("missing"))).toBe(loaded);
    expect(notesReducer(loaded, noteRaised("missing"))).toBe(loaded);
  });
});
