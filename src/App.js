import React, { useState, useEffect } from 'react';
import { format, eachDayOfInterval, parseISO, differenceInDays, addDays, subDays, isBefore, startOfDay } from 'date-fns';
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
import TodoList from './components/TodoList';

// Import utilities
import { parseNoteText } from './utils/textFormatter';
import { isTodoVisible } from './utils/todoUtils';

// Count consecutive completed days ending at the most recent entry. Exported
// for unit testing. Does not mutate its input.
export const calculateStreak = (completedDays) => {
  if (!completedDays || completedDays.length === 0) return 0;

  // Sort completed days in descending order (clone first — sorting the
  // state array in place would mutate React state).
  const sortedDays = [...completedDays].sort((a, b) => new Date(b) - new Date(a));

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
  const [habitsLoading, setHabitsLoading] = useState(false);
  const [notesLoading, setNotesLoading] = useState(false);
  const [todos, setTodos] = useState([]);
  const [newTodoText, setNewTodoText] = useState('');
  const [activeTodoBucket, setActiveTodoBucket] = useState('today');
  const [editingTodoId, setEditingTodoId] = useState(null);
  const [editTodoText, setEditTodoText] = useState('');
  const [todosLoading, setTodosLoading] = useState(false);
  const habitsLoaded = React.useRef(false);

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
        habitsLoaded.current = false;
        setHabitsLoading(true);
        try {
          const fetchedHabits = await fetchHabitsFromFirestore(user.uid);
          setHabits(fetchedHabits);
          // Only enable saving once a load has actually succeeded — otherwise
          // a failed fetch could let an empty local state overwrite the remote.
          habitsLoaded.current = true;
        } catch (error) {
          console.error('Failed to load habits:', error);
          habitsLoaded.current = false;
        } finally {
          setHabitsLoading(false);
        }
      } else {
        setHabits([]);
        habitsLoaded.current = false;
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

    // Debounce save to reduce unnecessary Firestore writes. The habitsLoaded
    // guard ensures we never persist the initial empty state over remote data
    // before the first successful fetch has populated it.
    if (user && habitsLoaded.current) {
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
        setNotesLoading(true);
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
        } finally {
          setNotesLoading(false);
        }
      } else {
        setNotes([]);
      }
    };
    fetchNotes();
  }, [user]);

  // Fetch todos when user changes; lazily delete completed todos older than the
  // 7-day visibility window so the collection stays tidy.
  useEffect(() => {
    const fetchTodos = async () => {
      if (user) {
        setTodosLoading(true);
        try {
          const userTodosRef = collection(db, 'users', user.uid, 'todos');
          const querySnapshot = await getDocs(userTodosRef);
          const fetchedTodos = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          const nowMs = Date.now();
          const stale = fetchedTodos.filter(t => !isTodoVisible(t, nowMs));
          await Promise.all(
            stale.map(t => deleteDoc(doc(db, 'users', user.uid, 'todos', t.id)))
          );
          setTodos(fetchedTodos.filter(t => isTodoVisible(t, nowMs)));
        } catch (error) {
          console.error('Error fetching todos:', error);
        } finally {
          setTodosLoading(false);
        }
      } else {
        setTodos([]);
      }
    };
    fetchTodos();
  }, [user]);

  const addHabit = () => {
    if (!user) return;
    if (newHabitName.trim()) {
      const newHabit = {
        id: `habit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: newHabitName,
        completedDays: [],
        skippedDays: [], // Track X marks
        order: habits.length // Add order field
      };
      setHabits([...habits, newHabit]);
      setNewHabitName('');
    }
  };

  // Cycle a single day cell through three states on each tap/click:
  // empty -> completed -> skipped -> empty. This replaces the old
  // left-click-to-complete / right-click-to-skip split, which was impossible
  // on touch devices (no right-click). Completed and skipped stay mutually
  // exclusive.
  const cycleHabitDay = (habitId, dateString) => {
    if (!user) return;
    const updatedHabits = habits.map(habit => {
      if (habit.id !== habitId) return habit;

      const completedDays = habit.completedDays || [];
      const skippedDays = habit.skippedDays || [];
      const isCompleted = completedDays.includes(dateString);
      const isSkipped = skippedDays.includes(dateString);

      const withoutDay = {
        completedDays: completedDays.filter(day => day !== dateString),
        skippedDays: skippedDays.filter(day => day !== dateString)
      };

      if (isCompleted) {
        // completed -> skipped
        return { ...habit, ...withoutDay, skippedDays: [...withoutDay.skippedDays, dateString] };
      }
      if (isSkipped) {
        // skipped -> empty
        return { ...habit, ...withoutDay };
      }
      // empty -> completed
      return { ...habit, ...withoutDay, completedDays: [...withoutDay.completedDays, dateString] };
    });
    setHabits(updatedHabits);
  };

  const deleteHabit = (habitId) => {
    if (!user) return;
    setHabits(habits.filter(habit => habit.id !== habitId));
  };

  const reorderHabits = (newHabits) => {
    if (!user) return;
    // Update order field for each habit
    const habitsWithOrder = newHabits.map((habit, index) => ({
      ...habit,
      order: index
    }));
    setHabits(habitsWithOrder);
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
  };

  const saveEditNote = async () => {
    if (!user) return;
    if (!editNoteText.trim()) return;

    try {
      // Update note in Firestore
      const userNotesRef = collection(db, 'users', user.uid, 'notes');
      const noteDocRef = doc(userNotesRef, editingNoteId);
      
      const originalNote = notes.find(n => n.id === editingNoteId);
      const noteDate = originalNote ? originalNote.date : selectedNoteDate;

      await updateDoc(noteDocRef, {
        text: editNoteText.trim(),
        date: noteDate
      });

      // Update local state
      const updatedNotes = notes.map(note => 
        note.id === editingNoteId 
          ? { ...note, text: editNoteText.trim(), date: noteDate } 
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

  const addTodo = async () => {
    if (!user) return;
    const text = newTodoText.trim();
    if (!text) return;
    try {
      const userTodosRef = collection(db, 'users', user.uid, 'todos');
      const order = todos.filter(t => t.bucket === activeTodoBucket && !t.completed).length;
      const newTodoData = {
        text,
        bucket: activeTodoBucket,
        completed: false,
        completedAt: null,
        createdAt: Timestamp.now(),
        order,
      };
      const docRef = await addDoc(userTodosRef, newTodoData);
      setTodos([...todos, { id: docRef.id, ...newTodoData }]);
      setNewTodoText('');
    } catch (error) {
      console.error('Error adding todo:', error);
    }
  };

  const toggleTodoComplete = async (todoId) => {
    if (!user) return;
    const todo = todos.find(t => t.id === todoId);
    if (!todo) return;
    const completed = !todo.completed;
    const completedAt = completed ? Timestamp.now() : null;
    try {
      const todoRef = doc(db, 'users', user.uid, 'todos', todoId);
      await updateDoc(todoRef, { completed, completedAt });
      setTodos(todos.map(t => t.id === todoId ? { ...t, completed, completedAt } : t));
    } catch (error) {
      console.error('Error toggling todo:', error);
    }
  };

  const startEditTodo = (todo) => {
    setEditingTodoId(todo.id);
    setEditTodoText(todo.text);
  };

  const saveEditTodo = async () => {
    if (!user) return;
    const text = editTodoText.trim();
    if (!text) return;
    try {
      const todoRef = doc(db, 'users', user.uid, 'todos', editingTodoId);
      await updateDoc(todoRef, { text });
      setTodos(todos.map(t => t.id === editingTodoId ? { ...t, text } : t));
      setEditingTodoId(null);
      setEditTodoText('');
    } catch (error) {
      console.error('Error updating todo:', error);
    }
  };

  const cancelEditTodo = () => {
    setEditingTodoId(null);
    setEditTodoText('');
  };

  const deleteTodo = async (todoId) => {
    if (!user) return;
    try {
      const todoRef = doc(db, 'users', user.uid, 'todos', todoId);
      await deleteDoc(todoRef);
      setTodos(todos.filter(t => t.id !== todoId));
    } catch (error) {
      console.error('Error deleting todo:', error);
    }
  };

  const moveTodoToBucket = async (todoId, bucket) => {
    if (!user) return;
    const todo = todos.find(t => t.id === todoId);
    if (!todo || todo.bucket === bucket) return;
    const order = todos.filter(t => t.bucket === bucket && !t.completed).length;
    try {
      const todoRef = doc(db, 'users', user.uid, 'todos', todoId);
      await updateDoc(todoRef, { bucket, order });
      setTodos(todos.map(t => t.id === todoId ? { ...t, bucket, order } : t));
    } catch (error) {
      console.error('Error moving todo:', error);
    }
  };

  const reorderTodos = async (bucket, orderedIds) => {
    if (!user) return;
    const orderMap = new Map(orderedIds.map((id, index) => [id, index]));
    setTodos(todos.map(t => orderMap.has(t.id) ? { ...t, order: orderMap.get(t.id) } : t));
    try {
      await Promise.all(
        orderedIds.map((id, index) =>
          updateDoc(doc(db, 'users', user.uid, 'todos', id), { order: index })
        )
      );
    } catch (error) {
      console.error('Error reordering todos:', error);
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
      {!user && (
        <div className="signed-out-hero">
          <div className="hero-card">
            <h1>Habits Log</h1>
            <p>Track your daily habits, build streaks, and keep notes — all in one place.</p>
            <button className="hero-cta" onClick={handleSignIn}>Sign In with Google</button>
          </div>
        </div>
      )}

      {user && (
        <div className="habit-container">
          <div className="habit-list">
            {habitsLoading && habits.length === 0 ? (
              <p className="state-message" role="status">Loading your habits…</p>
            ) : habits.length === 0 ? (
              <p className="state-message empty-state">No habits yet — add your first one below.</p>
            ) : (
              <HabitsTable
                habits={habits}
                displayedDays={displayedDays}
                cycleHabitDay={cycleHabitDay}
                startEditHabit={startEditHabit}
                deleteHabit={deleteHabit}
                editingHabitId={editingHabitId}
                editHabitName={editHabitName}
                setEditHabitName={setEditHabitName}
                saveEditHabit={saveEditHabit}
                cancelEditHabit={cancelEditHabit}
                calculateStreak={calculateStreak}
                reorderHabits={reorderHabits}
              />
            )}
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
            <TodoList
              todos={todos}
              todosLoading={todosLoading}
              activeTodoBucket={activeTodoBucket}
              setActiveTodoBucket={setActiveTodoBucket}
              newTodoText={newTodoText}
              setNewTodoText={setNewTodoText}
              addTodo={addTodo}
              toggleTodoComplete={toggleTodoComplete}
              editingTodoId={editingTodoId}
              editTodoText={editTodoText}
              setEditTodoText={setEditTodoText}
              startEditTodo={startEditTodo}
              saveEditTodo={saveEditTodo}
              cancelEditTodo={cancelEditTodo}
              deleteTodo={deleteTodo}
              moveTodoToBucket={moveTodoToBucket}
              reorderTodos={reorderTodos}
            />
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
            {notesLoading && notes.length === 0 ? (
              <p className="state-message" role="status">Loading your notes…</p>
            ) : (
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
              parseNoteText={parseNoteText}
            />
            )}
          </div>
        </div>
      )}

      {user && (
        <button onClick={handleSignOut} className="signout-fab" title="Sign out" aria-label="Sign out">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      )}
    </div>
  );
}

export default App;
