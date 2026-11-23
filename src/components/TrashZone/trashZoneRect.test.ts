import { describe, expect, it } from "vitest";
import { trashZoneRect } from "./trashZoneRect";

describe("trashZoneRect", () => {
  it("centers the zone just above the bottom edge of the board", () => {
    expect(trashZoneRect({ width: 1024, height: 716 })).toEqual({
      x: 367,
      y: 632,
      width: 290,
      height: 64,
    });
  });

  it("keeps to whole pixels on a board of odd width", () => {
    expect(trashZoneRect({ width: 1281, height: 748 }).x).toBe(496);
  });
});
