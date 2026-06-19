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
