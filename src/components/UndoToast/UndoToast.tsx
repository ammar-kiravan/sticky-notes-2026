import { useEffect, useEffectEvent } from "react";
import "./UndoToast.css";

interface UndoToastProps {
  readonly onUndo: () => void;
  readonly onDismiss: () => void;
}

const UNDO_WINDOW_MS = 7000;

export function UndoToast({ onUndo, onDismiss }: UndoToastProps) {
  const dismiss = useEffectEvent(onDismiss);
  useEffect(() => {
    const timer = window.setTimeout(dismiss, UNDO_WINDOW_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="undo-toast" role="status">
      Note deleted
      <button type="button" className="button" onClick={onUndo}>
        Undo
      </button>
    </div>
  );
}
