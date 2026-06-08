import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { format } from 'date-fns';
import HabitsTable from './HabitsTable';

const day = new Date(2025, 0, 15); // fixed, not today
const dayStr = format(day, 'yyyy-MM-dd');

const baseProps = {
  displayedDays: [day],
  cycleHabitDay: jest.fn(),
  startEditHabit: jest.fn(),
  deleteHabit: jest.fn(),
  editingHabitId: null,
  editHabitName: '',
  setEditHabitName: jest.fn(),
  saveEditHabit: jest.fn(),
  cancelEditHabit: jest.fn(),
  calculateStreak: jest.fn(() => 5),
  reorderHabits: jest.fn(),
};

const habits = [
  { id: 'h1', name: 'Read', completedDays: [dayStr], skippedDays: [], order: 0 },
  { id: 'h2', name: 'Run', completedDays: [], skippedDays: [], order: 1 },
];

// react-scripts sets resetMocks: true, wiping implementations before each test.
beforeEach(() => {
  baseProps.calculateStreak.mockReturnValue(5);
});

test('renders a row per habit and the streak value', () => {
  render(<HabitsTable {...baseProps} habits={habits} />);
  expect(screen.getByText('Read')).toBeInTheDocument();
  expect(screen.getByText('Run')).toBeInTheDocument();
  // calculateStreak stub returns 5 for each row.
  expect(screen.getAllByText('5')).toHaveLength(2);
});

test('clicking a day cell calls cycleHabitDay with habit id and date', () => {
  const { container } = render(<HabitsTable {...baseProps} habits={[habits[1]]} />);
  const cell = container.querySelector('.habit-day');
  fireEvent.click(cell);
  expect(baseProps.cycleHabitDay).toHaveBeenCalledWith('h2', dayStr);
});

test('a completed day cell carries the completed class', () => {
  const { container } = render(<HabitsTable {...baseProps} habits={[habits[0]]} />);
  expect(container.querySelector('.habit-day.completed')).toBeTruthy();
});

test('clicking the habit name starts editing', () => {
  render(<HabitsTable {...baseProps} habits={[habits[0]]} />);
  fireEvent.click(screen.getByText('Read'));
  expect(baseProps.startEditHabit).toHaveBeenCalledWith(habits[0]);
});
