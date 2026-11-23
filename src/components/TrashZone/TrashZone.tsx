import type { Rect } from '../../utils/geometry';
import './TrashZone.css';

/** `ready` while a note is being dragged, `hover` while releasing it would delete it. */
export type TrashState = 'idle' | 'ready' | 'hover';

interface TrashZoneProps {
  readonly rect: Rect;
  readonly state: TrashState;
}

const MESSAGES: Readonly<Record<TrashState, string>> = {
  idle: 'Drag a note here to delete it',
  ready: 'Drop here to delete',
  hover: 'Release to delete',
};

export function TrashZone({ rect, state }: TrashZoneProps) {
  return (
    <div
      className="trash-zone"
      data-state={state}
      style={{
        transform: `translate(${rect.x}px, ${rect.y}px)`,
        width: rect.width,
        height: rect.height,
      }}
    >
      <svg className="trash-zone__icon" viewBox="0 0 24 24" aria-hidden="true">
        <g className="trash-zone__lid">
          <path d="M4 7h16" />
          <path d="M9.5 7V4.5h5V7" />
        </g>
        <path d="M6.5 7l.9 12.5h9.2L17.5 7" />
        <path d="M10 11v5.5M14 11v5.5" />
      </svg>
      <span>{MESSAGES[state]}</span>
    </div>
  );
}
