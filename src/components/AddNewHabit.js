import React from 'react';

function AddNewHabit({ newHabitName, setNewHabitName, addHabit }) {
  return (
    <div className="habit-input">
      <input
        type="text"
        value={newHabitName}
        onChange={(e) => setNewHabitName(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') addHabit(); }}
        placeholder="Enter a new habit"
        aria-label="New habit name"
      />
      <button onClick={addHabit}>Add Habit</button>
    </div>
  );
}

export default AddNewHabit;
