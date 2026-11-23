# Sticky notes

A single-page sticky-notes board built with TypeScript and React. Draw notes on a board, write on
them, move, resize, recolor and stack them, and drag them to the trash. Every change is saved
through an asynchronous, REST-shaped API and restored on reload.

No UI kit, drag-and-drop library or state-management library is used. The only runtime
dependencies are React, `classnames` and a self-hosted font (Shantell Sans).

- [Getting started](#getting-started)
- [Features](#features)
- [Project structure](#project-structure)
- [Architecture](#architecture)
- [Design decisions](#design-decisions)
- [Testing](#testing)
- [Known limitations and next steps](#known-limitations-and-next-steps)

## Getting started

**Requirements:** Node.js 22.12 or newer (required by Vite 8 and Vitest 5).

```sh
npm install
npm run dev
```

Then open <http://localhost:5173>.

| Script              | What it does                                     |
| ------------------- | ------------------------------------------------ |
| `npm run dev`       | Starts the development server                    |
| `npm run build`     | Type-checks and builds for production to `dist/` |
| `npm run preview`   | Serves the production build locally              |
| `npm test`          | Runs the unit tests once with Vitest             |
| `npm run typecheck` | Runs the TypeScript compiler without emitting    |
| `npm run lint`      | Lints with oxlint                                |
| `npm run format`    | Formats the code with Prettier                   |

### Simulating a flaky network

Open <http://localhost:5173/?flaky> to make a third of the mocked API requests fail. This is the
quickest way to see the error handling: a failed load offers to try again, and a failed save keeps
your changes on screen and offers to send them again.

## Features

### Creating a note

- **Draw it:** drag on an empty part of the board. The rectangle you draw becomes the note, and a
  live preview shows its size in pixels. The board has a grid line every 20 px and a heavier one
  every 100 px to help with sizing.
- **Type it:** enter a width, height, X and Y in the top bar and press **Add note**. The note gets
  exactly that size, with its top-left corner at that position. If a note is selected, press
  **New note** first.

A new note gets keyboard focus straight away, so you can start typing.

### Moving

Drag a note by the strip along its top edge. A note stops at the edges of the board and cannot be
dragged off it. To move it precisely, select the note, type X and Y in the top bar and press Enter
or **Apply**.

### Resizing

Drag any edge or corner of a note, or select it and type W and H in the top bar. Notes cannot be
smaller than 160 × 120 px or larger than the board.

### Deleting

Drag a note onto the trash zone at the bottom of the board and release it. Both the zone and the
note change their appearance when releasing would delete, and an **Undo** button is shown for seven
seconds afterwards.

### Text, stacking and colors

- **Text:** click into a note and type.
- **Bring to front:** pressing on a note, or moving keyboard focus into it, raises it above the
  others.
- **Colors:** the swatches in the top bar recolor the selected note, or set the color for new notes
  when nothing is selected. Each note also has its own swatches along its bottom edge, shown while
  the note is hovered or focused.

### Saving

Every change is saved through an asynchronous API. The top bar shows whether all changes are saved,
a save is in progress, or a save failed (with a **Try again** button). The API is mocked in the
browser and stores its data in `localStorage`, so your notes survive a reload.

Press **Escape** at any time to cancel the drag in progress.

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

## Architecture

### Layers

The code is split into layers that depend on each other in one direction only:

1. **`utils`** holds generic helpers. All the rules about positions and sizes live in
   `geometry.ts` as pure functions, so they are unit-tested without a browser.
2. **`domain`** holds the `Note` type and its constraints.
3. **`state/notes`** holds a reducer that is the single source of truth. Components never mutate
   notes; they dispatch actions such as `noteAdded(id, rect, color)` or `noteRaised(id)`.
4. **`components`** are thin views on top. `App` owns what the top bar and the board share: the
   board size, the selection, the color for new notes and note creation.

### Gestures and performance

Drawing, moving and resizing are all built on one hook, `usePointerDrag`. When a gesture starts, it
adds `pointermove`, `pointerup` and `pointercancel` listeners to `window`, so the drag keeps
following the pointer wherever it goes. It also cancels the drag on Escape, on a context menu or
when the window loses focus, because any of those can swallow the `pointerup` and leave a note
stuck to the pointer. Pointer capture is requested as well, so other elements show no hover effects
during a drag, but nothing depends on it: Chrome on a macOS trackpad can drop capture in the middle
of a drag.

Rendering is kept cheap in four ways:

- While a gesture is running, its geometry lives in the local state of the one component involved,
  so each pointer move re-renders exactly one note. The reducer is told the result once, on
  release.
- `NoteView` is memoized, and the reducer keeps untouched notes identical, so committing a change
  re-renders only the note that changed.
- Notes are positioned with `transform`, which keeps moving them out of layout.
- Stacking order is a per-note `z` counter rather than the order of the array, so raising a note
  changes one `z-index` and never reorders DOM nodes, which would drop focus and pointer capture.

### Persistence and sync

Persistence sits behind a small `NotesApi` interface shaped like a REST resource:

| Method       | REST equivalent     | Behavior                                       |
| ------------ | ------------------- | ---------------------------------------------- |
| `list()`     | `GET /notes`        | Returns all notes                              |
| `save(note)` | `PUT /notes/:id`    | Creates or replaces a note                     |
| `remove(id)` | `DELETE /notes/:id` | Deletes a note; succeeds if it is already gone |

Between the reducer and the API sits a sync engine (`sync/notesSync.ts`). Instead of turning each
action into a request, it compares the current notes with what the server has confirmed (using the
pure function `diffNotes`) and sends only the difference, after a short debounce and one batch at a
time. This means:

- The UI is optimistic by design: changes appear immediately.
- A burst of changes, such as typing, becomes one request.
- Changes that cancel out before they are sent, such as delete then undo, send nothing.
- Retrying needs no special handling: a failed request is still part of the next difference.

The sync engine knows nothing about React. `useNotes` connects the two, and `main.tsx` is the only
file that knows the API is a mock, so a real backend can be swapped in there.

## Design decisions

**Two ways to create a note.** The requirement to create a note of a given size at a given position
is met literally by the form in the top bar. A request that would not fit on the board is refused
with the browser's built-in validation message instead of being adjusted silently. Drawing the note
is the faster alternative with a mouse.

**The board fits the window.** It does not scroll or zoom, and notes always stay fully inside it,
including while they are dragged. If the window shrinks, an out-of-bounds note is shown at the
nearest visible position, but its stored position is kept until the user moves or resizes it, so
enlarging the window again restores the layout.

**When a drop deletes.** A note is deleted when it is released while any part of it overlaps the
trash zone. The pointer itself does not have to reach the zone, because a note is held by its top
edge and covers the zone well before the pointer gets there. A note that already overlaps the zone
when picked up is the exception, since the smallest move would delete it: for that note the pointer
must be brought onto the zone, and if the note was grabbed at a point on the zone, that drag cannot
delete it at all. Because there is no confirmation step, the zone turns red before anything
happens, Escape cancels the drag, and the deletion can be undone.

**Ids are generated in the browser.** This makes saving an idempotent `PUT /notes/:id`, which is
what makes retries safe, at the cost of sending the whole note instead of a patch.

**One source of truth for saved data.** The mock server stores its data in `localStorage`, so there
is no separate local cache that could disagree with the server. Data read from storage is validated
by `parseNotes`, and malformed entries are dropped.

**No edit is lost on reload.** The mock applies a request as soon as it is sent and delays only the
response. The app also flushes unsaved changes on `pagehide`, taking requests still in flight into
account. A real client would get the same guarantee from `fetch` with `keepalive: true`.

## Testing

```sh
npm test
```

The unit tests cover the pure logic: geometry, the reducer, parsing stored data, the mock API, the
diffing and the sync engine (debouncing, batching, failures, retries and the flush on exit). The
gestures have been checked by hand in current Chrome, Edge and Firefox on macOS, but are not covered
by automated tests.

## Known limitations and next steps

- **Gesture tests.** The drag interactions need browser-level tests, for example with Playwright.
- **Keyboard support.** Creating, typing, recoloring, moving and resizing work from the keyboard
  through the top bar, but deleting still requires a pointer.
- **Undo.** Only the most recent deletion can be undone; deleting a second note within seven
  seconds makes the first deletion permanent.
- **Sync robustness.** The engine retries only when asked or when the next change arrives. A
  production version would retry automatically with backoff, time out requests and version the
  notes, so that a late response cannot overwrite newer data.
- **Multiple tabs.** Two tabs open on the same board overwrite each other note by note instead of
  merging.
- **Large boards.** Every note is always in the DOM. That is fine for hundreds of notes, but a board
  with thousands would need to skip rendering notes that are off screen.
