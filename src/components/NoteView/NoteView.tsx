import classNames from 'classnames';
import { memo } from 'react';
import type { Dispatch } from 'react';
import { RESIZE_HANDLES } from '../../utils/geometry';
import type { Rect, Size } from '../../utils/geometry';
import type { Note, NoteId } from '../../domain/note';
import { noteChanged, noteRaised } from '../../state/notes/actions';
import type { NotesAction } from '../../state/notes/actions';
import { ColorPicker } from '../ColorPicker/ColorPicker';
import type { TrashState } from '../TrashZone/TrashZone';
import { useNoteGestures } from './useNoteGestures';
import './NoteView.css';

interface NoteViewProps {
  readonly note: Note;
  readonly bounds: Size;
  readonly trash: Rect;
  readonly selected: boolean;
  readonly dispatch: Dispatch<NotesAction>;
  readonly onSelect: (id: NoteId) => void;
  readonly onTrashStateChange: (state: TrashState) => void;
}

/** Memoised: relies on the reducer keeping untouched notes identical and on stable callbacks. */
export const NoteView = memo(function NoteView({
  note,
  bounds,
  trash,
  selected,
  dispatch,
  onSelect,
  onTrashStateChange,
}: NoteViewProps) {
  const { rect, phase, overTrash, moveBindings, resizeBindings } = useNoteGestures({
    note,
    bounds,
    trash,
    dispatch,
    onTrashStateChange,
  });

  const select = () => {
    dispatch(noteRaised(note.id));
    onSelect(note.id);
  };

  return (
    <article
      className={classNames(
        'note',
        selected && 'note--selected',
        phase === 'moving' && 'note--moving',
        phase === 'resizing' && 'note--resizing',
        overTrash && 'note--over-trash',
      )}
      data-color={note.color}
      aria-label="Note"
      style={{
        transform: `translate(${rect.x}px, ${rect.y}px)`,
        width: rect.width,
        height: rect.height,
        // A moving note is lifted above everything by its class.
        zIndex: phase === 'moving' ? undefined : note.z,
      }}
      onPointerDown={select}
      onFocus={select}
    >
      <div className="note__paper">
        <header className="note__header" title="Drag to move" {...moveBindings} />
        <textarea
          className="note__text"
          aria-label="Note text"
          placeholder="Write something…"
          // Only takes effect when the note mounts: a new note, or one restored by Undo.
          autoFocus={selected}
          value={note.text}
          onChange={(event) => dispatch(noteChanged(note.id, { text: event.target.value }))}
        />
        <footer className="note__footer">
          <ColorPicker
            label="Note color"
            value={note.color}
            onChange={(color) => dispatch(noteChanged(note.id, { color }))}
          />
        </footer>
      </div>
      {RESIZE_HANDLES.map((handle) => (
        <div
          key={handle}
          className={`note__resize note__resize--${handle}`}
          data-handle={handle}
          {...resizeBindings}
        />
      ))}
    </article>
  );
});
