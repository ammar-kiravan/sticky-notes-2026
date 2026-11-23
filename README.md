# Sticky notes

A single-page sticky-notes board written in TypeScript and React. There are no UI kits,
drag-and-drop libraries or state-management libraries involved: the only runtime dependencies are
React itself, `classnames` and a self-hosted font. All four required features are implemented,
together with the five optional ones.

## Running it

The project needs Node.js 22.12 or newer (the requirement comes from Vite 8 and Vitest 5).

```sh
npm install
npm run dev        # development server, http://localhost:5173
```

A production build is made with `npm run build` and served locally with `npm run preview`. The
remaining scripts are `npm test` for the unit tests, `npm run typecheck`, `npm run lint` and
`npm run format`.

## Using it

The board is meant to be used with a mouse, so every feature is a direct gesture. Creating a note
can also be done with typed numbers, for when the size and position have to be exact.

| Feature                    | How it works                                                                                                                                                                                                                                                                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Create at a position, size | Type a width, a height and a position into the fields in the top bar and press Add note: the note gets exactly that size, with its top-left corner at that position. (If a note is selected, press New note first.) Or drag on an empty part of the board: the rectangle you draw becomes the note, and a live preview shows its size in pixels. |
| Move                       | Drag a note by the strip along its top edge; the whole strip is a handle. A note stops at the edges of the board and cannot be dragged off it. Or select the note, type X and Y into the top bar and press Enter or Apply.                                                                                                                       |
| Resize                     | Drag any edge or corner. Or select the note, type W and H into the top bar and press Enter or Apply. Notes cannot become smaller than 160 × 120 and cannot grow past the board.                                                                                                                                                                  |
| Delete                     | Drag a note onto the trash zone at the bottom of the board and release it. The zone and the note both show when releasing will delete, and the deletion can be undone for seven seconds.                                                                                                                                                         |
| Text (bonus I)             | Click into a note and type. A new note is focused straight away.                                                                                                                                                                                                                                                                                 |
| Bring to front (bonus II)  | Pressing on a note, or moving keyboard focus into it, raises it above the others.                                                                                                                                                                                                                                                                |
| Persistence (bonus III, V) | Every change is saved through an asynchronous REST-style API. The API is mocked in the browser and keeps its data in `localStorage`, so the notes are restored on reload. The top bar shows progress.                                                                                                                                            |
| Colors (bonus IV)          | The swatches in the top bar recolor the selected note, or set the color of new notes when nothing is selected. The swatches along the bottom of a note, shown while the note is hovered or focused, recolor that note.                                                                                                                           |

Pressing Escape abandons whichever gesture is in progress. Opening the app as
`http://localhost:5173/?flaky` makes a third of the mocked requests fail, which is the quickest way
to see the error handling: a failed load offers a retry, and a failed save keeps the changes on
screen and offers to send them again.

## Architecture

The code is split into layers that depend on each other in one direction only. `utils` holds generic
helpers: id generation and the rectangle geometry as pure functions (fitting a rectangle into the
board, resizing from a handle, building a rectangle from a drag), so every rule about positions and
sizes lives in one place and is unit-tested without a browser. `domain` holds the `Note` type and
its rules. `state/notes` holds a reducer that is the single source of truth for the notes, with its
action creators next to it; components never mutate anything, they dispatch actions such as
`noteAdded(id, rect, color)` or `noteRaised(id)`. Each component has its own folder with its styles
and, for `NoteView`, the hook with its gestures. The components are thin: `NoteForm` in the top bar
edits the selected note, or the next new one when nothing is selected, `NoteCreator` turns a drag on
the empty board into a note, and `NoteView` renders one note. `App` owns what the top bar and the
board share: the size of the board, the selection, the color for new notes and the creation of
notes.

