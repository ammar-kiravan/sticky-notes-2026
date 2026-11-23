import type { ReactNode } from "react";
import type { SyncStatus } from "../../sync/notesSync";
import "./TopBar.css";

interface TopBarProps {
  /** `null` until the notes have loaded. */
  readonly syncStatus: SyncStatus | null;
  readonly onRetrySync: () => void;
  readonly children?: ReactNode;
}

export function TopBar({ syncStatus, onRetrySync, children }: TopBarProps) {
  return (
    <header className="top-bar">
      <h1 className="top-bar__title">Sticky notes</h1>
      {children}
      {/* Not a live region as a whole: the routine states change with every edit. */}
      <div className="top-bar__sync" data-status={syncStatus}>
        {syncStatus === "saved" && "All changes saved"}
        {syncStatus === "saving" && "Saving…"}
        {syncStatus === "failed" && (
          <>
            <span role="alert">Not saved</span>
            <button type="button" className="button" onClick={onRetrySync}>
              Try again
            </button>
          </>
        )}
      </div>
    </header>
  );
}
