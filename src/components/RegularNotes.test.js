import React from 'react';
import { render, screen } from '@testing-library/react';
import { format } from 'date-fns';
import RegularNotes from './RegularNotes';
import { parseNoteText } from '../utils/textFormatter';

const day = new Date(2025, 0, 15);
const dayStr = format(day, 'yyyy-MM-dd');

const baseProps = {
  displayedDays: [day],
  editingNoteId: null,
  selectedNoteDate: dayStr,
  setSelectedNoteDate: jest.fn(),
  editNoteText: '',
  setEditNoteText: jest.fn(),
  saveEditNote: jest.fn(),
  cancelEditNote: jest.fn(),
  startEditNote: jest.fn(),
  deleteNote: jest.fn(),
  toggleStickyNote: jest.fn(),
  parseNoteText,
};

beforeEach(() => jest.clearAllMocks());

test('shows empty state when no notes fall in the window', () => {
  render(<RegularNotes {...baseProps} notes={[]} />);
  expect(screen.getByText(/No notes for these days/)).toBeInTheDocument();
});

test('hides sticky notes and notes outside the displayed window', () => {
  const notes = [
    { id: 'n1', text: 'visible', date: dayStr, isSticky: false },
    { id: 'n2', text: 'sticky', date: dayStr, isSticky: true },
    { id: 'n3', text: 'old', date: '2020-01-01', isSticky: false },
  ];
  render(<RegularNotes {...baseProps} notes={notes} />);
  expect(screen.getByText('visible')).toBeInTheDocument();
  expect(screen.queryByText('sticky')).not.toBeInTheDocument();
  expect(screen.queryByText('old')).not.toBeInTheDocument();
});

test('ignores notes with a missing/malformed date', () => {
  const notes = [{ id: 'n1', text: 'no date', isSticky: false }];
  render(<RegularNotes {...baseProps} notes={notes} />);
  expect(screen.queryByText('no date')).not.toBeInTheDocument();
  expect(screen.getByText(/No notes for these days/)).toBeInTheDocument();
});

test('action buttons have accessible labels', () => {
  const notes = [{ id: 'n1', text: 'a note', date: dayStr, isSticky: false }];
  render(<RegularNotes {...baseProps} notes={notes} />);
  expect(screen.getByLabelText('Delete note')).toBeInTheDocument();
  expect(screen.getByLabelText('Pin note')).toBeInTheDocument();
});

test('renders note text with markdown formatting', () => {
  const notes = [{ id: 'n1', text: '**bold**', date: dayStr, isSticky: false }];
  const { container } = render(<RegularNotes {...baseProps} notes={notes} />);
  expect(container.querySelector('.note-text strong')).toBeTruthy();
});