All three gestures (drawing, moving, resizing) are built on one hook, `usePointerDrag`. It uses
Pointer Events with pointer capture, so a drag keeps working when the pointer leaves the element or
the window and no document-level pointer listeners are needed; only an Escape key listener is added
for the length of a gesture. Performance was the main concern here. While a gesture is running, its
geometry lives in the local state of the one component involved, so each pointer move re-renders
exactly one note; the reducer hears about the result once, on release. `NoteView` is memoised and
the reducer preserves the identity of untouched notes, so committing a change re-renders only the
note that changed. Notes are positioned with `transform`, which keeps moving them out of layout.
Stacking order is a per-note counter rather than the order of the array, so raising a note changes
one `z-index` and never moves DOM nodes, which would drop focus and pointer capture.

Persistence sits behind a small `NotesApi` interface (`list`, `save`, `remove`) shaped like a REST
resource, with a mock implementation that answers after a delay. Between the reducer and the API is
a sync engine (`sync/notesSync.ts`) that does not mirror individual actions as requests. Instead it
compares the current notes with what the server has acknowledged, using the pure function
`diffNotes`, and sends the difference, after a short debounce and one batch at a time. That makes
the UI optimistic by construction, collapses bursts such as typing into one request, sends nothing
for changes that cancel out before they go out, and turns retrying into a non-event, because a
failed request is simply still part of the next difference. The engine knows nothing about React;
`useNotes` connects the two and `main.tsx` is the only place that knows the API is a mock.

## Assumptions and decisions

"Create a note of the specified size at the specified position" is covered in two ways. The literal
one is the form in the top bar, which takes the size and the position as numbers. The numbers are
typed rather than stepped, and a request that would not fit on the board is refused with the
browser's own explanation instead of being adjusted silently. The quicker one on a desktop is to
draw the note, which sets both in a single gesture; the grid on the board has a line every 20 pixels
and a heavier one every 100, and the preview shows the exact size, for when precision matters there
too.

The board is the size of the window and does not scroll or zoom. Notes are always kept fully inside
it, also while they are being dragged: a note stops at the edge of the board and follows the pointer
again once it comes back. If the window later becomes smaller than a note's stored position, the
note is shown at the nearest visible position, but the stored position is left alone until the user
moves or resizes the note, so making the window larger again restores the layout.

A note is deleted when it is released while any part of it lies on the trash zone. The pointer does
not have to reach the zone, because a note is held by its top edge and covers the zone well before
the pointer gets there. The one exception is a note that already lies on the zone when it is picked
up, a large one for instance: the smallest move would delete it, so for such a note the pointer
itself has to be brought onto the zone, and if it was picked up by a point that lies on the zone,
that drag does not delete it at all, so that it can be moved off. Since a drag-and-drop deletion has
no confirmation step, the zone turns red before anything happens, Escape calls the drag off, and the
deletion comes with an undo.

Note ids are generated in the browser. That lets saving be an idempotent `PUT /notes/:id`, which is
what makes the retry behaviour above safe, at the price of sending a whole note rather than a patch.
The two persistence bonuses share one path on purpose: the mocked server's database is
`localStorage`, so there is a single source of truth instead of a local cache that could disagree
with the server. Data read back from storage is validated before use, and anything malformed is
dropped rather than trusted.

The mock applies a request as soon as it is issued and delays only the response. Together with a
flush on `pagehide`, which also accounts for requests that are still in flight, this means an edit
made a moment before a reload is not lost; a real client would get the same effect from `fetch` with
`keepalive`.

## What I would do next

I checked the gestures in current Chrome, Edge and Firefox on macOS, but only the pure logic
(geometry, reducer, parsing, the mock API and the sync engine) is covered by automated tests; the
next step would be browser-level tests for the gestures themselves. Creating, typing, recoloring,
moving and resizing can be done from the keyboard through the top bar, but deleting still needs a
pointer, and a keyboard-first way to pick a note would come after that. The sync engine retries when
asked or when the next change arrives, where a production version would also retry on its own with
backoff, time requests out and version the notes so that a late response cannot overwrite a newer
one. Two tabs open on the same board currently overwrite each other note by note instead of merging.
Finally, every note is always in the DOM, which is fine for hundreds of notes but would want culling
on a board with thousands.
