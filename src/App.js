import React, { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday } from 'date-fns';
import { addDoc, collection, query, getDocs, orderBy, Timestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { auth, db, signInWithGoogle, signOutUser, saveHabitsToFirestore, fetchHabitsFromFirestore } from './firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import './App.css';

function App() {
  const today = new Date();
  const [user] = useAuthState(auth);
  const [habits, setHabits] = useState([]);
  const [newHabitName, setNewHabitName] = useState('');
  const [editingHabitId, setEditingHabitId] = useState(null);
  const [editHabitName, setEditHabitName] = useState('');
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [selectedNoteDate, setSelectedNoteDate] = useState(format(today, 'yyyy-MM-dd'));
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editNoteText, setEditNoteText] = useState('');

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

  // Save habits to Firestore with debounce
  useEffect(() => {
    let timeoutId;
    const saveHabits = async () => {
      if (user) {
        try {
          await saveHabitsToFirestore(user.uid, habits);
        } catch (error) {
          console.error('Failed to save habits:', error);
          // Optionally show a user-friendly error notification
        }
      }
    };

    // Debounce save to reduce unnecessary Firestore writes
    if (user) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(saveHabits, 500); // 500ms delay
    }

    // Cleanup timeout on component unmount or dependency change
    return () => clearTimeout(timeoutId);
  }, [habits, user]);

  // Fetch notes when user changes
  useEffect(() => {
    const fetchNotes = async () => {
      if (user) {
        try {
          const userNotesRef = collection(db, 'users', user.uid, 'notes');
          const q = query(userNotesRef, orderBy('createdAt', 'desc'));
          const querySnapshot = await getDocs(q);
          const fetchedNotes = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setNotes(fetchedNotes);
        } catch (error) {
          console.error('Error fetching notes:', error);
        }
      } else {
        setNotes([]);
      }
    };
    fetchNotes();
  }, [user]);

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

  const startEditNote = (note) => {
    setEditingNoteId(note.id);
    setEditNoteText(note.text);
    setSelectedNoteDate(note.date);
  };

  const saveEditNote = async () => {
    if (!user) return;
    if (!editNoteText.trim()) return;

    try {
      // Update note in Firestore
      const userNotesRef = collection(db, 'users', user.uid, 'notes');
      const noteDocRef = doc(userNotesRef, editingNoteId);
      
      await updateDoc(noteDocRef, {
        text: editNoteText.trim(),
        date: selectedNoteDate
      });

      // Update local state
      const updatedNotes = notes.map(note => 
        note.id === editingNoteId 
          ? { ...note, text: editNoteText.trim(), date: selectedNoteDate } 
          : note
      );
      setNotes(updatedNotes);

      // Reset editing state
      setEditingNoteId(null);
      setEditNoteText('');
    } catch (error) {
      console.error('Error updating note:', error);
    }
  };

  const deleteNote = async (noteId) => {
    if (!user) return;

    try {
      // Delete note from Firestore
      const userNotesRef = collection(db, 'users', user.uid, 'notes');
      const noteDocRef = doc(userNotesRef, noteId);
      
      await deleteDoc(noteDocRef);

      // Update local state
      const updatedNotes = notes.filter(note => note.id !== noteId);
      setNotes(updatedNotes);
    } catch (error) {
      console.error('Error deleting note:', error);
    }
  };

  const cancelEditNote = () => {
    setEditingNoteId(null);
    setEditNoteText('');
  };

  const addNote = async () => {
    if (!user) return;
    if (!newNote.trim()) return;

    try {
      const userNotesRef = collection(db, 'users', user.uid, 'notes');
      const noteData = {
        text: newNote.trim(),
        date: selectedNoteDate,
        createdAt: Timestamp.now()
      };
      
      const docRef = await addDoc(userNotesRef, noteData);
      
      // Update local state
      setNotes([{ id: docRef.id, ...noteData }, ...notes]);
      
      // Reset input
      setNewNote('');
    } catch (error) {
      console.error('Error adding note:', error);
    }
  };

  const handleSignIn = async () => {
    await signInWithGoogle();
  };

  const handleSignOut = async () => {
    await signOutUser();
  };

  // Generate days (past 5 and future 5)
  const monthDays = eachDayOfInterval({
    start: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7),
    end: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
  });

  return (
    <div className="App">
      <header>
        <h2>Habits Log</h2>
        {user ? (
          <div className="user-info">
            <span>Signed in as {user.email}</span>
            <button onClick={handleSignOut}>Sign Out</button>
          </div>
        ) : (
          <button onClick={handleSignIn}>Sign In with Google</button>
        )}
      </header>

      {user && (
        <div className="habit-container">
          <div className="habit-list">
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
                        className={`date-cell ${isCurrentDay ? 'today-column' : ''}`}
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
                            className="delete-habit-btn hover-delete" 
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
                          className={`habit-cell date-cell ${isCompleted ? 'completed' : ''} ${isCurrentDay ? 'today-column' : ''}`}
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
            <div className="habit-input">
              <input
                type="text"
                value={newHabitName}
                onChange={(e) => setNewHabitName(e.target.value)}
                placeholder="Enter a new habit"
              />
              <button onClick={addHabit}>Add Habit</button>
            </div>              
          </div>
          <div className="notes-section">
            <div className="notes-input">
              <input
                type="date"
                value={selectedNoteDate}
                onChange={(e) => setSelectedNoteDate(e.target.value)}
              />
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Write your daily log here..."
                rows="3"
              />
              <button onClick={addNote}>Add Log</button>
            </div>

            <div className="notes-list">
              {notes.map((note) => (
                <div key={note.id} className="note-item">
                  {editingNoteId === note.id ? (
                    <div className="note-edit">
                      <input
                        type="date"
                        value={selectedNoteDate}
                        onChange={(e) => setSelectedNoteDate(e.target.value)}
                      />
                      <textarea
                        value={editNoteText}
                        onChange={(e) => setEditNoteText(e.target.value)}
                        rows="3"
                      />
                      <div className="note-edit-actions">
                        <button onClick={saveEditNote}>Save</button>
                        <button onClick={cancelEditNote}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="note-header">
                        <span className="note-date">{note.date}</span>
                        <div className="note-actions hover-actions">
                          <button 
                            className="edit-note-btn" 
                            onClick={() => startEditNote(note)}
                          >✎</button>
                          <button 
                            className="delete-note-btn" 
                            onClick={() => deleteNote(note.id)}
                          >✕</button>
                        </div>
                      </div>
                      <p className="note-text">{note.text}</p>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
