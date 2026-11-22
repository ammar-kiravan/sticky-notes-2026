import { useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { fitPosition, rectFromDrag } from '../domain/geometry';
import type { Point, Rect, Size } from '../domain/geometry';
import { DEFAULT_NOTE_SIZE, MIN_NOTE_SIZE } from '../domain/note';
import type { NoteColor } from '../domain/note';
import { usePointerDrag } from '../hooks/usePointerDrag';
import './NoteCreator.css';

interface NoteCreatorProps {
  readonly bounds: Size;
  readonly color: NoteColor;
  readonly onCreate: (rect: Rect) => void;
}

interface DrawContext {
  /** Where the drag started, in board coordinates. */
  readonly origin: Point;
}

/** Pointer travel below this distance counts as a click rather than as drawing. */
const DRAW_THRESHOLD_PX = 4;

/**
 * The empty surface of the board. Dragging on it draws a new note, which sets
 * its position and size in one gesture; double-clicking drops in a note of the
 * default size.
 */
export function NoteCreator({ bounds, color, onCreate }: NoteCreatorProps) {
  const [preview, setPreview] = useState<Rect | null>(null);
  /**
   * How many presses in a row ended as plain clicks. The browser reports a
   * double-click even when one of its two presses drew a note or was cancelled,
   * and such a double-click must not add a second note.
   */
  const plainClicksRef = useRef(0);

  const drawnRect = (origin: Point, delta: Point): Rect | null => {
    if (Math.hypot(delta.x, delta.y) < DRAW_THRESHOLD_PX) return null;
    const pointer = { x: origin.x + delta.x, y: origin.y + delta.y };
    return rectFromDrag(origin, pointer, bounds, MIN_NOTE_SIZE);
  };

  const drawBindings = usePointerDrag<DrawContext>({
    onStart: (event) => ({ origin: toLocalPoint(event) }),
    onMove: ({ origin }, drag) => setPreview(drawnRect(origin, drag.delta)),
    onEnd: ({ origin }, drag) => {
      setPreview(null);
      const rect = drawnRect(origin, drag.delta);
      if (rect) {
        plainClicksRef.current = 0;
        onCreate(rect);
      } else {
        plainClicksRef.current += 1;
      }
    },
    onCancel: () => {
      plainClicksRef.current = 0;
      setPreview(null);
    },
  });

  const createAtPointer = (event: MouseEvent<HTMLElement>) => {
    if (plainClicksRef.current < 2) return;
    plainClicksRef.current = 0;

    const pointer = toLocalPoint(event);
    const centered = {
      x: Math.round(pointer.x - DEFAULT_NOTE_SIZE.width / 2),
      y: Math.round(pointer.y - DEFAULT_NOTE_SIZE.height / 2),
      ...DEFAULT_NOTE_SIZE,
    };
    onCreate({ ...centered, ...fitPosition(centered, bounds) });
  };

  return (
    <div className="note-creator" {...drawBindings} onDoubleClick={createAtPointer}>
      {preview && (
        <div
          className="note-creator__preview"
          data-color={color}
          style={{
            transform: `translate(${preview.x}px, ${preview.y}px)`,
            width: preview.width,
            height: preview.height,
          }}
        >
          <span className="note-creator__size">
            {preview.width} × {preview.height}
          </span>
        </div>
      )}
    </div>
  );
}

function toLocalPoint(event: MouseEvent<HTMLElement>): Point {
  const box = event.currentTarget.getBoundingClientRect();
  return { x: event.clientX - box.left, y: event.clientY - box.top };
}
