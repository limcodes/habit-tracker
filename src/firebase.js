import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, getDocs, addDoc, deleteDoc } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';

// Validate Firebase configuration
const requiredEnvVars = [
  'REACT_APP_FIREBASE_API_KEY',
  'REACT_APP_FIREBASE_AUTH_DOMAIN',
  'REACT_APP_FIREBASE_PROJECT_ID',
  'REACT_APP_FIREBASE_STORAGE_BUCKET',
  'REACT_APP_FIREBASE_MESSAGING_SENDER_ID',
  'REACT_APP_FIREBASE_APP_ID'
];

requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    console.error(`Missing environment variable: ${varName}`);
    throw new Error(`Firebase configuration is incomplete. Missing: ${varName}`);
  }
});

// Validate Firebase configuration
const validateFirebaseConfig = () => {
  const config = {
    apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
    authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
    storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.REACT_APP_FIREBASE_APP_ID
  };

  // Additional validation checks
  Object.entries(config).forEach(([key, value]) => {
    if (!value || value.trim() === '') {
      throw new Error(`Invalid Firebase configuration: ${key} is empty or undefined`);
    }
  });

  return config;
};

const firebaseConfig = validateFirebaseConfig();
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Sign in with Google
export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error('Google Sign-In Error:', error);
    throw error;
  }
};

export const signOutUser = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Sign Out Error:', error);
    throw error;
  }
};

// Firestore Database Functions
export const saveHabitsToFirestore = async (userId, habits) => {
  if (!userId) {
    console.error('No user ID provided');
    throw new Error('Authentication required');
  }

  try {
    // Reference to the user's habits collection
    const userHabitsRef = collection(db, 'users', userId, 'habits');

    // Delete existing habits
    const existingHabitsQuery = query(userHabitsRef);
    const existingHabitsDocs = await getDocs(existingHabitsQuery);
    const deletePromises = existingHabitsDocs.docs.map(async (existingDoc) => {
      await deleteDoc(existingDoc.ref);
    });
    await Promise.all(deletePromises);

    // Add new habits
    const habitsPromises = habits.map(async (habit) => {
      // Validate habit data
      if (!habit.name) {
        console.warn(`Skipping invalid habit: ${JSON.stringify(habit)}`);
        return null;
      }

      return await addDoc(userHabitsRef, {
        id: habit.id || Date.now().toString(),
        name: habit.name,
        completedDays: habit.completedDays || []
      });
    }).filter(promise => promise !== null);

    await Promise.all(habitsPromises);
  } catch (error) {
    console.error('Error saving habits:', error);
    if (error.code === 'permission-denied') {
      console.error('Permission denied. Check Firestore rules and authentication.');
    }
    throw error;
  }
};

export const fetchHabitsFromFirestore = async (userId) => {
  if (!userId) {
    console.error('No user ID provided');
    throw new Error('Authentication required');
  }

  try {
    // Reference to the user's habits collection
    const userHabitsRef = collection(db, 'users', userId, 'habits');

    // Query all habits for the user
    const habitsQuery = query(userHabitsRef);
    const habitsSnapshot = await getDocs(habitsQuery);

    // Convert snapshot to habits array
    const habits = habitsSnapshot.docs.map(doc => ({
      id: doc.data().id || doc.id,
      name: doc.data().name,
      completedDays: doc.data().completedDays || []
    }));

    return habits;
  } catch (error) {
    console.error('Error fetching habits:', error);
    if (error.code === 'permission-denied') {
      console.error('Permission denied. Check Firestore rules and authentication.');
    }
    throw error;
  }
};
