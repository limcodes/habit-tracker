# Todo Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a simple bucketed todo list (Inbox / Today / Anytime) to the left column, under "Add Habit" and before the pinned notes.

**Architecture:** A presentational `TodoList` component receives all state and handlers as props from `App.js` (same pattern as habits/notes). Todos persist per-document in Firestore at `users/{uid}/todos`. Pure display helpers (sort, 7-day visibility) live in `src/utils/todoUtils.js` and are unit-tested in isolation, following the `calculateStreak` precedent.

**Tech Stack:** React (Create React App), Firebase Firestore, date-fns, Jest + React Testing Library.

## Global Constraints

- Every mutation handler in `App.js` must early-return if there is no `user`.
- All Firestore data namespaced under `users/{uid}/...`; `firestore.rules` already covers `users/{userId}/{document=**}` recursively — no rules change.
- Notes-style persistence: per-document `addDoc`/`updateDoc`/`deleteDoc` in `App.js` handlers with optimistic local-state updates.
- Three buckets only, exact ids: `'inbox'`, `'today'`, `'anytime'`. Labels: `Inbox`, `Today`, `Anytime`. Default active bucket: `'today'`.
- Completed todos visible for 7 days after completion, then filtered out and lazily deleted on fetch.
- No new dependencies. Reuse existing `App.css` Muji-minimal styling vocabulary.

---

## File Structure

- Create: `src/utils/todoUtils.js` — pure helpers: `TODO_BUCKETS`, `COMPLETED_VISIBLE_DAYS`, `isTodoVisible`, `sortBucketTodos`.
- Create: `src/utils/todoUtils.test.js` — unit tests for the helpers.
- Create: `src/components/TodoList.js` — presentational todo UI (tabs, input, rows, drag-reorder).
- Create: `src/components/TodoList.test.js` — component tests.
- Modify: `src/App.js` — todo state, fetch effect, handlers, render `<TodoList>`.
- Modify: `src/App.css` — todo section styles.

---

## Task 1: Pure display helpers (`todoUtils.js`)

**Files:**
- Create: `src/utils/todoUtils.js`
- Test: `src/utils/todoUtils.test.js`

**Interfaces:**
- Produces:
  - `TODO_BUCKETS: string[]` = `['inbox', 'today', 'anytime']`
  - `COMPLETED_VISIBLE_DAYS: number` = `7`
  - `isTodoVisible(todo, nowMs: number): boolean` — incomplete todos always visible; completed todos visible only if `completedAt` is null/missing OR less than 7 days before `nowMs`. `completedAt` may be a Firestore Timestamp (`.toMillis()`), a `Date`, a number (epoch ms), or null.
  - `sortBucketTodos(todos): todo[]` — returns a new array: incomplete first by `order` ascending, then completed by `completedAt` descending.

- [ ] **Step 1: Write the failing tests**

Create `src/utils/todoUtils.test.js`:

```javascript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --watchAll=false src/utils/todoUtils.test.js`
Expected: FAIL — `Cannot find module './todoUtils'`.

- [ ] **Step 3: Write the implementation**

Create `src/utils/todoUtils.js`:

```javascript
// Pure display helpers for the todo section. Kept free of Firestore/React so
// they can be unit-tested in isolation (mirrors calculateStreak in App.js).

export const TODO_BUCKETS = ['inbox', 'today', 'anytime'];
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --watchAll=false src/utils/todoUtils.test.js`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/todoUtils.js src/utils/todoUtils.test.js
git commit -m "feat: add todo display helpers (sort + 7-day visibility)"
```

---

## Task 2: `TodoList` component

**Files:**
- Create: `src/components/TodoList.js`
- Test: `src/components/TodoList.test.js`

**Interfaces:**
- Consumes (from Task 1): `isTodoVisible`, `sortBucketTodos`, `TODO_BUCKETS`.
- Produces — `TodoList` accepts these props (the exact names Task 3 must pass):
  - `todos: todo[]`, `todosLoading: boolean`
  - `activeTodoBucket: string`, `setActiveTodoBucket(bucket)`
  - `newTodoText: string`, `setNewTodoText(text)`, `addTodo()`
  - `toggleTodoComplete(todoId)`
  - `editingTodoId: string|null`, `editTodoText: string`, `setEditTodoText(text)`, `startEditTodo(todo)`, `saveEditTodo()`, `cancelEditTodo()`
  - `deleteTodo(todoId)`
  - `moveTodoToBucket(todoId, bucket)`
  - `reorderTodos(bucket, orderedIds: string[])`
  - A todo object shape: `{ id, text, bucket, completed, completedAt, order }`.

- [ ] **Step 1: Write the failing tests**

Create `src/components/TodoList.test.js`:

```javascript
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import TodoList from './TodoList';

