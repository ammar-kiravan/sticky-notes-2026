import { describe, expect, it } from "vitest";
import { parseNotes } from "./parseNotes";

const valid = {
  id: "a",
  x: 10,
  y: 20,
  width: 200,
  height: 180,
  text: "hi",
  color: "pink",
  z: 3,
};

describe("parseNotes", () => {
  it("accepts well-formed notes", () => {
    expect(parseNotes([valid])).toEqual([valid]);
  });

  it("returns nothing for a value that is not a list", () => {
    expect(parseNotes(null)).toEqual([]);
    expect(parseNotes({ notes: [valid] })).toEqual([]);
  });

  it("drops malformed entries and keeps the rest", () => {
    const parsed = parseNotes([
      null,
      "note",
      { ...valid, id: "no-color", color: "mauve" },
      { ...valid, id: "bad-number", x: Number.NaN },
      { ...valid, id: "missing-text", text: undefined },
      { ...valid, id: "" },
      { ...valid, id: "ok" },
    ]);

    expect(parsed.map((note) => note.id)).toEqual(["ok"]);
  });

  it("keeps the first of two entries with the same id", () => {
    const parsed = parseNotes([valid, { ...valid, text: "duplicate" }]);

    expect(parsed).toEqual([valid]);
  });

  it("repairs geometry that the app itself would never produce", () => {
    const [note] = parseNotes([
      { ...valid, x: -50, y: -1, width: 5, height: 5 },
    ]);

    expect(note).toMatchObject({ x: 0, y: 0, width: 160, height: 120 });
  });

  it("turns any stacking value into a positive whole number of sane size", () => {
    const parsed = parseNotes([
      { ...valid, id: "negative", z: -3 },
      { ...valid, id: "fraction", z: 2.5 },
      { ...valid, id: "huge", z: 3e9 },
    ]);

    expect(parsed.map((note) => note.z)).toEqual([1, 3, 1_000_000_000]);
  });

  it("strips properties it does not know about", () => {
    const [note] = parseNotes([{ ...valid, admin: true }]);

    expect(note).toEqual(valid);
  });
});
