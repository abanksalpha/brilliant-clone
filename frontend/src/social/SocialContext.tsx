import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '../auth/AuthContext';
import { useProgress } from '../progress/ProgressContext';
import { LIVE_LESSON_IDS } from '../progress/dashboardProgress';
import { countCompletedProblemSets } from '../progress/problemSetStatus';
import {
  acceptFriendRequest,
  partitionFriendships,
  relationshipFor,
  removeFriendship,
  sendFriendRequest,
  subscribeFriendships,
} from './friendsStore';
import { listProfiles, searchProfilesByName, subscribeProfilesByIds, upsertProfile } from './profileStore';
import type { Friendship, FriendView, Profile, RelationshipStatus } from './types';

type SocialContextValue = {
  friends: FriendView[];
  incomingRequests: FriendView[];
  outgoingRequests: FriendView[];
  incomingCount: number;
  search: (term: string) => Promise<Profile[]>;
  listPeople: () => Promise<Profile[]>;
  getRelationship: (uid: string) => RelationshipStatus;
  sendRequest: (uid: string) => Promise<void>;
  acceptRequest: (uid: string) => Promise<void>;
  declineRequest: (uid: string) => Promise<void>;
  cancelRequest: (uid: string) => Promise<void>;
  removeFriend: (uid: string) => Promise<void>;
};

// Used when `useSocial` is called outside a provider (e.g. component-level tests
// that render the dashboard or top bar in isolation). The social overlay simply
// shows nothing rather than crashing.
const DEFAULT_VALUE: SocialContextValue = {
  friends: [],
  incomingRequests: [],
  outgoingRequests: [],
  incomingCount: 0,
  search: async () => [],
  listPeople: async () => [],
  getRelationship: () => 'none',
  sendRequest: async () => {},
  acceptRequest: async () => {},
  declineRequest: async () => {},
  cancelRequest: async () => {},
  removeFriend: async () => {},
};

const SocialContext = createContext<SocialContextValue | null>(null);

function deriveDisplayName(displayName: string | null, email: string | null): string {
  if (displayName && displayName.trim()) {
    return displayName.trim();
  }
  const localPart = (email ?? '').split('@')[0] ?? '';
  return localPart || 'Learner';
}

function buildViews(ids: string[], profiles: Map<string, Profile>): FriendView[] {
  return ids
    .map((uid) => ({ uid, profile: profiles.get(uid) ?? null }))
    .sort((a, b) => (a.profile?.displayName ?? '').localeCompare(b.profile?.displayName ?? ''));
}

export function SocialProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useAuth();
  const { progress } = useProgress();
  const userId = currentUser?.uid ?? null;

  const displayName = currentUser?.displayName ?? null;
  const email = currentUser?.email ?? null;
  const photoURL = currentUser?.photoURL ?? null;

  const completedCount = progress.completedLessonIds.length;
  const completedPsetCount = countCompletedProblemSets(progress);
  const currentLessonId = LIVE_LESSON_IDS[completedCount] ?? null;

  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [profiles, setProfiles] = useState<Map<string, Profile>>(() => new Map());

  // Keep the user's public profile in sync with their identity + position.
  useEffect(() => {
    if (!userId) {
      return;
    }
    void upsertProfile(
      userId,
      { displayName: deriveDisplayName(displayName, email), email: email ?? '', photoURL },
      { completedCount, completedPsetCount, currentLessonId },
    ).catch((error) => console.error('Failed to sync profile', error));
  }, [userId, displayName, email, photoURL, completedCount, completedPsetCount, currentLessonId]);

  // Subscribe to friendships (accepted + pending) the user participates in.
  useEffect(() => {
    if (!userId) {
      setFriendships([]);
      return;
    }
    return subscribeFriendships(userId, setFriendships, (error) =>
      console.error('Failed to load friendships', error),
    );
  }, [userId]);

  const partitioned = useMemo(() => partitionFriendships(friendships, userId ?? ''), [friendships, userId]);

  // Stable key for all uids we need profiles for, so we only re-subscribe when
  // the actual set changes (not on every friendship snapshot).
  const idsKey = useMemo(
    () =>
      [...new Set([...partitioned.friendIds, ...partitioned.incomingIds, ...partitioned.outgoingIds])]
        .sort()
        .join(','),
    [partitioned],
  );

  useEffect(() => {
    if (!userId || !idsKey) {
      setProfiles(new Map());
      return;
    }
    return subscribeProfilesByIds(idsKey.split(','), setProfiles);
  }, [userId, idsKey]);

  const friends = useMemo(() => buildViews(partitioned.friendIds, profiles), [partitioned.friendIds, profiles]);
  const incomingRequests = useMemo(
    () => buildViews(partitioned.incomingIds, profiles),
    [partitioned.incomingIds, profiles],
  );
  const outgoingRequests = useMemo(
    () => buildViews(partitioned.outgoingIds, profiles),
    [partitioned.outgoingIds, profiles],
  );

  const search = useCallback((term: string) => searchProfilesByName(term, userId ?? undefined), [userId]);

  const listPeople = useCallback(() => listProfiles(userId ?? undefined), [userId]);

  const getRelationship = useCallback(
    (uid: string) => relationshipFor(uid, partitioned, userId ?? ''),
    [partitioned, userId],
  );

  const sendRequest = useCallback(
    async (uid: string) => {
      if (userId) {
        await sendFriendRequest(userId, uid);
      }
    },
    [userId],
  );

  const acceptRequest = useCallback(
    async (uid: string) => {
      if (userId) {
        await acceptFriendRequest(userId, uid);
      }
    },
    [userId],
  );

  // Decline, cancel, and unfriend are all a delete of the shared document.
  const removeRelationship = useCallback(
    async (uid: string) => {
      if (userId) {
        await removeFriendship(userId, uid);
      }
    },
    [userId],
  );

  const value = useMemo<SocialContextValue>(
    () => ({
      friends,
      incomingRequests,
      outgoingRequests,
      incomingCount: partitioned.incomingIds.length,
      search,
      listPeople,
      getRelationship,
      sendRequest,
      acceptRequest,
      declineRequest: removeRelationship,
      cancelRequest: removeRelationship,
      removeFriend: removeRelationship,
    }),
    [
      friends,
      incomingRequests,
      outgoingRequests,
      partitioned.incomingIds.length,
      search,
      listPeople,
      getRelationship,
      sendRequest,
      acceptRequest,
      removeRelationship,
    ],
  );

  return <SocialContext.Provider value={value}>{children}</SocialContext.Provider>;
}

export function useSocial(): SocialContextValue {
  return useContext(SocialContext) ?? DEFAULT_VALUE;
}