const baseProps = {
  todos: [],
  todosLoading: false,
  activeTodoBucket: 'today',
  setActiveTodoBucket: jest.fn(),
  newTodoText: '',
  setNewTodoText: jest.fn(),
  addTodo: jest.fn(),
  toggleTodoComplete: jest.fn(),
  editingTodoId: null,
  editTodoText: '',
  setEditTodoText: jest.fn(),
  startEditTodo: jest.fn(),
  saveEditTodo: jest.fn(),
  cancelEditTodo: jest.fn(),
  deleteTodo: jest.fn(),
  moveTodoToBucket: jest.fn(),
  reorderTodos: jest.fn(),
};

const todo = (over) => ({ id: 'x', text: 'task', bucket: 'today', completed: false, completedAt: null, order: 0, ...over });

beforeEach(() => jest.clearAllMocks());

test('renders the three bucket tabs', () => {
  render(<TodoList {...baseProps} />);
  expect(screen.getByRole('tab', { name: 'Inbox' })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'Today' })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'Anytime' })).toBeInTheDocument();
});

test('shows empty state when active bucket has no todos', () => {
  render(<TodoList {...baseProps} todos={[todo({ bucket: 'inbox' })]} />);
  expect(screen.getByText(/No todos here yet/)).toBeInTheDocument();
});

test('shows only the active bucket and switches tab on click', () => {
  const todos = [todo({ id: 'a', text: 'today-task', bucket: 'today' }), todo({ id: 'b', text: 'inbox-task', bucket: 'inbox' })];
  render(<TodoList {...baseProps} todos={todos} />);
  expect(screen.getByText('today-task')).toBeInTheDocument();
  expect(screen.queryByText('inbox-task')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('tab', { name: 'Inbox' }));
  expect(baseProps.setActiveTodoBucket).toHaveBeenCalledWith('inbox');
});

test('checkbox toggles completion', () => {
  render(<TodoList {...baseProps} todos={[todo({ id: 'a', text: 'task' })]} />);
  fireEvent.click(screen.getByRole('checkbox'));
  expect(baseProps.toggleTodoComplete).toHaveBeenCalledWith('a');
});

test('clicking the text starts editing', () => {
  const t = todo({ id: 'a', text: 'task' });
  render(<TodoList {...baseProps} todos={[t]} />);
  fireEvent.click(screen.getByText('task'));
  expect(baseProps.startEditTodo).toHaveBeenCalledWith(t);
});

test('delete button calls deleteTodo', () => {
  render(<TodoList {...baseProps} todos={[todo({ id: 'a', text: 'task' })]} />);
  fireEvent.click(screen.getByRole('button', { name: /Delete todo: task/ }));
  expect(baseProps.deleteTodo).toHaveBeenCalledWith('a');
});

test('bucket dropdown moves the todo', () => {
  render(<TodoList {...baseProps} todos={[todo({ id: 'a', text: 'task', bucket: 'today' })]} />);
  fireEvent.change(screen.getByRole('combobox', { name: /Move "task"/ }), { target: { value: 'anytime' } });
  expect(baseProps.moveTodoToBucket).toHaveBeenCalledWith('a', 'anytime');
});

test('completed todos render with the completed class and stay (within 7 days)', () => {
  const t = todo({ id: 'a', text: 'done', completed: true, completedAt: Date.now() });
  const { container } = render(<TodoList {...baseProps} todos={[t]} />);
  expect(screen.getByText('done')).toBeInTheDocument();
  expect(container.querySelector('.todo-item.completed')).toBeTruthy();
});

