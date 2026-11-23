import { useMemo, useState } from 'react';
import type { Dispatch } from 'react';
import type { Rect, Size } from '../../utils/geometry';
import type { Note, NoteColor, NoteId } from '../../domain/note';
import { trashZoneRect } from '../TrashZone/trashZoneRect';
import type { NotesAction } from '../../state/notes/actions';
import { NoteCreator } from '../NoteCreator/NoteCreator';
import { NoteView } from '../NoteView/NoteView';
import { TrashZone } from '../TrashZone/TrashZone';
import type { TrashState } from '../TrashZone/TrashZone';
import './Board.css';

interface BoardProps {
  readonly notes: readonly Note[];
  readonly bounds: Size;
  readonly newNoteColor: NoteColor;
  readonly selectedNoteId: NoteId | null;
  readonly dispatch: Dispatch<NotesAction>;
  readonly onCreateNote: (rect: Rect) => void;
  readonly onSelectNote: (id: NoteId | null) => void;
}

export function Board({
  notes,
  bounds,
  newNoteColor,
  selectedNoteId,
  dispatch,
  onCreateNote,
  onSelectNote,
}: BoardProps) {
  // Stable identity, so the memoised notes do not re-render.
  const trash = useMemo(() => trashZoneRect(bounds), [bounds]);
  const [trashState, setTrashState] = useState<TrashState>('idle');

  return (
    <div className="board">
      <NoteCreator
        bounds={bounds}
        color={newNoteColor}
        onPress={() => onSelectNote(null)}
        onCreate={onCreateNote}
      />
      {notes.map((note) => (
        <NoteView
          key={note.id}
          note={note}
          bounds={bounds}
          trash={trash}
          selected={note.id === selectedNoteId}
          dispatch={dispatch}
          onSelect={onSelectNote}
          onTrashStateChange={setTrashState}
        />
      ))}
      <TrashZone rect={trash} state={trashState} />
      {notes.length === 0 && (
        <p className="board__hint">
          Drag anywhere on the board to draw a note,
          <br />
          or type an exact size and position into the bar above.
        </p>
      )}
    </div>
  );
}
