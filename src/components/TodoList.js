import React, { useRef, useState } from 'react';
import { isTodoVisible, sortBucketTodos, TODO_BUCKETS } from '../utils/todoUtils';

const BUCKET_LABELS = { inbox: 'Inbox', today: 'Today', tomorrow: 'Tomorrow', anytime: 'Anytime', done: 'Done' };

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
  const [draggedId, setDraggedId] = useState(null);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [dragOverBucket, setDragOverBucket] = useState(null);
  const viewSnapshotRef = useRef({ bucket: null, loading: null, completedIds: new Set() });

  const nowMs = Date.now();
  const visibleTodos = todos.filter((t) => t.bucket === activeTodoBucket && isTodoVisible(t, nowMs));

  // "Completed-at-view" snapshot. A checked item only sinks to the bottom of the
  // list once the view is (re)entered or freshly loaded — not the instant you
  // check it. We freeze which ids count as completed for sorting and recompute
  // that set only when the active bucket changes or a fetch finishes (loading
  // true→false). Toggling completion mid-view leaves the snapshot untouched, so a
  // just-checked item stays in place (crossed out) until you switch tabs or refresh.
  const snap = viewSnapshotRef.current;
  const loadFinished = snap.loading === true && todosLoading === false;
  if (snap.bucket !== activeTodoBucket || loadFinished) {
    viewSnapshotRef.current = {
      bucket: activeTodoBucket,
      loading: todosLoading,
      completedIds: new Set(visibleTodos.filter((t) => t.completed).map((t) => t.id)),
    };
  } else {
    snap.loading = todosLoading;
  }
  const completedAtView = (t) => viewSnapshotRef.current.completedIds.has(t.id);

  const bucketTodos = sortBucketTodos(visibleTodos, completedAtView);
  // Drag-reorder applies only to the (live) incomplete todos in this bucket; their
  // position in this array is the index used by the reorder handlers.
  const incompleteTodos = bucketTodos.filter((t) => !t.completed);

  const clearDragState = () => {
    setDraggedId(null);
    setDraggedIndex(null);
    setDragOverIndex(null);
    setDragOverBucket(null);
  };

  const handleDragStart = (e, todo, index) => {
    setDraggedId(todo.id);
    setDraggedIndex(index);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
  };

  // --- Reorder within the active bucket (drop onto a list row) ---
  const handleRowDragOver = (e, index) => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    if (index !== draggedIndex) setDragOverIndex(index);
  };

  const handleRowDragLeave = () => setDragOverIndex(null);

  const handleRowDrop = (e, dropIndex) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      clearDragState();
      return;
    }
    const reordered = [...incompleteTodos];
    const [moved] = reordered.splice(draggedIndex, 1);
    reordered.splice(dropIndex, 0, moved);
    reorderTodos(activeTodoBucket, reordered.map((t) => t.id));
    clearDragState();
  };

  // --- Move to another bucket (drop onto a tab) ---
  // Done is reachable only via the auto-sweep, never by dragging an active todo in.
  const handleTabDragOver = (e, bucket) => {
    if (draggedId === null || bucket === 'done') return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    setDragOverBucket(bucket);
  };

  const handleTabDragLeave = () => setDragOverBucket(null);

  const handleTabDrop = (e, bucket) => {
    e.preventDefault();
    if (draggedId !== null && bucket !== 'done') moveTodoToBucket(draggedId, bucket);
    clearDragState();
  };

  const handleDragEnd = () => clearDragState();

  return (
    <div className="todo-section">
      <div className="todo-tabs" role="tablist">
        {TODO_BUCKETS.map((bucket) => (
          <button
            key={bucket}
            role="tab"
            aria-selected={activeTodoBucket === bucket}
            className={`todo-tab ${activeTodoBucket === bucket ? 'active' : ''} ${dragOverBucket === bucket ? 'drag-over' : ''}`}
            onClick={() => setActiveTodoBucket(bucket)}
            onDragOver={(e) => handleTabDragOver(e, bucket)}
            onDragLeave={handleTabDragLeave}
            onDrop={(e) => handleTabDrop(e, bucket)}
          >
            {BUCKET_LABELS[bucket]}
          </button>
        ))}
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
            const isDragging = isDraggable && draggedId === t.id;
            const isDragOver = isDraggable && dragOverIndex === incompleteIndex;
            return (
              <li
                key={t.id}
                className={`todo-item ${t.completed ? 'completed' : ''} ${isDragging ? 'dragging' : ''} ${isDragOver ? 'drag-over' : ''}`}
                draggable={isDraggable}
                onDragStart={isDraggable ? (e) => handleDragStart(e, t, incompleteIndex) : undefined}
                onDragOver={isDraggable ? (e) => handleRowDragOver(e, incompleteIndex) : undefined}
                onDragLeave={isDraggable ? handleRowDragLeave : undefined}
                onDrop={isDraggable ? (e) => handleRowDrop(e, incompleteIndex) : undefined}
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
                      <button onClick={saveEditTodo}>Save</button>
                      <button onClick={cancelEditTodo}>Cancel</button>
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
                    <button
                      className="delete-todo-btn"
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

      {activeTodoBucket !== 'done' && (
        <div className="todo-input">
          <input
            type="text"
            value={newTodoText}
            onChange={(e) => setNewTodoText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addTodo(); }}
            placeholder="Add a todo"
            aria-label="New todo"
          />
          <button onClick={addTodo}>Add Todo</button>
        </div>
      )}
    </div>
  );
}

export default TodoList;
