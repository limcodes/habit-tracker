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
