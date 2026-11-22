import { describe, expect, it } from 'vitest';
import {
  containsPoint,
  fitPosition,
  rectFromDrag,
  rectsEqual,
  resizeRect,
  translate,
} from './geometry';
import type { Rect, Size } from './geometry';

const BOUNDS: Size = { width: 1000, height: 700 };
const MIN: Size = { width: 160, height: 120 };

describe('translate', () => {
  it('moves the rect and snaps it to whole pixels', () => {
    const rect: Rect = { x: 10, y: 20, width: 200, height: 150 };
    expect(translate(rect, { x: 5.4, y: -3.6 })).toEqual({ x: 15, y: 16, width: 200, height: 150 });
  });
});

describe('rectsEqual', () => {
  const rect: Rect = { x: 10, y: 20, width: 200, height: 150 };

  it('compares position and size', () => {
    expect(rectsEqual(rect, { ...rect })).toBe(true);
    expect(rectsEqual(rect, { ...rect, x: 11 })).toBe(false);
    expect(rectsEqual(rect, { ...rect, height: 151 })).toBe(false);
  });
});

describe('fitPosition', () => {
  it('leaves a rect that is inside the bounds where it is', () => {
    expect(fitPosition({ x: 100, y: 50, width: 200, height: 150 }, BOUNDS)).toEqual({
      x: 100,
      y: 50,
    });
  });

  it('pulls a rect back in from any side', () => {
    expect(fitPosition({ x: -40, y: -10, width: 200, height: 150 }, BOUNDS)).toEqual({
      x: 0,
      y: 0,
    });
    expect(fitPosition({ x: 950, y: 690, width: 200, height: 150 }, BOUNDS)).toEqual({
      x: 800,
      y: 550,
    });
  });

  it('pins a rect larger than the bounds to the top-left corner', () => {
    expect(fitPosition({ x: 300, y: 300, width: 1200, height: 900 }, BOUNDS)).toEqual({
      x: 0,
      y: 0,
    });
  });
});

describe('containsPoint', () => {
  const rect: Rect = { x: 100, y: 100, width: 50, height: 50 };

  it('includes the edges', () => {
    expect(containsPoint(rect, { x: 100, y: 150 })).toBe(true);
    expect(containsPoint(rect, { x: 125, y: 125 })).toBe(true);
  });

  it('excludes points outside', () => {
    expect(containsPoint(rect, { x: 99, y: 125 })).toBe(false);
    expect(containsPoint(rect, { x: 125, y: 151 })).toBe(false);
  });
});

describe('resizeRect', () => {
  const rect: Rect = { x: 300, y: 200, width: 200, height: 160 };

  it('moves only the edges that the handle controls', () => {
    expect(resizeRect(rect, 'se', { x: 40, y: 30 }, BOUNDS, MIN)).toEqual({
      x: 300,
      y: 200,
      width: 240,
      height: 190,
    });
    expect(resizeRect(rect, 'nw', { x: -40, y: -30 }, BOUNDS, MIN)).toEqual({
      x: 260,
      y: 170,
      width: 240,
      height: 190,
    });
    expect(resizeRect(rect, 'e', { x: 40, y: 500 }, BOUNDS, MIN)).toEqual({
      ...rect,
      width: 240,
    });
    expect(resizeRect(rect, 'n', { x: 500, y: -30 }, BOUNDS, MIN)).toEqual({
      ...rect,
      y: 170,
      height: 190,
    });
  });

  it('keeps the opposite edge still when shrinking stops at the minimum size', () => {
    expect(resizeRect(rect, 'nw', { x: 500, y: 500 }, BOUNDS, MIN)).toEqual({
      x: 340,
      y: 240,
      width: 160,
      height: 120,
    });
    expect(resizeRect(rect, 'se', { x: -500, y: -500 }, BOUNDS, MIN)).toEqual({
      x: 300,
      y: 200,
      width: 160,
      height: 120,
    });
  });

  it('stops the dragged edges at the bounds', () => {
    expect(resizeRect(rect, 'se', { x: 9999, y: 9999 }, BOUNDS, MIN)).toEqual({
      x: 300,
      y: 200,
      width: 700,
      height: 500,
    });
    expect(resizeRect(rect, 'nw', { x: -9999, y: -9999 }, BOUNDS, MIN)).toEqual({
      x: 0,
      y: 0,
      width: 500,
      height: 360,
    });
  });

  it('snaps to whole pixels', () => {
    expect(resizeRect(rect, 'se', { x: 10.6, y: 10.4 }, BOUNDS, MIN)).toEqual({
      x: 300,
      y: 200,
      width: 211,
      height: 170,
    });
  });
});

describe('rectFromDrag', () => {
  it('spans from the origin to the pointer in whichever direction it went', () => {
    expect(rectFromDrag({ x: 100, y: 100 }, { x: 400, y: 350 }, BOUNDS, MIN)).toEqual({
      x: 100,
      y: 100,
      width: 300,
      height: 250,
    });
    expect(rectFromDrag({ x: 400, y: 350 }, { x: 100, y: 100 }, BOUNDS, MIN)).toEqual({
      x: 100,
      y: 100,
      width: 300,
      height: 250,
    });
  });

  it('grows a short drag to the minimum size, away from the origin', () => {
    expect(rectFromDrag({ x: 500, y: 400 }, { x: 510, y: 410 }, BOUNDS, MIN)).toEqual({
      x: 500,
      y: 400,
      width: 160,
      height: 120,
    });
    expect(rectFromDrag({ x: 500, y: 400 }, { x: 490, y: 390 }, BOUNDS, MIN)).toEqual({
      x: 340,
      y: 280,
      width: 160,
      height: 120,
    });
  });

  it('stays inside the bounds when the pointer leaves them', () => {
    expect(rectFromDrag({ x: 700, y: 500 }, { x: 1300, y: 900 }, BOUNDS, MIN)).toEqual({
      x: 700,
      y: 500,
      width: 300,
      height: 200,
    });
  });

  it('shifts a minimum-size rect that would otherwise cross an edge', () => {
    expect(rectFromDrag({ x: 950, y: 650 }, { x: 960, y: 660 }, BOUNDS, MIN)).toEqual({
      x: 840,
      y: 580,
      width: 160,
      height: 120,
    });
  });
});
