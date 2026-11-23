import { describe, expect, it } from 'vitest';
import type { Note } from '../domain/note';
import { applyChanges, diffNotes } from './diffNotes';
import type { ServerNotes } from './diffNotes';

function note(id: string, text = ''): Note {
  return { id, x: 0, y: 0, width: 200, height: 200, text, color: 'yellow', z: 1 };
}

function serverOf(...notes: Note[]): ServerNotes {
  return new Map(notes.map((n) => [n.id, n]));
}

describe('diffNotes', () => {
  it('is empty when both sides hold the same notes', () => {
    expect(diffNotes(serverOf(note('a'), note('b')), [note('a'), note('b')])).toEqual([]);
  });

  it('saves new and changed notes and removes the ones gone locally', () => {
    const changes = diffNotes(serverOf(note('a'), note('b')), [note('a', 'edited'), note('c')]);

    expect(changes).toEqual([
      { type: 'save', note: note('a', 'edited') },
      { type: 'save', note: note('c') },
      { type: 'remove', id: 'b' },
    ]);
  });
});

describe('applyChanges', () => {
  it('turns the server state into the local one', () => {
    const server = serverOf(note('a'), note('b'));
    const local = [note('a', 'edited'), note('c')];

    const next = applyChanges(server, diffNotes(server, local));

    expect([...next.values()]).toEqual(local);
    expect(server.size).toBe(2);
  });
});
