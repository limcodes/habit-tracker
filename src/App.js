import React, { useState, useEffect } from 'react';
import { format, eachDayOfInterval, isToday, parseISO, differenceInDays, startOfWeek, addDays, subDays, isBefore, startOfDay } from 'date-fns';
import { addDoc, collection, query, getDocs, orderBy, Timestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { auth, db, signInWithGoogle, signOutUser, saveHabitsToFirestore, fetchHabitsFromFirestore } from './firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import './App.css';

// Import components
import HabitsTable from './components/HabitsTable';
import AddNewHabit from './components/AddNewHabit';
import AddNotes from './components/AddNotes';
import RegularNotes from './components/RegularNotes';
import StickyNotes from './components/StickyNotes';

// Import utilities
import { parseNoteText } from './utils/textFormatter';

function App() {
  const today = new Date();
  const [currentPeriodEndDate, setCurrentPeriodEndDate] = useState(today);
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
  const [stickyNoteId, setStickyNoteId] = useState(null);

  const goToPreviousWeek = () => {
    setCurrentPeriodEndDate(subDays(currentPeriodEndDate, 7));
  };

  const goToNextWeek = () => {
    const potentialNextEndDate = addDays(currentPeriodEndDate, 7);
    if (isBefore(today, potentialNextEndDate)) {
      setCurrentPeriodEndDate(today);
    } else {
      setCurrentPeriodEndDate(potentialNextEndDate);
    }
  };

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

  const updateNoteCheckbox = async (noteId, updatedText) => {
    if (!user) return;

    try {
      // Update note in Firestore
      const userNotesRef = collection(db, 'users', user.uid, 'notes');
      const noteDocRef = doc(userNotesRef, noteId);
      
      await updateDoc(noteDocRef, {
        text: updatedText
      });

      // Update local state
      const updatedNotes = notes.map(note => 
        note.id === noteId 
          ? { ...note, text: updatedText } 
          : note
      );
      setNotes(updatedNotes);
    } catch (error) {
      console.error('Error updating checkbox:', error);
    }
  };

  const calculateStreak = (completedDays) => {
    if (!completedDays || completedDays.length === 0) return 0;
    
    // Sort completed days in descending order
    const sortedDays = completedDays.sort((a, b) => new Date(b) - new Date(a));
    
    // Get today and yesterday's dates
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const dayBeforeYesterday = new Date(today);
    dayBeforeYesterday.setDate(today.getDate() - 2);
    
    const todayString = format(today, 'yyyy-MM-dd');
    const yesterdayString = format(yesterday, 'yyyy-MM-dd');
    const dayBeforeYesterdayString = format(dayBeforeYesterday, 'yyyy-MM-dd');
    
    // Check if the habit was completed today, yesterday, or the day before yesterday
    const wasCompletedToday = completedDays.includes(todayString);
    const wasCompletedYesterday = completedDays.includes(yesterdayString);
    const wasCompletedDayBeforeYesterday = completedDays.includes(dayBeforeYesterdayString);
    
    // If completed today but not in previous two days, return 1
    if (wasCompletedToday && !wasCompletedYesterday && !wasCompletedDayBeforeYesterday) {
      return 1;
    }
    
    // If not completed in the last two days, reset streak
    if (!wasCompletedYesterday && !wasCompletedDayBeforeYesterday) {
      return 0;
    }
    
    let currentStreak = 0;
    let lastDate = parseISO(sortedDays[0]);
    
    // Start from the most recent day
    for (let i = 0; i < sortedDays.length; i++) {
      const currentDate = parseISO(sortedDays[i]);
      
      // If this is the first iteration or the date is exactly one day before the last date
      if (i === 0 || differenceInDays(lastDate, currentDate) === 1) {
        currentStreak++;
        lastDate = currentDate;
      } else {
        // Streak is broken
        break;
      }
    }
    
    return currentStreak;
  };

  const addNote = async () => {
    if (!user) return;
    if (newNote.trim()) {
      try {
        const userNotesRef = collection(db, 'users', user.uid, 'notes');
        const newNoteData = {
          text: newNote,
          date: selectedNoteDate,
          createdAt: Timestamp.now(),
          isSticky: false
        };
        const docRef = await addDoc(userNotesRef, newNoteData);
        setNotes([{ id: docRef.id, ...newNoteData }, ...notes]);
        setNewNote('');
      } catch (error) {
        console.error('Error adding note:', error);
      }
    }
  };

  const toggleStickyNote = async (noteId) => {
    if (!user) return;
    try {
      const updatedNotes = notes.map(note => {
        if (note.id === noteId) {
          return { ...note, isSticky: !note.isSticky };
        }
        return note;
      });

      // Update in Firestore
      const noteRef = doc(db, 'users', user.uid, 'notes', noteId);
      await updateDoc(noteRef, { isSticky: !notes.find(n => n.id === noteId).isSticky });

      setNotes(updatedNotes);
      setStickyNoteId(noteId === stickyNoteId ? null : noteId);
    } catch (error) {
      console.error('Error toggling sticky note:', error);
    }
  };

  const handleSignIn = async () => {
    await signInWithGoogle();
  };

  const handleSignOut = async () => {
    await signOutUser();
  };

  // Generate days (1 future day + today + last 5 days = 7 days total)
  const displayedDays = eachDayOfInterval({ start: subDays(currentPeriodEndDate, 5), end: addDays(currentPeriodEndDate, 1) });

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
            <HabitsTable 
              habits={habits}
              displayedDays={displayedDays}
              toggleHabitCompletion={toggleHabitCompletion}
              startEditHabit={startEditHabit}
              deleteHabit={deleteHabit}
              editingHabitId={editingHabitId}
              editHabitName={editHabitName}
              setEditHabitName={setEditHabitName}
              saveEditHabit={saveEditHabit}
              cancelEditHabit={cancelEditHabit}
              calculateStreak={calculateStreak}
            />
            <div className="input-and-nav">
              <div className="week-navigation">
                <button className="week-nav-btn" onClick={goToPreviousWeek}>&lsaquo;</button>
                {isBefore(startOfDay(currentPeriodEndDate), startOfDay(today)) && (
                  <button className="week-nav-btn" onClick={goToNextWeek}>&rsaquo;</button>
                )}
              </div>
              <AddNewHabit 
                newHabitName={newHabitName}
                setNewHabitName={setNewHabitName}
                addHabit={addHabit}
              />
            </div>
            <StickyNotes 
              notes={notes}
              editingNoteId={editingNoteId}
              selectedNoteDate={selectedNoteDate}
              setSelectedNoteDate={setSelectedNoteDate}
              editNoteText={editNoteText}
              setEditNoteText={setEditNoteText}
              saveEditNote={saveEditNote}
              cancelEditNote={cancelEditNote}
              startEditNote={startEditNote}
              deleteNote={deleteNote}
              toggleStickyNote={toggleStickyNote}
              updateNoteCheckbox={updateNoteCheckbox}
              parseNoteText={parseNoteText}
            />
          </div>
          <div className="notes-section">
            <AddNotes 
              selectedNoteDate={selectedNoteDate}
              setSelectedNoteDate={setSelectedNoteDate}
              newNote={newNote}
              setNewNote={setNewNote}
              addNote={addNote}
            />
            <RegularNotes 
              notes={notes}
              displayedDays={displayedDays}
              editingNoteId={editingNoteId}
              selectedNoteDate={selectedNoteDate}
              setSelectedNoteDate={setSelectedNoteDate}
              editNoteText={editNoteText}
              setEditNoteText={setEditNoteText}
              saveEditNote={saveEditNote}
              cancelEditNote={cancelEditNote}
              startEditNote={startEditNote}
              deleteNote={deleteNote}
              toggleStickyNote={toggleStickyNote}
              updateNoteCheckbox={updateNoteCheckbox}
              parseNoteText={parseNoteText}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
