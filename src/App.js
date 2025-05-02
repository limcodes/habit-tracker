import React, { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday } from 'date-fns';
import { auth, signInWithGoogle, signOutUser, saveHabitsToFirestore, fetchHabitsFromFirestore } from './firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import './App.css';

function App() {
  const [user] = useAuthState(auth);
  const [habits, setHabits] = useState([]);
  const [newHabitName, setNewHabitName] = useState('');
  const [editingHabitId, setEditingHabitId] = useState(null);
  const [editHabitName, setEditHabitName] = useState('');
  const today = new Date();

  // Fetch habits when user changes
  useEffect(() => {
    const fetchHabits = async () => {
      if (user) {
        const fetchedHabits = await fetchHabitsFromFirestore(user.uid);
        setHabits(fetchedHabits);
      } else {
        setHabits([]);
      }
    };
    fetchHabits();
  }, [user]);

  // Save habits to Firestore whenever they change
  useEffect(() => {
    const saveHabits = async () => {
      if (user) {
        await saveHabitsToFirestore(user.uid, habits);
      }
    };
    saveHabits();
  }, [habits, user]);

  const addHabit = () => {
    if (!user) return;
    if (newHabitName.trim()) {
      const newHabit = {
        id: `habit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: newHabitName,
        completedDays: []
      };
      setHabits([...habits, newHabit]);
      setNewHabitName('');
    }
  };

  const toggleHabitCompletion = (habitId, dateString) => {
    if (!user) return;
    const updatedHabits = habits.map(habit => {
      if (habit.id === habitId) {
        const completedDays = habit.completedDays.includes(dateString)
          ? habit.completedDays.filter(day => day !== dateString)
          : [...habit.completedDays, dateString];
        return { ...habit, completedDays };
      }
      return habit;
    });
    setHabits(updatedHabits);
  };

  const deleteHabit = (habitId) => {
    if (!user) return;
    setHabits(habits.filter(habit => habit.id !== habitId));
  };

  const startEditHabit = (habit) => {
    setEditingHabitId(habit.id);
    setEditHabitName(habit.name);
  };

  const saveEditHabit = () => {
    if (!editHabitName.trim()) return;

    const updatedHabits = habits.map(habit => 
      habit.id === editingHabitId 
        ? { ...habit, name: editHabitName.trim() } 
        : habit
    );

    setHabits(updatedHabits);
    setEditingHabitId(null);
    setEditHabitName('');
  };

  const cancelEditHabit = () => {
    setEditingHabitId(null);
    setEditHabitName('');
  };

  const handleSignIn = async () => {
    await signInWithGoogle();
  };

  const handleSignOut = async () => {
    await signOutUser();
  };

  const monthDays = eachDayOfInterval({
    start: startOfMonth(today),
    end: endOfMonth(today)
  });

  return (
    <div className="App">
      <header>
        <h2>Simple Habits</h2>
        {user ? (
          <div className="user-info">
            <span>{user.email}</span>
            <button onClick={handleSignOut}>Sign Out</button>
          </div>
        ) : (
          <button onClick={handleSignIn}>Sign In with Google</button>
        )}
      </header>

      {user && (
        <>
          <div className="habit-input">
            <input
              type="text"
              value={newHabitName}
              onChange={(e) => setNewHabitName(e.target.value)}
              placeholder="Enter a new habit"
            />
            <button onClick={addHabit}>Add Habit</button>
          </div>
          <table className="habit-table">
            <thead>
              <tr>
                <th>Habit</th>
                {monthDays.map(day => {
                  const dateString = format(day, 'yyyy-MM-dd');
                  const isCurrentDay = isToday(day);
                  return (
                    <th 
                      key={dateString} 
                      className={isCurrentDay ? 'today-column' : ''}
                    >
                      {format(day, 'd')}
                    </th>
                  );
                })}
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
                          className="delete-habit-btn" 
                          onClick={() => deleteHabit(habit.id)}
                        >✕</button>
                      </div>
                    )}
                  </td>
                  {monthDays.map(day => {
                    const dateString = format(day, 'yyyy-MM-dd');
                    const isCompleted = habit.completedDays.includes(dateString);
                    const isCurrentDay = isToday(day);
                    return (
                      <td
                        key={dateString}
                        className={`habit-cell ${isCompleted ? 'completed' : ''} ${isCurrentDay ? 'today-column' : ''}`}
                        onClick={() => toggleHabitCompletion(habit.id, dateString)}
                      >
                        {isCompleted ? '✓' : ''}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

export default App;
