export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Size {
  readonly width: number;
  readonly height: number;
}

export interface Rect extends Point, Size {}

export const RESIZE_HANDLES = [
  "n",
  "ne",
  "e",
  "se",
  "s",
  "sw",
  "w",
  "nw",
] as const;

export type ResizeHandle = (typeof RESIZE_HANDLES)[number];

/** Which edge a handle drags on each axis: -1 is the left/top edge, 1 the right/bottom edge. */
const HANDLE_DIRECTION: Readonly<Record<ResizeHandle, Point>> = {
  n: { x: 0, y: -1 },
  ne: { x: 1, y: -1 },
  e: { x: 1, y: 0 },
  se: { x: 1, y: 1 },
  s: { x: 0, y: 1 },
  sw: { x: -1, y: 1 },
  w: { x: -1, y: 0 },
  nw: { x: -1, y: -1 },
};

export function isResizeHandle(value: unknown): value is ResizeHandle {
  return RESIZE_HANDLES.some((handle) => handle === value);
}

/** A regular clamp, except that `min` wins when the range is empty (`min > max`). */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function containsPoint(rect: Rect, point: Point): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

export function rectsEqual(a: Rect, b: Rect): boolean {
  return (
    a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height
  );
}

/** Rects that only touch along an edge do not intersect. */
export function rectsIntersect(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height
  );
}

export function translate(rect: Rect, delta: Point): Rect {
  return {
    x: Math.round(rect.x + delta.x),
    y: Math.round(rect.y + delta.y),
    width: rect.width,
    height: rect.height,
  };
}

/**
 * The position closest to the rect's own that keeps it inside `bounds`. A rect
 * larger than the bounds is pinned to the top-left corner.
 */
export function fitPosition(rect: Rect, bounds: Size): Point {
  return {
    x: clamp(rect.x, 0, bounds.width - rect.width),
    y: clamp(rect.y, 0, bounds.height - rect.height),
  };
}

/**
 * Resizes `rect` by dragging one of its handles by `delta`. The dragged edges
 * stop at the bounds, and the minimum size takes priority over the bounds.
 */
export function resizeRect(
  rect: Rect,
  handle: ResizeHandle,
  delta: Point,
  bounds: Size,
  minSize: Size,
): Rect {
  const direction = HANDLE_DIRECTION[handle];
  const horizontal = resizeSpan(
    rect.x,
    rect.width,
    direction.x,
    Math.round(delta.x),
    bounds.width,
    minSize.width,
  );
  const vertical = resizeSpan(
    rect.y,
    rect.height,
    direction.y,
    Math.round(delta.y),
    bounds.height,
    minSize.height,
  );
  return {
    x: horizontal.start,
    width: horizontal.length,
    y: vertical.start,
    height: vertical.length,
  };
}

/**
 * The rect swept out by dragging from `origin` to `pointer`. It stays anchored
 * at the origin, is never smaller than `minSize` and is kept inside `bounds`.
 */
export function rectFromDrag(
  origin: Point,
  pointer: Point,
  bounds: Size,
  minSize: Size,
): Rect {
  const horizontal = sweepSpan(
    origin.x,
    pointer.x,
    bounds.width,
    minSize.width,
  );
  const vertical = sweepSpan(
    origin.y,
    pointer.y,
    bounds.height,
    minSize.height,
  );
  return {
    x: horizontal.start,
    width: horizontal.length,
    y: vertical.start,
    height: vertical.length,
  };
}

interface Span {
  readonly start: number;
  readonly length: number;
}

function resizeSpan(
  start: number,
  length: number,
  direction: number,
  delta: number,
  limit: number,
  minLength: number,
): Span {
  const end = start + length;
  if (direction < 0) {
    const nextStart = Math.min(end - minLength, Math.max(0, start + delta));
    return { start: nextStart, length: end - nextStart };
  }
  if (direction > 0) {
    const nextEnd = Math.max(start + minLength, Math.min(limit, end + delta));
    return { start, length: nextEnd - start };
  }
  return { start, length };
}

function sweepSpan(
  origin: number,
  pointer: number,
  limit: number,
  minLength: number,
): Span {
  const anchor = Math.round(origin);
  const target = clamp(Math.round(pointer), 0, limit);
  const length = Math.max(Math.abs(target - anchor), minLength);
  const start = target < anchor ? anchor - length : anchor;
  return { start: clamp(start, 0, limit - length), length };
}
