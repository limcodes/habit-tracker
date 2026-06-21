# Done bucket with same-day grace

## Summary

Completed ("crossed-out") todos are automatically swept into a new **Done** bucket
once the day they were completed has passed. An item completed *today* stays
crossed-out at the bottom of whatever bucket it currently lives in; when the date
rolls over, it moves to Done. This mirrors the existing inverse pattern,
`promoteDueTomorrowTodos` (Tomorrow → Today on its date).

## Behavior

- A completed todo whose completion date is **before today** lives in the `done` bucket.
- A completed todo whose completion date **is today** stays in its current bucket
  (Inbox / Today / Tomorrow / Anytime), rendered crossed-out at the bottom. This
  grace applies to **all** buckets, not only Today.
- Retention is unchanged: completed todos still fade (auto-delete) 7 days after
  completion via `isTodoVisible` / `COMPLETED_VISIBLE_DAYS`. Done items live in the
  Done bucket during that 7-day window.
- Un-checking (re-activating) an item that is **in the Done bucket** moves it to
  **Inbox** as an active item. Un-checking a same-day completed item still sitting
  in its own bucket just makes it active in place (unchanged behavior).

## Data model

No schema change. The `bucket` field gains one new legal value, `done`. Completion
still sets `completed: true` and `completedAt: Timestamp`. No origin-bucket tracking
is needed because the un-complete destination is fixed (Inbox).

## Components

### `src/utils/todoUtils.js` — `sweepCompletedTodos(todos, todayStr)` (new, pure)

Mirrors `promoteDueTomorrowTodos`. Selects every todo that is `completed`, has a
`completedAt` whose **local** date (`yyyy-MM-dd`) is strictly before `todayStr`, and
is not already in `done`. Rewrites each such todo's bucket to `done`.

Returns `{ todos, updates }` where `updates` is the list of docs to persist
(`{ id, bucket: 'done' }`); empty when nothing is due. A completed todo with a
missing/undatable `completedAt` is left in place (fail-safe — never sweep what we
can't date).

Add `'done'` to `TODO_BUCKETS` (last).

### `src/App.js`

- In the todos fetch effect, after `promoteDueTomorrowTodos`, run
  `sweepCompletedTodos(promotedTodos, todayStr)` and persist its `updates`
  (batched, same shape as the promotion). Set state from the swept result.
- `toggleTodoComplete`: when un-checking an item whose `bucket === 'done'`, also set
  `bucket: 'inbox'` and a fresh `order` (end of Inbox's incomplete list) so it lands
  as an active Inbox item. Otherwise unchanged.

### `src/components/TodoList.js`

- Add `done: 'Done'` to `BUCKET_LABELS`. The Done tab renders via the existing
  `TODO_BUCKETS` map.
- Hide the add-todo composer when the active bucket is `done` (no authoring into an
  archive).
- Done items are all completed, so they are already non-draggable and sort
  newest-first via the existing completed sort in `sortBucketTodos`.

## Known limitation

The sweep runs on fetch (auth/user change), not on a live midnight timer — same as
the Tomorrow promotion. If the app stays open across midnight, items move to Done on
the next load.

## Tests

Unit-test `sweepCompletedTodos` alongside `promoteDueTomorrowTodos`:

- completed yesterday → swept to `done`
- completed today → untouched (stays in its bucket)
- already in `done` → no-op (not in `updates`)
- missing `completedAt` → left in place
- incomplete → never swept
