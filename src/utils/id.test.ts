import { describe, expect, it } from "vitest";
import { createId } from "./id";

describe("createId", () => {
  it("produces distinct ids of 32 hex digits", () => {
    const ids = Array.from({ length: 200 }, createId);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => /^[0-9a-f]{32}$/.test(id))).toBe(true);
  });
});
