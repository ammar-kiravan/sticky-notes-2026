import { describe, expect, it } from 'vitest';
import { createNoteId } from './note';

describe('createNoteId', () => {
  it('produces distinct ids of 32 hex digits', () => {
    const ids = Array.from({ length: 200 }, createNoteId);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => /^[0-9a-f]{32}$/.test(id))).toBe(true);
  });
});
