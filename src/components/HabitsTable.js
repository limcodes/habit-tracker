import React from 'react';
import { format, isToday } from 'date-fns';

function HabitsTable({ 
  habits, 
  displayedDays, 
  toggleHabitCompletion, 
  startEditHabit, 
  deleteHabit,
  editingHabitId,
  editHabitName,
  setEditHabitName,
  saveEditHabit,
  cancelEditHabit,
  calculateStreak
}) {
  return (
    <table className="habit-table">
      <thead>
        <tr>
          <th>Habit</th>
          {displayedDays.map((day, index) => {
            const dateString = format(day, 'yyyy-MM-dd');
            const isCurrentDay = isToday(day);
            return (
              <th 
                key={dateString} 
                className={`date-header ${isCurrentDay ? 'today' : ''}`}>
                <div className="day-header">
                  <span className="day-of-week">{format(day, 'EEE')}</span>
                  <br />
                  <span className="day-of-month">{format(day, 'd')}</span>
                </div>
              </th>
            );
          })}
          <th className="date-header last-column"></th>
        </tr>
      </thead>
      <tbody>
        {habits.map(habit => (
          <tr key={habit.id}>
            <td>
              {editingHabitId === habit.id ? (
                <div className="habit-edit">
                  <input
                    type="text"
                    value={editHabitName}
                    onChange={(e) => setEditHabitName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEditHabit();
                      if (e.key === 'Escape') cancelEditHabit();
                    }}
                    autoFocus
                  />
                  <div className="habit-edit-actions">
                    <button onClick={saveEditHabit}>Save</button>
                    <button onClick={cancelEditHabit}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="habit-name">
                  <span onClick={() => startEditHabit(habit)}>{habit.name}</span>
                  <button 
                    className="delete-habit-btn hover-delete" 
                    onClick={() => deleteHabit(habit.id)}
                  >✕</button>
                </div>
              )}
            </td>
            {displayedDays.map((day, index) => {
              const dateString = format(day, 'yyyy-MM-dd');
              const isCompleted = habit.completedDays.includes(dateString);
              const isCurrentDay = isToday(day);
              return (
                <td
                  key={dateString}
                  className={`habit-day ${isCompleted ? 'completed' : ''} ${isCurrentDay ? 'today' : ''}`}
                  onClick={() => toggleHabitCompletion(habit.id, dateString)}
                >
                  {isCompleted ? ' ' : ''}
                </td>
              );
            })}
            <td className="habit-day habit-streak last-column">{calculateStreak(habit.completedDays)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default HabitsTable;
