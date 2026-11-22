import { memo } from 'react';
import type { Dispatch, RefObject } from 'react';
import { RESIZE_HANDLES } from '../domain/geometry';
import type { Size } from '../domain/geometry';
import type { Note } from '../domain/note';
import type { NotesAction } from '../state/notesReducer';
import { classNames } from '../utils/classNames';
import { ColorPicker } from './ColorPicker';
import type { TrashState } from './TrashZone';
import { useNoteGestures } from './useNoteGestures';
import './NoteView.css';

interface NoteViewProps {
  readonly note: Note;
  /** Size of the board the note lives on. */
  readonly bounds: Size;
  /** Puts the caret into the note when it appears, so a new note can be typed into at once. */
  readonly autoFocus: boolean;
  readonly trashRef: RefObject<HTMLElement | null>;
  readonly dispatch: Dispatch<NotesAction>;
  readonly onTrashStateChange: (state: TrashState) => void;
}

/**
 * Memoised so that a change to one note, or a re-render of the board, leaves
 * the other notes alone. That relies on the reducer keeping untouched notes
 * identical and on the remaining props being stable between renders.
 */
export const NoteView = memo(function NoteView({
  note,
  bounds,
  autoFocus,
  trashRef,
  dispatch,
  onTrashStateChange,
}: NoteViewProps) {
  const { rect, phase, overTrash, moveBindings, resizeBindings } = useNoteGestures({
    note,
    bounds,
    trashRef,
    dispatch,
    onTrashStateChange,
  });

  const raise = () => dispatch({ type: 'noteRaised', id: note.id });

  return (
    <article
      className={classNames(
        'note',
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
        // While being moved the note is lifted above everything via its class.
        zIndex: phase === 'moving' ? undefined : note.z,
      }}
      onPointerDown={raise}
      onFocus={raise}
    >
      <div className="note__paper">
        <header className="note__header" title="Drag to move" {...moveBindings}>
          <ColorPicker
            className="note__colors"
            label="Note color"
            value={note.color}
            onChange={(color) => dispatch({ type: 'noteChanged', id: note.id, changes: { color } })}
          />
        </header>
        <textarea
          className="note__text"
          aria-label="Note text"
          placeholder="Write something…"
          autoFocus={autoFocus}
          value={note.text}
          onChange={(event) =>
            dispatch({ type: 'noteChanged', id: note.id, changes: { text: event.target.value } })
          }
        />
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
