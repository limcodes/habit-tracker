import React from 'react';

function AddNewHabit({ newHabitName, setNewHabitName, addHabit }) {
  return (
    <div className="habit-input">
      <input
        type="text"
        value={newHabitName}
        onChange={(e) => setNewHabitName(e.target.value)}
        placeholder="Enter a new habit"
      />
      <button onClick={addHabit}>Add Habit</button>
    </div>
  );
}

export default AddNewHabit;
