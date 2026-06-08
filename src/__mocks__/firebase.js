// Manual mock for ./firebase used by component/App tests. Importing the real
// module throws unless all REACT_APP_FIREBASE_* env vars are set, so tests
// activate this mock with jest.mock('./firebase').
export const db = {};
export const auth = {};
export const googleProvider = {};

export const signInWithGoogle = jest.fn().mockResolvedValue({ uid: 'test-uid' });
export const signOutUser = jest.fn().mockResolvedValue();
export const saveHabitsToFirestore = jest.fn().mockResolvedValue();
export const fetchHabitsFromFirestore = jest.fn().mockResolvedValue([]);
