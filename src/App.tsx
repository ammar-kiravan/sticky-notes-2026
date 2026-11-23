import { useRef, useState } from "react";
import { Board } from "./components/Board/Board";
import { NoteForm } from "./components/NoteForm/NoteForm";
import { TopBar } from "./components/TopBar/TopBar";
import { UndoToast } from "./components/UndoToast/UndoToast";
import { DEFAULT_NOTE_COLOR, DEFAULT_NOTE_SIZE } from "./domain/note";
import type { NoteColor, NoteId } from "./domain/note";
import { useElementSize } from "./hooks/useElementSize";
import {
  noteAdded,
  noteChanged,
  removalUndone,
  undoDismissed,
} from "./state/notes/actions";
import { useNotes } from "./state/notes/useNotes";
import type { NotesSync } from "./sync/notesSync";
import { fitPosition } from "./utils/geometry";
import type { Rect } from "./utils/geometry";
import { createId } from "./utils/id";
import "./App.css";

interface AppProps {
  readonly sync: NotesSync;
}

const NEW_NOTE_RECT: Rect = { x: 40, y: 40, ...DEFAULT_NOTE_SIZE };

export function App({ sync }: AppProps) {
  const { loadStatus, syncStatus, notes, lastRemoved, dispatch, retryLoad } =
    useNotes(sync);
  const [newNoteColor, setNewNoteColor] =
    useState<NoteColor>(DEFAULT_NOTE_COLOR);
  const [selectedNoteId, setSelectedNoteId] = useState<NoteId | null>(null);
  const selectedNote = notes.find((note) => note.id === selectedNoteId) ?? null;

  // Measured here rather than in the board, because the form in the top bar needs it too.
  const mainRef = useRef<HTMLElement>(null);
  const mainSize = useElementSize(mainRef);
  const boardSize = loadStatus === "ready" ? mainSize : null;

  const createNote = (rect: Rect) => {
    const id = createId();
    dispatch(noteAdded(id, rect, newNoteColor));
    setSelectedNoteId(id);
  };

  return (
    <div className="app">
      <TopBar
        syncStatus={loadStatus === "ready" ? syncStatus : null}
        onRetrySync={sync.retry}
      >
        {boardSize &&
          (selectedNote ? (
            <>
              <NoteForm
                key={selectedNote.id}
                label="Selected note"
                bounds={boardSize}
                // Where the note is shown, which differs from where it is stored after the window shrinks.
                initialRect={{
                  ...fitPosition(selectedNote, boardSize),
                  width: selectedNote.width,
                  height: selectedNote.height,
                }}
                color={selectedNote.color}
                submitLabel="Apply"
                onColorChange={(color) =>
                  dispatch(noteChanged(selectedNote.id, { color }))
                }
                onSubmit={(rect) =>
                  dispatch(noteChanged(selectedNote.id, rect))
                }
              />
              <button
                type="button"
                className="button"
                onClick={() => setSelectedNoteId(null)}
              >
                New note
              </button>
            </>
          ) : (
            <NoteForm
              key="new"
              label="New note"
              bounds={boardSize}
              initialRect={NEW_NOTE_RECT}
              color={newNoteColor}
              submitLabel="Add note"
              onColorChange={setNewNoteColor}
              onSubmit={createNote}
            />
          ))}
      </TopBar>
      <main ref={mainRef} className="app__main">
        {boardSize && (
          <Board
            notes={notes}
            bounds={boardSize}
            newNoteColor={newNoteColor}
            selectedNoteId={selectedNoteId}
            dispatch={dispatch}
            onCreateNote={createNote}
            onSelectNote={setSelectedNoteId}
          />
        )}
        {loadStatus === "loading" && (
          <p className="app__message">Loading your notes…</p>
        )}
        {loadStatus === "failed" && (
          <div className="app__message" role="alert">
            <p>Your notes couldn’t be loaded.</p>
            <button type="button" className="button" onClick={retryLoad}>
              Try again
            </button>
          </div>
        )}
        {lastRemoved && (
          <UndoToast
            key={lastRemoved.id}
            onUndo={() => dispatch(removalUndone())}
            onDismiss={() => dispatch(undoDismissed())}
          />
        )}
      </main>
    </div>
  );
}
