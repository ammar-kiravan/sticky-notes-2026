import type { NoteColor } from '../domain/note';
import type { SyncStatus } from '../sync/notesSync';
import { ColorPicker } from './ColorPicker';
import './TopBar.css';

interface TopBarProps {
  readonly newNoteColor: NoteColor;
  readonly onNewNoteColorChange: (color: NoteColor) => void;
  /** `null` until the notes have loaded, when there is nothing to report yet. */
  readonly syncStatus: SyncStatus | null;
  readonly onRetrySync: () => void;
}

export function TopBar({
  newNoteColor,
  onNewNoteColorChange,
  syncStatus,
  onRetrySync,
}: TopBarProps) {
  return (
    <header className="top-bar">
      <h1 className="top-bar__title">Sticky notes</h1>
      <div className="top-bar__colors">
        <span aria-hidden="true">New notes</span>
        <ColorPicker
          label="Color for new notes"
          value={newNoteColor}
          onChange={onNewNoteColorChange}
        />
      </div>
      {/* Not a live region as a whole: the routine states change with every edit. */}
      <div className="top-bar__sync" data-status={syncStatus}>
        {syncStatus === 'saved' && 'All changes saved'}
        {syncStatus === 'saving' && 'Saving…'}
        {syncStatus === 'failed' && (
          <>
            <span role="alert">Your latest changes aren’t saved yet.</span>
            <button type="button" className="button" onClick={onRetrySync}>
              Try again
            </button>
          </>
        )}
      </div>
    </header>
  );
}
