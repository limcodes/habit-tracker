// Pure display helpers for the todo section. Kept free of Firestore/React so
// they can be unit-tested in isolation (mirrors calculateStreak in App.js).

export const TODO_BUCKETS = ['inbox', 'today', 'tomorrow', 'anytime'];
export const COMPLETED_VISIBLE_DAYS = 7;

// Normalize a completedAt value (Firestore Timestamp | Date | epoch ms | null)
// to epoch milliseconds, or null if absent/unrecognized.
const toMillis = (value) => {
  if (value == null) return null;
  if (typeof value === 'number') return value;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (value instanceof Date) return value.getTime();
  return null;
};

// Incomplete todos are always visible. Completed todos stay visible until
// COMPLETED_VISIBLE_DAYS have elapsed since completion; a missing completedAt
// keeps them visible (fail-safe — never hide something we can't date).
export const isTodoVisible = (todo, nowMs) => {
  if (!todo.completed) return true;
  const completedMs = toMillis(todo.completedAt);
  if (completedMs == null) return true;
  return nowMs - completedMs < COMPLETED_VISIBLE_DAYS * 24 * 60 * 60 * 1000;
};

// Sort a single bucket's todos for display: incomplete first by `order`
// ascending, then completed by completion time descending. Returns a new array.
export const sortBucketTodos = (todos) => {
  return [...todos].sort((a, b) => {
    if (!a.completed !== !b.completed) return a.completed ? 1 : -1;
    if (!a.completed) return (a.order ?? 0) - (b.order ?? 0);
    return (toMillis(b.completedAt) ?? 0) - (toMillis(a.completedAt) ?? 0);
  });
};

// A Tomorrow todo carries `promoteOn` (yyyy-MM-dd) — the day it should land in
// Today. It is due once the current date (todayStr, yyyy-MM-dd) reaches it.
// yyyy-MM-dd strings compare correctly with `>=`.
export const isTomorrowDue = (todo, todayStr) =>
  todo.bucket === 'tomorrow' && !!todo.promoteOn && todayStr >= todo.promoteOn;

// Promote every due Tomorrow todo into Today, appended after the existing Today
// incomplete items (in their current Tomorrow order) and with promoteOn cleared.
// Returns { todos, updates } — `updates` lists the docs to persist
// ({ id, bucket, order, promoteOn }); empty when nothing is due.
export const promoteDueTomorrowTodos = (todos, todayStr) => {
  const due = todos.filter((t) => isTomorrowDue(t, todayStr));
  if (due.length === 0) return { todos, updates: [] };

  let nextOrder = todos.filter((t) => t.bucket === 'today' && !t.completed).length;
  const dueSorted = [...due].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const promoted = new Map();
  for (const t of dueSorted) {
    promoted.set(t.id, { bucket: 'today', order: nextOrder++, promoteOn: null });
  }

  const updatedTodos = todos.map((t) =>
    promoted.has(t.id) ? { ...t, ...promoted.get(t.id) } : t
  );
  const updates = dueSorted.map((t) => ({ id: t.id, ...promoted.get(t.id) }));
  return { todos: updatedTodos, updates };
};
