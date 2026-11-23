import { useState } from "react";
import type { PointerEvent } from "react";
import { rectFromDrag } from "../../utils/geometry";
import type { Point, Rect, Size } from "../../utils/geometry";
import { MIN_NOTE_SIZE } from "../../domain/note";
import type { NoteColor } from "../../domain/note";
import { usePointerDrag } from "../../hooks/usePointerDrag";
import "./NoteCreator.css";

interface NoteCreatorProps {
  readonly bounds: Size;
  readonly color: NoteColor;
  readonly onPress: () => void;
  readonly onCreate: (rect: Rect) => void;
}

/** Pointer travel below this distance is a click, which creates nothing. */
const DRAW_THRESHOLD_PX = 4;

/** The empty surface of the board, on which a drag draws a new note. */
export function NoteCreator({
  bounds,
  color,
  onPress,
  onCreate,
}: NoteCreatorProps) {
  const [preview, setPreview] = useState<Rect | null>(null);

  const drawnRect = (origin: Point, delta: Point): Rect | null => {
    if (Math.hypot(delta.x, delta.y) < DRAW_THRESHOLD_PX) return null;
    const pointer = { x: origin.x + delta.x, y: origin.y + delta.y };
    return rectFromDrag(origin, pointer, bounds, MIN_NOTE_SIZE);
  };

  // The context of the drag is its origin, in board coordinates.
  const drawBindings = usePointerDrag<Point>({
    onStart: (event) => {
      onPress();
      return toLocalPoint(event);
    },
    onMove: (origin, drag) => setPreview(drawnRect(origin, drag.delta)),
    onEnd: (origin, drag) => {
      setPreview(null);
      const rect = drawnRect(origin, drag.delta);
      if (rect) onCreate(rect);
    },
    onCancel: () => setPreview(null),
  });

  return (
    <div className="note-creator" {...drawBindings}>
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

function toLocalPoint(event: PointerEvent<HTMLElement>): Point {
  const box = event.currentTarget.getBoundingClientRect();
  return { x: event.clientX - box.left, y: event.clientY - box.top };
}
