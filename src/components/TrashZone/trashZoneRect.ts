import type { Rect, Size } from "../../utils/geometry";

const TRASH_ZONE_SIZE: Size = { width: 290, height: 64 };
const TRASH_ZONE_MARGIN = 20;

export function trashZoneRect(board: Size): Rect {
  return {
    x: Math.round((board.width - TRASH_ZONE_SIZE.width) / 2),
    y: board.height - TRASH_ZONE_SIZE.height - TRASH_ZONE_MARGIN,
    ...TRASH_ZONE_SIZE,
  };
}
