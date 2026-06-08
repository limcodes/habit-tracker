// Unit tests for the Firestore data layer. We mock the Firebase SDK and set the
// required env vars so the real ./firebase module can be imported without
// touching a real backend.

let mockLastBatch;

jest.mock('firebase/app', () => ({ initializeApp: jest.fn(() => ({})) }));
jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({})),
  GoogleAuthProvider: jest.fn(),
  signInWithPopup: jest.fn(),
  signOut: jest.fn(),
}));
jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(),
  collection: jest.fn(),
  query: jest.fn(),
  getDocs: jest.fn(),
  doc: jest.fn(),
  setDoc: jest.fn(),
  deleteDoc: jest.fn(),
  writeBatch: jest.fn(),
}));

// Provide the env the real module validates on import.
[
  'REACT_APP_FIREBASE_API_KEY',
  'REACT_APP_FIREBASE_AUTH_DOMAIN',
  'REACT_APP_FIREBASE_PROJECT_ID',
  'REACT_APP_FIREBASE_STORAGE_BUCKET',
  'REACT_APP_FIREBASE_MESSAGING_SENDER_ID',
  'REACT_APP_FIREBASE_APP_ID',
].forEach((k) => { process.env[k] = 'test-value'; });

const firestore = require('firebase/firestore');
const { saveHabitsToFirestore, fetchHabitsFromFirestore } = require('./firebase');

// react-scripts sets resetMocks: true, which clears mock implementations before
// every test — so (re)install them here rather than in the jest.mock factory.
beforeEach(() => {
  firestore.getFirestore.mockReturnValue({});
  firestore.collection.mockReturnValue({});
  firestore.query.mockImplementation((ref) => ref);
  firestore.doc.mockImplementation((ref, id) => ({ id }));
  firestore.writeBatch.mockImplementation(() => {
    mockLastBatch = {
      set: jest.fn(),
      delete: jest.fn(),
      commit: jest.fn().mockResolvedValue(),
    };
    return mockLastBatch;
  });
});

describe('saveHabitsToFirestore', () => {
  test('throws without a userId', async () => {
    await expect(saveHabitsToFirestore(undefined, [])).rejects.toThrow('Authentication required');
  });

  test('upserts present habits and deletes only orphaned remote ids', async () => {
    firestore.getDocs.mockResolvedValueOnce({ docs: [{ id: 'h1' }, { id: 'h2' }] });

    await saveHabitsToFirestore('uid', [
      { id: 'h1', name: 'Read', completedDays: [], skippedDays: [], order: 0 },
    ]);

    // h1 is upserted...
    expect(mockLastBatch.set).toHaveBeenCalledTimes(1);
    // ...and h2 (gone locally) is the only delete.
    expect(mockLastBatch.delete).toHaveBeenCalledTimes(1);
    expect(mockLastBatch.delete).toHaveBeenCalledWith({ id: 'h2' });
    expect(mockLastBatch.commit).toHaveBeenCalledTimes(1);
  });

  test('skips habits without a name', async () => {
    firestore.getDocs.mockResolvedValueOnce({ docs: [] });

    await saveHabitsToFirestore('uid', [{ id: 'h1' }]);

    expect(mockLastBatch.set).not.toHaveBeenCalled();
  });
});

describe('fetchHabitsFromFirestore', () => {
  test('throws without a userId', async () => {
    await expect(fetchHabitsFromFirestore()).rejects.toThrow('Authentication required');
  });

  test('returns habits sorted by order with defaulted fields', async () => {
    firestore.getDocs.mockResolvedValueOnce({
      docs: [
        { id: 'h2', data: () => ({ name: 'B', order: 2 }) },
        { id: 'h1', data: () => ({ name: 'A', order: 1 }) },
      ],
    });

    const result = await fetchHabitsFromFirestore('uid');

    expect(result.map((h) => h.name)).toEqual(['A', 'B']);
    expect(result[0]).toMatchObject({ id: 'h1', completedDays: [], skippedDays: [] });
  });
});
