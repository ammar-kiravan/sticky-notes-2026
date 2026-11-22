# Sticky notes

A single-page sticky-notes board written in TypeScript and React. There are no UI kits,
drag-and-drop libraries or state-management libraries involved: the only runtime dependencies are
React itself and a self-hosted font. All four required features are implemented, together with the
five optional ones.

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

The board is meant to be used with a mouse, so every feature is a direct gesture rather than a form.

| Feature                    | How it works                                                                                                                                                                                          |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Create at a position, size | Drag on an empty part of the board. The rectangle you draw becomes the note, and a live preview shows its size in pixels. Double-clicking drops in a note of the standard size instead.               |
| Move                       | Drag a note by the strip along its top edge.                                                                                                                                                          |
| Resize                     | Drag any edge or corner. Notes cannot become smaller than 160 × 120 and cannot grow past the board.                                                                                                   |
| Delete                     | Drop a note on the trash zone at the bottom of the board. The zone and the note both show when releasing will delete, and the deletion can be undone for seven seconds.                               |
| Text (bonus I)             | Click into a note and type. A new note is focused straight away.                                                                                                                                      |
| Bring to front (bonus II)  | Pressing on a note, or moving keyboard focus into it, raises it above the others.                                                                                                                     |
| Persistence (bonus III, V) | Every change is saved through an asynchronous REST-style API. The API is mocked in the browser and keeps its data in `localStorage`, so the notes are restored on reload. The top bar shows progress. |
| Colors (bonus IV)          | The swatches in the top bar set the color of new notes; the swatches that appear in a note's top strip recolor that note.                                                                             |

Pressing Escape abandons whichever gesture is in progress. Opening the app as
`http://localhost:5173/?flaky` makes a third of the mocked requests fail, which is the quickest way
to see the error handling: a failed load offers a retry, and a failed save keeps the changes on
screen and offers to send them again.

## Architecture

The code is split into layers that depend on each other in one direction only. `domain` holds the
`Note` type and the geometry as pure functions (fitting a rectangle into the board, resizing from a
handle, building a rectangle from a drag), so every rule about positions and sizes lives in one
place and is unit-tested without a browser. `state` holds a reducer that is the single source of
truth for the notes; components never mutate anything, they dispatch actions such as `noteAdded` or
`noteRaised`. The components in `components` are thin: `Board` wires things together, `NoteCreator`
is the empty surface that turns a drag into a new note, and `NoteView` renders one note.

All three gestures (drawing, moving, resizing) are built on one hook, `usePointerDrag`. It uses
Pointer Events with pointer capture, so a drag keeps working when the pointer leaves the element or
the window and no document-level listeners are needed, and it coalesces pointer movement to one
update per animation frame. Performance was the main concern here. While a gesture is running, its
geometry lives in the local state of the one component involved, so a frame of dragging re-renders
exactly one note; the reducer hears about the result once, on release. `NoteView` is memoised and
the reducer preserves the identity of untouched notes, so committing a change re-renders only the
note that changed. Notes are positioned with `transform`, which keeps moving them out of layout.
Stacking order is a per-note counter rather than the order of the array, so raising a note changes
one `z-index` and never moves DOM nodes, which would drop focus and pointer capture.

Persistence sits behind a small `NotesApi` interface (`list`, `save`, `remove`) shaped like a REST
resource, with a mock implementation that answers after a delay. Between the reducer and the API is
a sync engine (`sync/notesSync.ts`) that does not mirror individual actions as requests. Instead it
compares the current notes with what the server has acknowledged and sends the difference, after a
short debounce and one batch at a time. That makes the UI optimistic by construction, collapses
bursts such as typing into one request, sends nothing for changes that cancel out before they go
out, and turns retrying into a non-event, because a failed request is simply still part of the next
difference. The engine knows nothing about React; `useNotes` connects the two and
`main.tsx` is the only place that knows the API is a mock.

## Assumptions and decisions

I read "create a note of the specified size at the specified position" as a request for the most
direct way to specify both, which on a desktop is drawing the note, rather than as a form with four
number fields. The grid on the board has a line every 20 pixels and a heavier one every 100, and the
preview shows the exact size, for when precision matters.

The board is the size of the window and does not scroll or zoom. Notes are always kept fully inside
it: a note follows the pointer freely while it is dragged, so that the trash zone is always
reachable, and is pulled back inside when dropped. If the window later becomes smaller than a note's
stored position, the note is shown at the nearest visible position, but the stored position is left
alone until the user moves the note, so making the window larger again restores the layout.

Deleting is decided by where the pointer is, not by whether the note's rectangle overlaps the trash
zone, because a large note would otherwise touch the zone long before the user means it. Since a
drag-and-drop deletion is easy to trigger by accident and has no confirmation step, it comes with an
undo.

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

I checked the gestures in current Chrome, Edge and Firefox on macOS, but only the pure logic (geometry,
reducer, parsing, the mock API and the sync engine) is covered by automated tests; the next step
would be browser-level tests for the gestures themselves. Text and colors are fully usable from the
keyboard, while creating, moving, resizing and deleting still need a pointer, so keyboard
equivalents would come after that. The sync engine retries when asked or when the next change
arrives, where a production version would also retry on its own with backoff, time requests out
and version the notes so that a late response cannot overwrite a newer one. Two tabs open on the
same board currently overwrite each other note by note instead of merging. Finally, every note
is always in the DOM, which is fine for hundreds of notes but would want culling on a board with
thousands.
