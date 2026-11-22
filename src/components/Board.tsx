import { useCallback, useRef, useState } from 'react';
import type { Dispatch } from 'react';
import type { Rect } from '../domain/geometry';
import { createNoteId } from '../domain/note';
import type { Note, NoteColor, NoteId } from '../domain/note';
import { useElementSize } from '../hooks/useElementSize';
import type { NotesAction } from '../state/notesReducer';
import { NoteCreator } from './NoteCreator';
import { NoteView } from './NoteView';
import { TrashZone } from './TrashZone';
import type { TrashState } from './TrashZone';
import './Board.css';

interface BoardProps {
  readonly notes: readonly Note[];
  readonly newNoteColor: NoteColor;
  readonly dispatch: Dispatch<NotesAction>;
}

export function Board({ notes, newNoteColor, dispatch }: BoardProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const trashRef = useRef<HTMLDivElement>(null);
  const bounds = useElementSize(boardRef);
  const [trashState, setTrashState] = useState<TrashState>('idle');
  const [newestNoteId, setNewestNoteId] = useState<NoteId | null>(null);

  const createNote = useCallback(
    (rect: Rect) => {
      const id = createNoteId();
      dispatch({ type: 'noteAdded', id, rect, color: newNoteColor });
      setNewestNoteId(id);
    },
    [dispatch, newNoteColor],
  );

  return (
    <div ref={boardRef} className="board">
      {/* Notes are positioned against the board's size, so they wait for the first measurement. */}
      {bounds && (
        <>
          <NoteCreator bounds={bounds} color={newNoteColor} onCreate={createNote} />
          {notes.map((note) => (
            <NoteView
              key={note.id}
              note={note}
              bounds={bounds}
              autoFocus={note.id === newestNoteId}
              trashRef={trashRef}
              dispatch={dispatch}
              onTrashStateChange={setTrashState}
            />
          ))}
        </>
      )}
      {notes.length === 0 && (
        <p className="board__hint">
          Drag anywhere on the board to draw a note.
          <br />
          Double-click to add one at the standard size.
        </p>
      )}
      <TrashZone ref={trashRef} state={trashState} />
    </div>
  );
}
