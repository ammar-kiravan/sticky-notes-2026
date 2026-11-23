import { useState } from 'react';
import type { Dispatch } from 'react';
import {
  containsPoint,
  fitPosition,
  isResizeHandle,
  rectsEqual,
  rectsIntersect,
  resizeRect,
  translate,
} from '../../utils/geometry';
import type { Point, Rect, ResizeHandle, Size } from '../../utils/geometry';
import { MIN_NOTE_SIZE } from '../../domain/note';
import type { Note } from '../../domain/note';
import { usePointerDrag } from '../../hooks/usePointerDrag';
import type { DragBindings, DragSnapshot } from '../../hooks/usePointerDrag';
import { noteChanged, noteRemoved } from '../../state/notes/actions';
import type { NotesAction } from '../../state/notes/actions';
import type { TrashState } from '../TrashZone/TrashZone';

interface NoteGesturesOptions {
  readonly note: Note;
  readonly bounds: Size;
  readonly trash: Rect;
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
  | { readonly kind: 'moving'; readonly rect: Rect; readonly overTrash: boolean }
  | { readonly kind: 'resizing'; readonly rect: Rect };

/**
 * What has to reach the trash zone to delete the note. `note`: any part of it.
 * `pointer`: the pointer itself, for a note picked up while lying on the zone.
 * `none`: the note was grabbed on the zone, so this drag cannot delete it.
 */
type TrashTrigger = 'note' | 'pointer' | 'none';

interface MoveContext {
  readonly start: Rect;
  /** Where the pointer holds the note, measured from the note's top-left corner. */
  readonly grip: Point;
  readonly trashTrigger: TrashTrigger;
}

interface ResizeContext {
  readonly start: Rect;
  readonly handle: ResizeHandle;
}

/** Moving and resizing a note. The geometry stays in local state until release. */
export function useNoteGestures({
  note,
  bounds,
  trash,
  dispatch,
  onTrashStateChange,
}: NoteGesturesOptions): NoteGestures {
  const [gesture, setGesture] = useState<Gesture | null>(null);

  // After the window shrinks, a stored position can lie off the board. It is corrected for
  // display only, and stored once the user actually moves or resizes the note.
  const settled: Rect = { ...fitPosition(note, bounds), width: note.width, height: note.height };

  const moveOutcome = ({ start, grip, trashTrigger }: MoveContext, { delta }: DragSnapshot) => {
    const followed = translate(start, delta);
    const rect: Rect = { ...followed, ...fitPosition(followed, bounds) };
    const pointer = { x: start.x + delta.x + grip.x, y: start.y + delta.y + grip.y };
    const overTrash =
      (trashTrigger === 'note' && rectsIntersect(rect, trash)) ||
      (trashTrigger === 'pointer' && containsPoint(trash, pointer));
    return { rect, overTrash };
  };

  const moveBindings = usePointerDrag<MoveContext>({
    onStart(event) {
      const strip = event.currentTarget.getBoundingClientRect();
      const grip = { x: event.clientX - strip.left, y: event.clientY - strip.top };
      const pointer = { x: settled.x + grip.x, y: settled.y + grip.y };
      const trashTrigger: TrashTrigger = !rectsIntersect(settled, trash)
        ? 'note'
        : containsPoint(trash, pointer)
          ? 'none'
          : 'pointer';

      setGesture({ kind: 'moving', rect: settled, overTrash: false });
      if (trashTrigger !== 'none') onTrashStateChange('ready');
      return { start: settled, grip, trashTrigger };
    },

    onMove(context, drag) {
      const { rect, overTrash } = moveOutcome(context, drag);
      setGesture({ kind: 'moving', rect, overTrash });
      if (context.trashTrigger !== 'none') onTrashStateChange(overTrash ? 'hover' : 'ready');
    },

    onEnd(context, drag) {
      setGesture(null);
      onTrashStateChange('idle');

      const { rect, overTrash } = moveOutcome(context, drag);
      if (overTrash) {
        dispatch(noteRemoved(note.id));
      } else if (rect.x !== context.start.x || rect.y !== context.start.y) {
        dispatch(noteChanged(note.id, { x: rect.x, y: rect.y }));
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

      setGesture({ kind: 'resizing', rect: settled });
      return { start: settled, handle };
    },

    onMove({ start, handle }, drag) {
      const rect = resizeRect(start, handle, drag.delta, bounds, MIN_NOTE_SIZE);
      setGesture({ kind: 'resizing', rect });
    },

    onEnd({ start, handle }, drag) {
      setGesture(null);

      const rect = resizeRect(start, handle, drag.delta, bounds, MIN_NOTE_SIZE);
      if (!rectsEqual(rect, start)) {
        dispatch(noteChanged(note.id, rect));
      }
    },

    onCancel() {
      setGesture(null);
    },
  });

  return {
    rect: gesture?.rect ?? settled,
    phase: gesture?.kind ?? 'idle',
    overTrash: gesture?.kind === 'moving' && gesture.overTrash,
    moveBindings,
    resizeBindings,
  };
}