test('editing a todo shows save/cancel and an input', () => {
  render(<TodoList {...baseProps} todos={[todo({ id: 'a', text: 'task' })]} editingTodoId="a" editTodoText="task" />);
  expect(screen.getByDisplayValue('task')).toBeInTheDocument();
  fireEvent.click(screen.getByTitle('Save'));
  expect(baseProps.saveEditTodo).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --watchAll=false src/components/TodoList.test.js`
Expected: FAIL — `Cannot find module './TodoList'`.

- [ ] **Step 3: Write the implementation**

Create `src/components/TodoList.js`:

```javascript
import React, { useState } from 'react';
import { isTodoVisible, sortBucketTodos, TODO_BUCKETS } from '../utils/todoUtils';

const BUCKET_LABELS = { inbox: 'Inbox', today: 'Today', anytime: 'Anytime' };

function TodoList({
  todos,
  todosLoading,
  activeTodoBucket,
  setActiveTodoBucket,
  newTodoText,
  setNewTodoText,
  addTodo,
  toggleTodoComplete,
  editingTodoId,
  editTodoText,
  setEditTodoText,
  startEditTodo,
  saveEditTodo,
  cancelEditTodo,
  deleteTodo,
  moveTodoToBucket,
  reorderTodos,
}) {
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  const nowMs = Date.now();
  const bucketTodos = sortBucketTodos(
    todos.filter((t) => t.bucket === activeTodoBucket && isTodoVisible(t, nowMs))
  );
  // Drag-reorder applies only to the incomplete todos in this bucket; their
  // position in this array is the index used by the drag handlers.
  const incompleteTodos = bucketTodos.filter((t) => !t.completed);

  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (index !== draggedIndex) setDragOverIndex(index);
  };

  const handleDragLeave = () => setDragOverIndex(null);

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }
    const reordered = [...incompleteTodos];
    const [moved] = reordered.splice(draggedIndex, 1);
    reordered.splice(dropIndex, 0, moved);
    reorderTodos(activeTodoBucket, reordered.map((t) => t.id));
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  return (
    <div className="todo-section">
      <div className="todo-tabs" role="tablist">
        {TODO_BUCKETS.map((bucket) => (
          <button
            key={bucket}
            role="tab"
            aria-selected={activeTodoBucket === bucket}
            className={`todo-tab ${activeTodoBucket === bucket ? 'active' : ''}`}
            onClick={() => setActiveTodoBucket(bucket)}
          >
            {BUCKET_LABELS[bucket]}
          </button>
        ))}
      </div>

      <div className="todo-input">
        <input
          type="text"
          value={newTodoText}
          onChange={(e) => setNewTodoText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') addTodo(); }}
          placeholder="Add a todo"
          aria-label="New todo"
        />
        <button onClick={addTodo}>Add</button>
      </div>

      {todosLoading && todos.length === 0 ? (
        <p className="state-message" role="status">Loading your todos…</p>
      ) : bucketTodos.length === 0 ? (
        <p className="state-message empty-state">No todos here yet.</p>
      ) : (
        <ul className="todo-list">
          {bucketTodos.map((t) => {
            const incompleteIndex = incompleteTodos.indexOf(t); // -1 for completed
            const isDraggable = !t.completed && editingTodoId !== t.id;
            const isDragging = isDraggable && draggedIndex === incompleteIndex;
            const isDragOver = isDraggable && dragOverIndex === incompleteIndex;
            return (
              <li
                key={t.id}
                className={`todo-item ${t.completed ? 'completed' : ''} ${isDragging ? 'dragging' : ''} ${isDragOver ? 'drag-over' : ''}`}
                draggable={isDraggable}
                onDragStart={isDraggable ? (e) => handleDragStart(e, incompleteIndex) : undefined}
                onDragOver={isDraggable ? (e) => handleDragOver(e, incompleteIndex) : undefined}
                onDragLeave={isDraggable ? handleDragLeave : undefined}
                onDrop={isDraggable ? (e) => handleDrop(e, incompleteIndex) : undefined}
                onDragEnd={isDraggable ? handleDragEnd : undefined}
              >
                {editingTodoId === t.id ? (
                  <div className="todo-edit">
                    <input
                      type="text"
                      value={editTodoText}
                      onChange={(e) => setEditTodoText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEditTodo();
                        if (e.key === 'Escape') cancelEditTodo();
                      }}
                      autoFocus
                    />
                    <div className="todo-edit-actions">
                      <button onClick={saveEditTodo} title="Save">✓</button>
                      <button onClick={cancelEditTodo} title="Cancel">✕</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <input
                      type="checkbox"
                      className="todo-check"
                      checked={!!t.completed}
                      onChange={() => toggleTodoComplete(t.id)}
                      aria-label={`Mark "${t.text}" ${t.completed ? 'incomplete' : 'complete'}`}
                    />
                    <span className="todo-text" onClick={() => startEditTodo(t)}>{t.text}</span>
                    <select
                      className="todo-bucket-select"
                      value={t.bucket}
                      onChange={(e) => moveTodoToBucket(t.id, e.target.value)}
                      aria-label={`Move "${t.text}" to another list`}
                    >
                      {TODO_BUCKETS.map((b) => (
                        <option key={b} value={b}>{BUCKET_LABELS[b]}</option>
                      ))}
                    </select>
                    <button
                      className="delete-todo-btn hover-delete"
                      onClick={() => deleteTodo(t.id)}
                      aria-label={`Delete todo: ${t.text}`}
                      title="Delete todo"
                    >✕</button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default TodoList;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --watchAll=false src/components/TodoList.test.js`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/TodoList.js src/components/TodoList.test.js
git commit -m "feat: add TodoList component (tabs, edit, delete, move, drag-reorder)"
```

---

## Task 3: Wire todos into `App.js`

**Files:**
- Modify: `src/App.js`

**Interfaces:**
- Consumes (from Task 2): `TodoList` and the prop names listed in Task 2's Produces block.
- Consumes (from Task 1): `isTodoVisible` (for the fetch-time stale filter).
- Produces: a fully wired todo feature; no later task depends on new exports.

- [ ] **Step 1: Add imports**

In `src/App.js`, add the component import alongside the others (after the `StickyNotes` import on line 13):

```javascript
import TodoList from './components/TodoList';
```

And add the helper import after the `parseNoteText` import (line 16):

```javascript
import { isTodoVisible } from './utils/todoUtils';
```

- [ ] **Step 2: Add todo state**

In `App.js`, after the `notesLoading` state declaration (`const [notesLoading, setNotesLoading] = useState(false);`), add:

```javascript
  const [todos, setTodos] = useState([]);
  const [newTodoText, setNewTodoText] = useState('');
  const [activeTodoBucket, setActiveTodoBucket] = useState('today');
  const [editingTodoId, setEditingTodoId] = useState(null);
  const [editTodoText, setEditTodoText] = useState('');
  const [todosLoading, setTodosLoading] = useState(false);
```

- [ ] **Step 3: Add the fetch effect (with lazy stale cleanup)**

In `App.js`, immediately after the notes-fetching `useEffect` (the one ending `}, [user]);` around line 180), add:

```javascript
  // Fetch todos when user changes; lazily delete completed todos older than the
  // 7-day visibility window so the collection stays tidy.
  useEffect(() => {
    const fetchTodos = async () => {
      if (user) {
        setTodosLoading(true);
        try {
          const userTodosRef = collection(db, 'users', user.uid, 'todos');
          const querySnapshot = await getDocs(userTodosRef);
          const fetchedTodos = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          const nowMs = Date.now();
          const stale = fetchedTodos.filter(t => !isTodoVisible(t, nowMs));
          await Promise.all(
            stale.map(t => deleteDoc(doc(db, 'users', user.uid, 'todos', t.id)))
          );
          setTodos(fetchedTodos.filter(t => isTodoVisible(t, nowMs)));
        } catch (error) {
          console.error('Error fetching todos:', error);
        } finally {
          setTodosLoading(false);
        }
      } else {
        setTodos([]);
      }
    };
    fetchTodos();
  }, [user]);
```

- [ ] **Step 4: Add the todo handlers**

In `App.js`, add these handlers after `addNote` (before `toggleStickyNote`, around line 373):

```javascript
  const addTodo = async () => {
    if (!user) return;
    const text = newTodoText.trim();
    if (!text) return;
    try {
      const userTodosRef = collection(db, 'users', user.uid, 'todos');
      const order = todos.filter(t => t.bucket === activeTodoBucket && !t.completed).length;
      const newTodoData = {
        text,
        bucket: activeTodoBucket,
        completed: false,
        completedAt: null,
        createdAt: Timestamp.now(),
        order,
      };
      const docRef = await addDoc(userTodosRef, newTodoData);
      setTodos([...todos, { id: docRef.id, ...newTodoData }]);
      setNewTodoText('');
    } catch (error) {
      console.error('Error adding todo:', error);
    }
  };

  const toggleTodoComplete = async (todoId) => {
    if (!user) return;
    const todo = todos.find(t => t.id === todoId);
    if (!todo) return;
    const completed = !todo.completed;
    const completedAt = completed ? Timestamp.now() : null;
    try {
      const todoRef = doc(db, 'users', user.uid, 'todos', todoId);
      await updateDoc(todoRef, { completed, completedAt });
      setTodos(todos.map(t => t.id === todoId ? { ...t, completed, completedAt } : t));
    } catch (error) {
      console.error('Error toggling todo:', error);
    }
  };

  const startEditTodo = (todo) => {
    setEditingTodoId(todo.id);
    setEditTodoText(todo.text);
  };

  const saveEditTodo = async () => {
    if (!user) return;
    const text = editTodoText.trim();
    if (!text) return;
    try {
      const todoRef = doc(db, 'users', user.uid, 'todos', editingTodoId);
      await updateDoc(todoRef, { text });
      setTodos(todos.map(t => t.id === editingTodoId ? { ...t, text } : t));
      setEditingTodoId(null);
      setEditTodoText('');
    } catch (error) {
      console.error('Error updating todo:', error);
    }
  };

  const cancelEditTodo = () => {
    setEditingTodoId(null);
    setEditTodoText('');
  };

  const deleteTodo = async (todoId) => {
    if (!user) return;
    try {
      const todoRef = doc(db, 'users', user.uid, 'todos', todoId);
      await deleteDoc(todoRef);
      setTodos(todos.filter(t => t.id !== todoId));
    } catch (error) {
      console.error('Error deleting todo:', error);
    }
  };

  const moveTodoToBucket = async (todoId, bucket) => {
    if (!user) return;
    const todo = todos.find(t => t.id === todoId);
    if (!todo || todo.bucket === bucket) return;
    const order = todos.filter(t => t.bucket === bucket && !t.completed).length;
    try {
      const todoRef = doc(db, 'users', user.uid, 'todos', todoId);
      await updateDoc(todoRef, { bucket, order });
      setTodos(todos.map(t => t.id === todoId ? { ...t, bucket, order } : t));
    } catch (error) {
      console.error('Error moving todo:', error);
    }
  };

  const reorderTodos = async (bucket, orderedIds) => {
    if (!user) return;
    const orderMap = new Map(orderedIds.map((id, index) => [id, index]));
    setTodos(todos.map(t => orderMap.has(t.id) ? { ...t, order: orderMap.get(t.id) } : t));
    try {
      await Promise.all(
        orderedIds.map((id, index) =>
          updateDoc(doc(db, 'users', user.uid, 'todos', id), { order: index })
        )
      );
    } catch (error) {
      console.error('Error reordering todos:', error);
    }
  };
```

- [ ] **Step 5: Render `<TodoList>` in the left column**

In `App.js`, in the JSX, insert `<TodoList>` between the closing `</div>` of `.input-and-nav` and the `<StickyNotes ...>` element (after line 454, before line 455):

```javascript
            <TodoList
              todos={todos}
              todosLoading={todosLoading}
              activeTodoBucket={activeTodoBucket}
              setActiveTodoBucket={setActiveTodoBucket}
              newTodoText={newTodoText}
              setNewTodoText={setNewTodoText}
              addTodo={addTodo}
              toggleTodoComplete={toggleTodoComplete}
              editingTodoId={editingTodoId}
              editTodoText={editTodoText}
              setEditTodoText={setEditTodoText}
              startEditTodo={startEditTodo}
              saveEditTodo={saveEditTodo}
              cancelEditTodo={cancelEditTodo}
              deleteTodo={deleteTodo}
              moveTodoToBucket={moveTodoToBucket}
              reorderTodos={reorderTodos}
            />
```

- [ ] **Step 6: Verify the full test suite and build pass**

Run: `npm test -- --watchAll=false`
Expected: PASS — all existing tests plus Task 1 & 2 tests green.

Run: `CI=true npm run build`
Expected: `Compiled successfully` (ESLint `react-app` config must report no errors — unused imports/vars fail the build).

- [ ] **Step 7: Commit**

```bash
git add src/App.js
git commit -m "feat: wire todo section into App (state, fetch, handlers, render)"
```

---

## Task 4: Style the todo section

**Files:**
- Modify: `src/App.css`

**Interfaces:**
- Consumes: the class names emitted by Task 2 — `.todo-section`, `.todo-tabs`, `.todo-tab`(`.active`), `.todo-input`, `.todo-list`, `.todo-item`(`.completed`, `.dragging`, `.drag-over`), `.todo-check`, `.todo-text`, `.todo-bucket-select`, `.delete-todo-btn`, `.todo-edit`, `.todo-edit-actions`. Reuses existing `.hover-delete`, `.state-message`, `.empty-state`.
- Produces: visual styling only.

- [ ] **Step 1: Append the styles**

Append to the end of `src/App.css`:

```css
/* Todo section */
.todo-section {
  margin-top: 24px;
}

.todo-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 12px;
}

.todo-tab {
  flex: 1;
  padding: 6px 10px;
  background: transparent;
  border: 1px solid #e5e3df;
  border-radius: 6px;
  color: #8a8780;
  font-size: 0.85rem;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}

.todo-tab:hover {
  border-color: #cfccc5;
  color: #5a5852;
}

.todo-tab.active {
  background: #5a5852;
  border-color: #5a5852;
  color: #faf9f7;
}

.todo-input {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.todo-input input {
  flex: 1;
  padding: 8px 10px;
  border: 1px solid #e5e3df;
  border-radius: 6px;
  font-size: 0.9rem;
}

.todo-input button {
  padding: 8px 14px;
  background: #5a5852;
  color: #faf9f7;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
}

.todo-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.todo-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 6px;
  border-bottom: 1px solid #f0eee9;
}

.todo-item.dragging {
  opacity: 0.4;
}

.todo-item.drag-over {
  border-top: 2px solid #5a5852;
}

.todo-check {
  flex-shrink: 0;
  cursor: pointer;
}

.todo-text {
  flex: 1;
  cursor: text;
  font-size: 0.9rem;
  color: #3a3833;
  word-break: break-word;
}

.todo-item.completed .todo-text {
  text-decoration: line-through;
  color: #b4b1aa;
}

.todo-bucket-select {
  flex-shrink: 0;
  padding: 2px 4px;
  border: 1px solid #e5e3df;
  border-radius: 4px;
  background: #faf9f7;
  color: #8a8780;
  font-size: 0.75rem;
  cursor: pointer;
}

.delete-todo-btn {
  flex-shrink: 0;
  background: transparent;
  border: none;
  color: #b4b1aa;
  cursor: pointer;
  font-size: 0.85rem;
  padding: 2px 6px;
}

.delete-todo-btn:hover {
  color: #c0392b;
}

.todo-edit {
  display: flex;
  gap: 8px;
  width: 100%;
}

.todo-edit input {
  flex: 1;
  padding: 6px 8px;
  border: 1px solid #cfccc5;
  border-radius: 6px;
  font-size: 0.9rem;
}

.todo-edit-actions {
  display: flex;
  gap: 4px;
}

.todo-edit-actions button {
  background: transparent;
  border: 1px solid #e5e3df;
  border-radius: 6px;
  cursor: pointer;
  padding: 4px 8px;
}
```

- [ ] **Step 2: Verify the build still passes**

Run: `CI=true npm run build`
Expected: `Compiled successfully`.

- [ ] **Step 3: Manual smoke check (optional but recommended)**

Run: `npm start`, sign in, and verify: tabs switch buckets; adding a todo lands it in the active tab; checking it strikes it through and sinks it; editing/deleting/moving work; dragging reorders incomplete todos.

- [ ] **Step 4: Commit**

```bash
git add src/App.css
git commit -m "style: add todo section styling (Muji-minimal)"
```

---

## Self-Review Notes

- **Spec coverage:** placement (Task 3 Step 5), per-doc persistence (Task 3 Steps 3-4), data model incl. `order`/`completedAt` (Tasks 1 & 3), tabs + default Today (Tasks 2 & 3), add to active bucket (Task 3 Step 4), inline edit / delete / checkbox / bucket dropdown (Task 2), strikethrough + sink to bottom (Tasks 1 & 4), 7-day fade-out + lazy delete (Tasks 1 & 3), drag-reorder within bucket (Task 2), sort order (Task 1), loading/empty states (Task 2), styling (Task 4), tests for helpers + component (Tasks 1 & 2). All covered.
- **Naming consistency:** prop names in Task 2's `produces` block match exactly what Task 3 Step 5 passes; helper names (`isTodoVisible`, `sortBucketTodos`, `TODO_BUCKETS`) match across tasks.
- **Checkbox class:** uses `.todo-check` (not `.todo-checkbox`) to avoid any overlap with the note-checkbox change handler in `RegularNotes`.
