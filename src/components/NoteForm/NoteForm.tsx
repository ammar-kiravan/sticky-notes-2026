import { useState } from "react";
import type { FormEvent } from "react";
import { MIN_NOTE_SIZE } from "../../domain/note";
import type { NoteColor } from "../../domain/note";
import { rectsEqual } from "../../utils/geometry";
import type { Rect, Size } from "../../utils/geometry";
import { ColorPicker } from "../ColorPicker/ColorPicker";
import "./NoteForm.css";

interface NoteFormProps {
  readonly label: string;
  readonly bounds: Size;
  readonly initialRect: Rect;
  readonly color: NoteColor;
  readonly submitLabel: string;
  readonly onColorChange: (color: NoteColor) => void;
  readonly onSubmit: (rect: Rect) => void;
}

/**
 * Size, position and color of a note as typed values. Each field carries its
 * limits, so the browser's own validation refuses a note that would not fit.
 */
export function NoteForm({
  label,
  bounds,
  initialRect,
  color,
  submitLabel,
  onColorChange,
  onSubmit,
}: NoteFormProps) {
  // Strings, so that a field can be emptied while typing.
  const [width, setWidth] = useState(String(initialRect.width));
  const [height, setHeight] = useState(String(initialRect.height));
  const [x, setX] = useState(String(initialRect.x));
  const [y, setY] = useState(String(initialRect.y));

  // When the note is moved, resized or edited here, the fields show its new geometry.
  const [shownRect, setShownRect] = useState(initialRect);
  if (!rectsEqual(initialRect, shownRect)) {
    setShownRect(initialRect);
    setWidth(String(initialRect.width));
    setHeight(String(initialRect.height));
    setX(String(initialRect.x));
    setY(String(initialRect.y));
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit({
      x: Number(x),
      y: Number(y),
      width: Number(width),
      height: Number(height),
    });
  };

  return (
    <form className="note-form" aria-label={label} onSubmit={submit}>
      <NumberField
        shortLabel="W"
        label="Width"
        value={width}
        min={MIN_NOTE_SIZE.width}
        max={bounds.width}
        onChange={setWidth}
      />
      <NumberField
        shortLabel="H"
        label="Height"
        value={height}
        min={MIN_NOTE_SIZE.height}
        max={bounds.height}
        onChange={setHeight}
      />
      <NumberField
        shortLabel="X"
        label="Distance from the left edge"
        value={x}
        min={0}
        max={bounds.width - (Number(width) || MIN_NOTE_SIZE.width)}
        onChange={setX}
      />
      <NumberField
        shortLabel="Y"
        label="Distance from the top edge"
        value={y}
        min={0}
        max={bounds.height - (Number(height) || MIN_NOTE_SIZE.height)}
        onChange={setY}
      />
      <ColorPicker
        label={`${label} color`}
        value={color}
        onChange={onColorChange}
      />
      <button type="submit" className="button">
        {submitLabel}
      </button>
    </form>
  );
}

interface NumberFieldProps {
  readonly shortLabel: string;
  readonly label: string;
  readonly value: string;
  readonly min: number;
  readonly max: number;
  readonly onChange: (value: string) => void;
}

function NumberField({
  shortLabel,
  label,
  value,
  min,
  max,
  onChange,
}: NumberFieldProps) {
  return (
    <label className="note-form__field" title={`${label}, in pixels`}>
      <span aria-hidden="true">{shortLabel}</span>
      <input
        className="note-form__input"
        type="number"
        required
        step={1}
        min={min}
        // Keeps X and Y valid while W or H is too large, so only that field is flagged.
        max={Math.max(min, max)}
        value={value}
        aria-label={label}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
