# Todo Section — Design

**Date:** 2026-06-18
**Status:** Approved

## Goal

Add a simple todo list to the habit tracker. It lives in the left column, directly
under the "Add Habit" input row and before the pinned (sticky) notes.

## Placement

A new `TodoList` component rendered in `src/App.js` inside the left `habit-list`
column, between the Add-Habit input row (`.input-and-nav`) and `<StickyNotes>`.

## Data model

New Firestore collection: `users/{uid}/todos`. **Per-document** persistence
(like notes — `addDoc`/`updateDoc`/`deleteDoc`), not the batch delete-all-then-write
pattern habits use, because todos are edited and reassigned individually.

Each document:

```
{
  text:        string,
  bucket:      'inbox' | 'today' | 'anytime',
  completed:   boolean,
  completedAt: Timestamp | null,   // set when completed, used for 7-day fade + sort
  createdAt:   Timestamp,
  order:       number              // position among incomplete todos within its bucket
}
```

## Persistence (mirrors the notes pattern in App.js)

- State and handlers live in `App.js`; `TodoList` is presentational and receives
  state + handlers as props.
- Todos fetched in a `useEffect` keyed on `user` (same shape as the notes fetch).
- All mutations update local state optimistically, then write to Firestore with
  `addDoc`/`updateDoc`/`deleteDoc` directly in the `App.js` handlers.
- Every handler early-returns if there is no `user` (matches existing handlers).
- `firestore.rules` already scopes `users/{uid}/**` to the owner via the
  recursive `match /users/{userId}/{document=**}` rule, so the new `todos`
  subcollection is covered with no rules change.

## UI & behavior

### Buckets / tabs
- Three tabs: **Inbox · Today · Anytime**. The active tab selects which bucket's
  todos are shown.
- Default active tab: **Today**.
- An add-input sits under the tabs. New todos are created in the **currently
  active** bucket, with `completed: false`, `completedAt: null`,
  `order = ` (count of incomplete todos already in that bucket).

### Todo row
Each visible todo renders:
- a **checkbox** (toggles completion),
- the **text** — click to edit inline (same edit pattern as notes/habits:
  input + Save/Cancel, Enter saves, Escape cancels),
- a small **bucket dropdown** to move the todo to another bucket,
- a **delete (×)** button.

### Completion
- Checking a todo sets `completed: true`, `completedAt: now`.
- Unchecking sets `completed: false`, `completedAt: null`.
- Completed todos sink to the **bottom** of their bucket and render with a
  **strikethrough**.

### 7-day fade-out
- Completed todos whose `completedAt` is older than 7 days are **filtered from
  view**.
- To keep the collection tidy, these stale completed docs are also lazily
  `deleteDoc`'d during the fetch on load (collect stale ids, delete them, and
  exclude them from the state set).

### Moving between buckets
- The per-row dropdown reassigns `bucket`. On move, the todo joins the target
  bucket; assign it `order` = count of incomplete todos in the target bucket so
  it lands at the bottom of that bucket's incomplete list.

### Drag-to-reorder
- Uses the same HTML5 drag-and-drop pattern as `HabitsTable`
  (`onDragStart/Over/Leave/Drop/End`, `draggedIndex`/`dragOverIndex` state,
  `.dragging`/`.drag-over` classes).
- Applies to **incomplete todos within the active bucket only**. Completed todos
  are pinned to the bottom and are not draggable. A row being edited is not
  draggable (`draggable={editingId !== todo.id}`).
- On drop, reindex `order` 0..n across the incomplete todos in that bucket and
  persist each changed doc via `updateDoc`.

### Sort within a bucket
1. Incomplete todos by `order` ascending.
2. Then completed todos by `completedAt` descending.

## States

- Loading: `state-message` with `role="status"` (e.g. "Loading your todos…"),
  matching the habits/notes loading convention.
- Empty (active bucket has no visible todos): an `empty-state` message.

## Styling

Reuse the existing Muji-minimal CSS vocabulary in `App.css`. Tabs, rows, checkbox,
dropdown, and the drag affordances follow the look of the existing habit/note
controls. No new design language.

## Out of scope (YAGNI)

- Due dates, reminders, sub-tasks.
- A dedicated completed-history / archive view (the 7-day window is the only
  history surface).
- Cross-bucket drag-and-drop (bucket moves are dropdown-only; drag is reorder
  within a bucket).

## Testing

- Unit-test the pure helpers: bucket sort (incomplete-by-order then
  completed-by-completedAt) and the 7-day stale-filter predicate. Factor these
  into small exported pure functions so they can be tested without Firestore,
  following the `calculateStreak` precedent.
- Component test for `TodoList` (React Testing Library, per existing
  `*.test.js` convention): add, check off (strikethrough + sinks), edit, delete,
  bucket switch via tabs, and move via dropdown.
