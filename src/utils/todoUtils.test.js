import { isTodoVisible, sortBucketTodos, TODO_BUCKETS, COMPLETED_VISIBLE_DAYS } from './todoUtils';

const DAY = 24 * 60 * 60 * 1000;
const now = 1_700_000_000_000; // fixed reference epoch ms

test('exposes the three bucket ids and the visibility window', () => {
  expect(TODO_BUCKETS).toEqual(['inbox', 'today', 'anytime']);
  expect(COMPLETED_VISIBLE_DAYS).toBe(7);
});

test('incomplete todos are always visible', () => {
  expect(isTodoVisible({ completed: false, completedAt: null }, now)).toBe(true);
});

test('completed todo within 7 days is visible', () => {
  expect(isTodoVisible({ completed: true, completedAt: now - 3 * DAY }, now)).toBe(true);
});

test('completed todo older than 7 days is hidden', () => {
  expect(isTodoVisible({ completed: true, completedAt: now - 8 * DAY }, now)).toBe(false);
});

test('completed todo with no completedAt stays visible', () => {
  expect(isTodoVisible({ completed: true, completedAt: null }, now)).toBe(true);
});

test('accepts a Firestore-style Timestamp with toMillis()', () => {
  const ts = { toMillis: () => now - 1 * DAY };
  expect(isTodoVisible({ completed: true, completedAt: ts }, now)).toBe(true);
});

test('sorts incomplete by order, then completed by completedAt desc', () => {
  const todos = [
    { id: 'c-old', completed: true, completedAt: now - 5 * DAY, order: 0 },
    { id: 'i-1', completed: false, order: 1 },
    { id: 'c-new', completed: true, completedAt: now - 1 * DAY, order: 0 },
    { id: 'i-0', completed: false, order: 0 },
  ];
  expect(sortBucketTodos(todos).map(t => t.id)).toEqual(['i-0', 'i-1', 'c-new', 'c-old']);
});

test('sortBucketTodos does not mutate its input', () => {
  const todos = [{ id: 'b', completed: false, order: 1 }, { id: 'a', completed: false, order: 0 }];
  const snapshot = [...todos];
  sortBucketTodos(todos);
  expect(todos).toEqual(snapshot);
});
