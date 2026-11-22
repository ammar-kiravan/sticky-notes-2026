import { useCallback, useState } from 'react';
import { Board } from './components/Board';
import { TopBar } from './components/TopBar';
import { UndoToast } from './components/UndoToast';
import { DEFAULT_NOTE_COLOR } from './domain/note';
import type { NoteColor } from './domain/note';
import { useNotes } from './state/useNotes';
import type { NotesSync } from './sync/notesSync';
import './App.css';

interface AppProps {
  readonly sync: NotesSync;
}

export function App({ sync }: AppProps) {
  const { loadStatus, syncStatus, notes, lastRemoved, dispatch, retryLoad } = useNotes(sync);
  const [newNoteColor, setNewNoteColor] = useState<NoteColor>(DEFAULT_NOTE_COLOR);

  const undoRemoval = useCallback(() => dispatch({ type: 'removalUndone' }), [dispatch]);
  const dismissUndo = useCallback(() => dispatch({ type: 'undoDismissed' }), [dispatch]);

  return (
    <div className="app">
      <TopBar
        newNoteColor={newNoteColor}
        onNewNoteColorChange={setNewNoteColor}
        syncStatus={loadStatus === 'ready' ? syncStatus : null}
        onRetrySync={sync.retry}
      />
      <main className="app__main">
        {loadStatus === 'ready' && (
          <Board notes={notes} newNoteColor={newNoteColor} dispatch={dispatch} />
        )}
        {loadStatus === 'loading' && <p className="app__message">Loading your notes…</p>}
        {loadStatus === 'failed' && (
          <div className="app__message" role="alert">
            <p>Your notes couldn’t be loaded.</p>
            <button type="button" className="button" onClick={retryLoad}>
              Try again
            </button>
          </div>
        )}
        {/* Keyed by note so that deleting another one restarts the toast's countdown. */}
        {lastRemoved && (
          <UndoToast key={lastRemoved.id} onUndo={undoRemoval} onDismiss={dismissUndo} />
        )}
      </main>
    </div>
  );
}
