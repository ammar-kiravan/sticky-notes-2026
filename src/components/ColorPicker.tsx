import { useId } from 'react';
import { NOTE_COLORS } from '../domain/note';
import type { NoteColor } from '../domain/note';
import { classNames } from '../utils/classNames';
import './ColorPicker.css';

interface ColorPickerProps {
  /** Describes what the choice applies to; announced by screen readers. */
  readonly label: string;
  readonly value: NoteColor;
  readonly onChange: (color: NoteColor) => void;
  readonly className?: string;
}

const COLOR_NAMES: Readonly<Record<NoteColor, string>> = {
  yellow: 'Yellow',
  orange: 'Orange',
  pink: 'Pink',
  purple: 'Purple',
  blue: 'Blue',
  green: 'Green',
};

/**
 * A row of swatches built on native radio buttons, which gives one tab stop
 * and arrow-key selection without any keyboard handling of our own.
 */
export function ColorPicker({ label, value, onChange, className }: ColorPickerProps) {
  const groupName = useId();

  return (
    <fieldset className={classNames('color-picker', className)}>
      <legend className="visually-hidden">{label}</legend>
      {NOTE_COLORS.map((color) => (
        <label key={color} className="color-picker__option" title={COLOR_NAMES[color]}>
          <input
            className="color-picker__input visually-hidden"
            type="radio"
            name={groupName}
            checked={color === value}
            onChange={() => onChange(color)}
          />
          <span className="color-picker__swatch" data-color={color} />
          <span className="visually-hidden">{COLOR_NAMES[color]}</span>
        </label>
      ))}
    </fieldset>
  );
}
