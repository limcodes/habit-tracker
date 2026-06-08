import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { format } from 'date-fns';
import App, { calculateStreak } from './App';
import { useAuthState } from 'react-firebase-hooks/auth';
import { fetchHabitsFromFirestore } from './firebase';
import * as firestore from 'firebase/firestore';

// Mock the data layer (the real ./firebase throws without env vars).
jest.mock('./firebase');
jest.mock('react-firebase-hooks/auth', () => ({ useAuthState: jest.fn() }));

// App.js also imports raw firebase/firestore helpers for note CRUD.
jest.mock('firebase/firestore', () => ({
  addDoc: jest.fn().mockResolvedValue({ id: 'note-1' }),
  collection: jest.fn(() => ({})),
  query: jest.fn(() => ({})),
  getDocs: jest.fn().mockResolvedValue({ docs: [] }),
  orderBy: jest.fn(),
  Timestamp: { now: jest.fn(() => 0) },
  doc: jest.fn(() => ({})),
  updateDoc: jest.fn().mockResolvedValue(),
  deleteDoc: jest.fn().mockResolvedValue(),
}));

const todayStr = format(new Date(), 'yyyy-MM-dd');

const dateStr = (offsetDays) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return format(d, 'yyyy-MM-dd');
};

beforeEach(() => {
  // react-scripts sets resetMocks: true — reinstall implementations each test.
  fetchHabitsFromFirestore.mockResolvedValue([]);
  firestore.getDocs.mockResolvedValue({ docs: [] });
  firestore.collection.mockReturnValue({});
  firestore.query.mockReturnValue({});
  firestore.doc.mockReturnValue({});
});

describe('App rendering', () => {
  test('shows sign-in when signed out', () => {
    useAuthState.mockReturnValue([null]);
    render(<App />);
    expect(screen.getByText('Sign In with Google')).toBeInTheDocument();
    expect(screen.queryByText(/Signed in as/)).not.toBeInTheDocument();
  });

  test('shows the sign-out control and empty state when signed in with no habits', async () => {
    useAuthState.mockReturnValue([{ uid: 'u1', email: 'a@b.com' }]);
    render(<App />);
    expect(screen.getByLabelText('Sign out')).toBeInTheDocument();
    expect(await screen.findByText(/No habits yet/)).toBeInTheDocument();
  });
});

describe('tap-cycle interaction', () => {
  test('cycles a day cell empty -> completed -> skipped -> empty', async () => {
    useAuthState.mockReturnValue([{ uid: 'u1', email: 'a@b.com' }]);
    fetchHabitsFromFirestore.mockResolvedValue([
      { id: 'h1', name: 'Read', completedDays: [], skippedDays: [], order: 0 },
    ]);
    const { container } = render(<App />);

    // Wait for the habit row to appear.
    await screen.findByText('Read');

    // Today's cell starts empty.
    const todayCell = container.querySelector('.habit-day.today');
    expect(todayCell).toBeTruthy();
    expect(todayCell.className).not.toMatch(/completed|skipped/);

    fireEvent.click(todayCell);
    expect(container.querySelector('.habit-day.today').className).toMatch(/completed/);

    fireEvent.click(container.querySelector('.habit-day.today'));
    expect(container.querySelector('.habit-day.today').className).toMatch(/skipped/);

    fireEvent.click(container.querySelector('.habit-day.today'));
    const cell = container.querySelector('.habit-day.today');
    expect(cell.className).not.toMatch(/completed|skipped/);
  });

  test('Enter key on a cell cycles it', async () => {
    useAuthState.mockReturnValue([{ uid: 'u1', email: 'a@b.com' }]);
    fetchHabitsFromFirestore.mockResolvedValue([
      { id: 'h1', name: 'Read', completedDays: [], skippedDays: [], order: 0 },
    ]);
    const { container } = render(<App />);
    await screen.findByText('Read');

    const todayCell = container.querySelector('.habit-day.today');
    fireEvent.keyDown(todayCell, { key: 'Enter' });
    expect(container.querySelector('.habit-day.today').className).toMatch(/completed/);
  });
});

describe('calculateStreak', () => {
  test('returns 0 for empty / missing input', () => {
    expect(calculateStreak([])).toBe(0);
    expect(calculateStreak(undefined)).toBe(0);
  });

  test('returns 1 when completed only today', () => {
    expect(calculateStreak([todayStr])).toBe(1);
  });

  test('counts a consecutive run ending today', () => {
    expect(calculateStreak([dateStr(0), dateStr(-1), dateStr(-2)])).toBe(3);
  });

  test('resets when nothing completed in the last two days', () => {
    expect(calculateStreak([dateStr(-10), dateStr(-11)])).toBe(0);
  });

  test('does not mutate its input array', () => {
    const input = [dateStr(-2), dateStr(0), dateStr(-1)];
    const copy = [...input];
    calculateStreak(input);
    expect(input).toEqual(copy);
  });
});
