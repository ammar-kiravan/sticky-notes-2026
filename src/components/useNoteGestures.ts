import { useState } from 'react';
import type { Dispatch, RefObject } from 'react';
import {
  containsPoint,
  fitPosition,
  isResizeHandle,
  rectsEqual,
  resizeRect,
  translate,
} from '../domain/geometry';
import type { Rect, ResizeHandle, Size } from '../domain/geometry';
import { MIN_NOTE_SIZE } from '../domain/note';
import type { Note } from '../domain/note';
import { usePointerDrag } from '../hooks/usePointerDrag';
import type { DragBindings } from '../hooks/usePointerDrag';
import type { NotesAction } from '../state/notesReducer';
import type { TrashState } from './TrashZone';

interface NoteGesturesOptions {
  readonly note: Note;
  readonly bounds: Size;
  readonly trashRef: RefObject<HTMLElement | null>;
  readonly dispatch: Dispatch<NotesAction>;
  readonly onTrashStateChange: (state: TrashState) => void;
}

interface NoteGestures {
  /** Where to draw the note right now, whether or not a gesture is running. */
  readonly rect: Rect;
  readonly phase: 'idle' | 'moving' | 'resizing';
  readonly overTrash: boolean;
  readonly moveBindings: DragBindings;
  readonly resizeBindings: DragBindings;
}

type Gesture =
  | { readonly kind: 'move'; readonly rect: Rect; readonly overTrash: boolean }
  | { readonly kind: 'resize'; readonly rect: Rect };

interface MoveContext {
  readonly start: Rect;
  /** The trash zone in client coordinates, or `null` when this drag cannot delete. */
  readonly trash: Rect | null;
}

interface ResizeContext {
  readonly start: Rect;
  readonly handle: ResizeHandle;
}

/**
 * Moving and resizing a note. While a gesture runs its geometry lives in local
 * state, so each frame re-renders only this note; the store hears about the
 * outcome once, when the pointer is released.
 */
export function useNoteGestures({
  note,
  bounds,
  trashRef,
  dispatch,
  onTrashStateChange,
}: NoteGesturesOptions): NoteGestures {
  const [gesture, setGesture] = useState<Gesture | null>(null);

  // A stored position can lie outside the board after the window has shrunk. It is corrected
  // for display only. The stored value changes when the user actually moves or resizes the
  // note, which is why the gestures below compare their result with where they started.
  const settled: Rect = { ...fitPosition(note, bounds), width: note.width, height: note.height };

  const moveBindings = usePointerDrag<MoveContext>({
    onStart(event) {
      // Presses on the controls inside the strip, the color swatches, are theirs to handle.
      if (event.target !== event.currentTarget) return null;

      const zone = trashRef.current?.getBoundingClientRect();
      // A note that already lies under the trash zone can be picked up without deleting it.
      const startsOutside = zone && !containsPoint(zone, { x: event.clientX, y: event.clientY });
      const trash = startsOutside ? zone : null;

      setGesture({ kind: 'move', rect: settled, overTrash: false });
      if (trash) onTrashStateChange('ready');
      return { start: settled, trash };
    },

    onMove({ start, trash }, drag) {
      const overTrash = trash !== null && containsPoint(trash, drag.pointer);
      setGesture({ kind: 'move', rect: translate(start, drag.delta), overTrash });
      if (trash) onTrashStateChange(overTrash ? 'hover' : 'ready');
    },

    onEnd({ start, trash }, drag) {
      setGesture(null);
      onTrashStateChange('idle');

      if (trash && containsPoint(trash, drag.pointer)) {
        dispatch({ type: 'noteRemoved', id: note.id });
        return;
      }
      // The note follows the pointer freely while dragged and is pulled back onto the board here.
      const position = fitPosition(translate(start, drag.delta), bounds);
      if (position.x !== start.x || position.y !== start.y) {
        dispatch({ type: 'noteChanged', id: note.id, changes: position });
      }
    },

    onCancel() {
      setGesture(null);
      onTrashStateChange('idle');
    },
  });

  const resizeBindings = usePointerDrag<ResizeContext>({
    onStart(event) {
      const handle = event.currentTarget.dataset.handle;
      if (!isResizeHandle(handle)) return null;

      setGesture({ kind: 'resize', rect: settled });
      return { start: settled, handle };
    },

    onMove({ start, handle }, drag) {
      const rect = resizeRect(start, handle, drag.delta, bounds, MIN_NOTE_SIZE);
      setGesture({ kind: 'resize', rect });
    },

    onEnd({ start, handle }, drag) {
      setGesture(null);

      const rect = resizeRect(start, handle, drag.delta, bounds, MIN_NOTE_SIZE);
      if (!rectsEqual(rect, start)) {
        dispatch({ type: 'noteChanged', id: note.id, changes: rect });
      }
    },

    onCancel() {
      setGesture(null);
    },
  });

  return {
    rect: gesture?.rect ?? settled,
    phase: gesture === null ? 'idle' : gesture.kind === 'move' ? 'moving' : 'resizing',
    overTrash: gesture?.kind === 'move' && gesture.overTrash,
    moveBindings,
    resizeBindings,
  };
}
