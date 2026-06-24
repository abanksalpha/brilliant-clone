import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

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
export const db: Firestore | null = app ? getFirestore(app) : null;
