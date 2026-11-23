# Sticky notes

A single-page sticky-notes board built with TypeScript and React, without UI kits, drag-and-drop
libraries or state-management libraries. You can create, move, resize and delete notes, and also
write on them, bring them to the front, recolor them and keep them across reloads through a mocked
REST API.

## Running it

Requires Node.js 22.12 or newer.

```sh
npm install
npm run dev     # http://localhost:5173
npm test        # unit tests
```

Open <http://localhost:5173/?flaky> to make a third of the API requests fail and see the error
handling.

## How to use it

- **Create:** drag on an empty part of the board to draw a note, or type a size and position into
  the top bar and press **Add note**.
- **Move:** drag a note by its top strip.
- **Resize:** drag any edge or corner.
- **Delete:** drag a note onto the trash zone at the bottom. It can be undone for seven seconds.
- **Bring to front:** press on a note or focus it with the keyboard.
- **Recolor:** use the swatches in the top bar or along the bottom of a note.

Escape cancels any drag in progress.

## Project structure

```text
src/
├── main.tsx              Entry point: creates the mock API and the sync engine, renders <App>
├── App.tsx               Owns state shared by the top bar and the board
├── api/
│   ├── notesApi.ts       The NotesApi interface (list, save, remove)
│   ├── mockNotesApi.ts   In-browser implementation backed by localStorage
│   └── parseNotes.ts     Validates untrusted stored data
├── domain/
│   └── note.ts           The Note type, colors, size limits
├── state/notes/
│   ├── actions.ts        Action types and action creators
│   ├── reducer.ts        The single source of truth for the notes
│   └── useNotes.ts       Connects the reducer to the sync engine
├── sync/
│   ├── diffNotes.ts      Computes the requests that bring the server up to date
│   └── notesSync.ts      Debounced, batched, retry-safe syncing
├── hooks/
│   ├── usePointerDrag.ts The drag primitive behind every gesture
│   └── useElementSize.ts Tracks the board size with a ResizeObserver
├── utils/
│   ├── geometry.ts       Pure rectangle math: fitting, resizing, drawing
│   └── id.ts             Client-side id generation
└── components/           One folder per component, with its styles
    ├── Board/            The board surface: notes, creator and trash zone
    ├── NoteView/         One note, plus useNoteGestures for moving and resizing
    ├── NoteCreator/      Turns a drag on the empty board into a note
    ├── NoteForm/         Size, position and color fields in the top bar
    ├── TopBar/           Title, form and save status
    ├── TrashZone/        The drop target for deleting notes
    ├── ColorPicker/      Accessible radio-button swatches
    └── UndoToast/        The undo prompt after a deletion
```

## Layers

The layers depend on each other in one direction only, from the bottom up:

1. **`utils`** holds generic helpers. All the rules about positions and sizes live in
   `geometry.ts` as pure functions, so they are unit-tested without a browser.
2. **`domain`** holds the `Note` type and its constraints.
3. **`api` and `sync`** handle persistence. The engine knows nothing about React, and `main.tsx` is
   the only file that knows the API is a mock, so a real backend can be swapped in there.
4. **`state/notes`** holds a reducer that is the single source of truth. Components never mutate
   notes; they dispatch actions such as `noteAdded(id, rect, color)` or `noteRaised(id)`.
5. **`components`** are thin views on top. `App` owns what the top bar and the board share: the
   board size, the selection, the color for new notes and note creation.

## Approach

**One drag primitive for all gestures.** Drawing, moving and resizing are built on a single hook,
`usePointerDrag`. It listens on `window` while a drag is running, so the drag survives the pointer
leaving the element. It cancels on Escape, a context menu or the window losing focus, so a note is
never left stuck to the pointer.

**Cheap rendering.** While a gesture runs, its geometry stays in the local state of the one note
involved, and the reducer is updated once, on release. Notes are memoized and positioned with
`transform`. Stacking uses a per-note `z` value instead of the array order, so raising a note never
reorders DOM nodes.

**Sync by difference, not by action.** The API is a small REST-shaped interface (`list`, `save`,
`remove`) with a mock backed by `localStorage`. A sync engine compares the local notes with what the
server has confirmed and sends only the difference, debounced and one batch at a time. That makes
the UI optimistic, turns typing into one request, and makes retrying trivial: a failed request is
simply still part of the next difference. Ids are generated on the client, so every request is
idempotent and safe to repeat.

## Key decisions

- **The board fits the window.** Notes always stay inside it. If the window shrinks, notes are
  shown at the nearest visible position, but their stored positions are kept.
- **Deleting needs no exact aim.** Releasing a note while any part of it overlaps the trash zone
  deletes it. The zone turns red first, and every deletion can be undone.
- **Stored data is untrusted.** Notes read from storage are validated, and malformed entries are
  dropped.
- **No edit is lost on reload.** Unsaved changes are sent when the page is hidden.

## Limitations and next steps

- Only the pure logic has automated tests. The gestures were tested by hand in Chrome, Edge and
  Firefox and need browser-level tests, for example with Playwright.
- Deleting a note requires a pointer, and only the most recent deletion can be undone.
- Sync has no automatic retry with backoff, no request timeouts and no conflict handling, so two
  open tabs overwrite each other.
