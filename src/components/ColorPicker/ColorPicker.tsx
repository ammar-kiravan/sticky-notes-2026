import classNames from 'classnames';
import { useId } from 'react';
import { NOTE_COLORS } from '../../domain/note';
import type { NoteColor } from '../../domain/note';
import './ColorPicker.css';

interface ColorPickerProps {
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

/** Native radio buttons, for one tab stop and arrow-key selection without extra code. */
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
