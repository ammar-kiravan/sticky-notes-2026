import { useCallback, useEffect, useReducer, useState, useSyncExternalStore } from 'react';
import type { Dispatch } from 'react';
import type { Note } from '../domain/note';
import type { NotesSync, SyncStatus } from '../sync/notesSync';
import { initialNotesState, notesReducer } from './notesReducer';
import type { NotesAction } from './notesReducer';

export type LoadStatus = 'loading' | 'ready' | 'failed';

export interface NotesStore {
  readonly loadStatus: LoadStatus;
  readonly syncStatus: SyncStatus;
  readonly notes: readonly Note[];
  readonly lastRemoved: Note | null;
  readonly dispatch: Dispatch<NotesAction>;
  readonly retryLoad: () => void;
}

/**
 * Owns the notes for the lifetime of the app: loads them once, exposes the
 * reducer, and hands every new state to the sync engine. The UI stays
 * optimistic, in that it never waits for the server before showing a change.
 */
export function useNotes(sync: NotesSync): NotesStore {
  const [state, dispatch] = useReducer(notesReducer, initialNotesState);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('loading');
  const syncStatus = useSyncExternalStore(sync.subscribe, sync.getStatus);

  // Runs whenever the app enters the loading state: on start and on every retry.
  useEffect(() => {
    if (loadStatus !== 'loading') return;

    let cancelled = false;
    sync.load().then(
      (notes) => {
        if (cancelled) return;
        dispatch({ type: 'notesLoaded', notes });
        setLoadStatus('ready');
      },
      () => {
        if (!cancelled) setLoadStatus('failed');
      },
    );
    return () => {
      cancelled = true;
    };
  }, [sync, loadStatus]);

  useEffect(() => {
    if (loadStatus === 'ready') sync.update(state.notes);
  }, [sync, loadStatus, state.notes]);

  useEffect(() => {
    const flush = () => sync.flushBeforeExit();
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, [sync]);

  const retryLoad = useCallback(() => setLoadStatus('loading'), []);

  return {
    loadStatus,
    syncStatus,
    notes: state.notes,
    lastRemoved: state.lastRemoved,
    dispatch,
    retryLoad,
  };
}
