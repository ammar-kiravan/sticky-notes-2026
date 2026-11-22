import { useEffect } from 'react';
import './UndoToast.css';

interface UndoToastProps {
  readonly onUndo: () => void;
  /** Must keep its identity between renders, or the countdown restarts. */
  readonly onDismiss: () => void;
}

const UNDO_WINDOW_MS = 7000;

/** Offers to bring back the note that was just deleted, then goes away by itself. */
export function UndoToast({ onUndo, onDismiss }: UndoToastProps) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, UNDO_WINDOW_MS);
    return () => window.clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className="undo-toast" role="status">
      Note deleted
      <button type="button" className="button" onClick={onUndo}>
        Undo
      </button>
    </div>
  );
}
