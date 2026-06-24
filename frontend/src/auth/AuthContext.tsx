import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { auth, googleProvider, isFirebaseConfigured } from '../lib/firebase';

type AuthContextValue = {
  currentUser: User | null;
  isConfigured: boolean;
  isEmailVerified: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  reloadUser: () => Promise<boolean>;
  resendVerification: () => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function requireAuth() {
  if (!auth) {
    throw new Error('Firebase config is missing. Add values to .env.local.');
  }

  return auth;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [isLoading, setIsLoading] = useState(isFirebaseConfigured);

  useEffect(() => {
    if (!auth) {
      setIsLoading(false);
      return;
    }

    return onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setIsEmailVerified(user?.emailVerified ?? false);
      setIsLoading(false);
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      currentUser,
      isConfigured: isFirebaseConfigured,
      isEmailVerified,
      isLoading,
      login: async (email, password) => {
        await signInWithEmailAndPassword(requireAuth(), email, password);
      },
      loginWithGoogle: async () => {
        await signInWithPopup(requireAuth(), googleProvider);
      },
      logout: async () => {
        await signOut(requireAuth());
      },
      reloadUser: async () => {
        const user = requireAuth().currentUser;
        if (!user) {
          return false;
        }

        await user.reload();
        const verified = requireAuth().currentUser?.emailVerified ?? false;
        setIsEmailVerified(verified);
        return verified;
      },
      resendVerification: async () => {
        const user = requireAuth().currentUser;
        if (!user) {
          throw new Error('You need to be signed in to resend the email.');
        }

        await sendEmailVerification(user);
      },
      signup: async (email, password) => {
        const credential = await createUserWithEmailAndPassword(
          requireAuth(),
          email,
          password,
        );
        await sendEmailVerification(credential.user);
      },
    }),
    [currentUser, isEmailVerified, isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }

  return context;
}
