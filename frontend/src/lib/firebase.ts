import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth';
import { initializeFirestore, type Firestore } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator, type Functions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Object.values(firebaseConfig).every(Boolean);

export const app: FirebaseApp | null = isFirebaseConfigured
  ? initializeApp(firebaseConfig)
  : null;

export const auth: Auth | null = app ? getAuth(app) : null;

export const googleProvider = new GoogleAuthProvider();

// Cloud Firestore: the single source of truth for user progress/XP/streak so it
// persists across devices and sessions. Uses the default in-memory cache (no
// durable local persistence) so nothing learner-specific is stored on-device.
// ignoreUndefinedProperties: a single undefined field anywhere in the document
// (e.g. an optional field on a cached generated problem) would otherwise make the
// whole setDoc throw and silently drop ALL progress for that write; dropping the
// undefined field instead keeps persistence robust.
export const db: Firestore | null = app
  ? initializeFirestore(app, { ignoreUndefinedProperties: true })
  : null;

// Callable Cloud Functions (gradeAttempt, getHint). Null when Firebase is not
// configured so callers can fail loudly rather than silently degrade.
export const functions: Functions | null = app ? getFunctions(app) : null;

// Opt-in local emulator wiring, controlled by an env flag so production never
// points at 127.0.0.1.
if (functions && import.meta.env.VITE_USE_FUNCTIONS_EMULATOR === 'true') {
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
}
