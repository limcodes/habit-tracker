import {
  isTodoVisible,
  sortBucketTodos,
  isTomorrowDue,
  promoteDueTomorrowTodos,
  sweepCompletedTodos,
  TODO_BUCKETS,
  COMPLETED_VISIBLE_DAYS,
} from './todoUtils';

const DAY = 24 * 60 * 60 * 1000;
const now = 1_700_000_000_000; // fixed reference epoch ms

// Local noon on a given day formats to that day's yyyy-MM-dd in any sane TZ.
const localNoon = (y, m, d) => new Date(y, m - 1, d, 12, 0, 0);

test('exposes the five bucket ids (including done) and the visibility window', () => {
  expect(TODO_BUCKETS).toEqual(['inbox', 'today', 'tomorrow', 'anytime', 'done']);
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

test('sortBucketTodos can group by a custom completion predicate (frozen view)', () => {
  // 'a' is live-incomplete but frozen as completed; it should sink below 'b'.
  const todos = [
    { id: 'a', completed: false, order: 0, completedAt: now - 1 * DAY },
    { id: 'b', completed: false, order: 1 },
  ];
  const frozenCompleted = new Set(['a']);
  expect(sortBucketTodos(todos, (t) => frozenCompleted.has(t.id)).map(t => t.id)).toEqual(['b', 'a']);
});

test('sortBucketTodos does not mutate its input', () => {
  const todos = [{ id: 'b', completed: false, order: 1 }, { id: 'a', completed: false, order: 0 }];
  const snapshot = [...todos];
  sortBucketTodos(todos);
  expect(todos).toEqual(snapshot);
});

describe('Tomorrow → Today promotion', () => {
  test('a Tomorrow todo is due once today reaches its promoteOn date', () => {
    expect(isTomorrowDue({ bucket: 'tomorrow', promoteOn: '2026-06-19' }, '2026-06-19')).toBe(true);
    expect(isTomorrowDue({ bucket: 'tomorrow', promoteOn: '2026-06-19' }, '2026-06-20')).toBe(true);
  });

  test('a Tomorrow todo is not due before its promoteOn date', () => {
    expect(isTomorrowDue({ bucket: 'tomorrow', promoteOn: '2026-06-19' }, '2026-06-18')).toBe(false);
  });

  test('todos in other buckets are never due, and missing promoteOn is not due', () => {
    expect(isTomorrowDue({ bucket: 'today', promoteOn: '2026-06-01' }, '2026-06-20')).toBe(false);
    expect(isTomorrowDue({ bucket: 'tomorrow', promoteOn: null }, '2026-06-20')).toBe(false);
  });

  test('promoteDueTomorrowTodos moves due items to Today, clears promoteOn, appends after existing Today todos', () => {
    const todos = [
      { id: 't0', bucket: 'today', completed: false, order: 0 },
      { id: 'tm1', bucket: 'tomorrow', completed: false, order: 1, promoteOn: '2026-06-19' },
      { id: 'tm0', bucket: 'tomorrow', completed: false, order: 0, promoteOn: '2026-06-19' },
      { id: 'tm-future', bucket: 'tomorrow', completed: false, order: 2, promoteOn: '2026-06-25' },
    ];
    const { todos: result, updates } = promoteDueTomorrowTodos(todos, '2026-06-19');

    const byId = Object.fromEntries(result.map(t => [t.id, t]));
    expect(byId.tm0).toMatchObject({ bucket: 'today', order: 1, promoteOn: null });
    expect(byId.tm1).toMatchObject({ bucket: 'today', order: 2, promoteOn: null });
    expect(byId['tm-future']).toMatchObject({ bucket: 'tomorrow', promoteOn: '2026-06-25' });
    expect(updates.map(u => u.id)).toEqual(['tm0', 'tm1']);
  });

  test('promoteDueTomorrowTodos returns no updates when nothing is due', () => {
    const todos = [{ id: 'tm', bucket: 'tomorrow', completed: false, order: 0, promoteOn: '2026-12-31' }];
    const { updates } = promoteDueTomorrowTodos(todos, '2026-06-19');
    expect(updates).toEqual([]);
  });
});

describe('Sweep completed → Done', () => {
  test('sweeps a todo completed before today into the done bucket', () => {
    const todos = [
      { id: 'a', bucket: 'today', completed: true, completedAt: localNoon(2026, 6, 19) },
    ];
    const { todos: result, updates } = sweepCompletedTodos(todos, '2026-06-20');
    expect(result.find(t => t.id === 'a')).toMatchObject({ bucket: 'done' });
    expect(updates).toEqual([{ id: 'a', bucket: 'done' }]);
  });

  test('leaves a todo completed today in its own bucket (same-day grace)', () => {
    const todos = [
      { id: 'a', bucket: 'today', completed: true, completedAt: localNoon(2026, 6, 20) },
      { id: 'b', bucket: 'anytime', completed: true, completedAt: localNoon(2026, 6, 20) },
    ];
    const { todos: result, updates } = sweepCompletedTodos(todos, '2026-06-20');
    expect(result.find(t => t.id === 'a').bucket).toBe('today');
    expect(result.find(t => t.id === 'b').bucket).toBe('anytime');
    expect(updates).toEqual([]);
  });

  test('grace applies to every bucket, not just today', () => {
    const todos = [
      { id: 'i', bucket: 'inbox', completed: true, completedAt: localNoon(2026, 6, 19) },
      { id: 'a', bucket: 'anytime', completed: true, completedAt: localNoon(2026, 6, 19) },
    ];
    const { updates } = sweepCompletedTodos(todos, '2026-06-20');
    expect(updates.map(u => u.id).sort()).toEqual(['a', 'i']);
  });

  test('does not re-sweep an item already in done', () => {
    const todos = [
      { id: 'a', bucket: 'done', completed: true, completedAt: localNoon(2026, 6, 19) },
    ];
    const { updates } = sweepCompletedTodos(todos, '2026-06-20');
    expect(updates).toEqual([]);
  });

  test('never sweeps incomplete todos', () => {
    const todos = [{ id: 'a', bucket: 'today', completed: false, completedAt: null }];
    const { updates } = sweepCompletedTodos(todos, '2026-06-20');
    expect(updates).toEqual([]);
  });

  test('leaves a completed todo with no completedAt in place (fail-safe)', () => {
    const todos = [{ id: 'a', bucket: 'today', completed: true, completedAt: null }];
    const { todos: result, updates } = sweepCompletedTodos(todos, '2026-06-20');
    expect(result.find(t => t.id === 'a').bucket).toBe('today');
    expect(updates).toEqual([]);
  });

  test('accepts a Firestore-style Timestamp with toMillis()', () => {
    const ts = { toMillis: () => localNoon(2026, 6, 19).getTime() };
    const todos = [{ id: 'a', bucket: 'today', completed: true, completedAt: ts }];
    const { updates } = sweepCompletedTodos(todos, '2026-06-20');
    expect(updates).toEqual([{ id: 'a', bucket: 'done' }]);
  });

  test('does not mutate its input', () => {
    const todos = [{ id: 'a', bucket: 'today', completed: true, completedAt: localNoon(2026, 6, 19) }];
    const snapshot = JSON.parse(JSON.stringify(todos));
    sweepCompletedTodos(todos, '2026-06-20');
    expect(JSON.parse(JSON.stringify(todos))).toEqual(snapshot);
  });
});
