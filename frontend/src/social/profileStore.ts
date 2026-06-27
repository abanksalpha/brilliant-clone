import {
  collection,
  documentId,
  doc,
  endAt,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAt,
  where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Profile } from './types';

const PROFILES_COLLECTION = 'profiles';
const SEARCH_LIMIT = 12;
// Cap for the add-friend picker. Fine for a classroom-sized roster; if the user
// base grows this should move back to typed search.
const LIST_LIMIT = 50;
// Firestore allows up to 30 values in an `in` filter; chunk well under that.
const ID_CHUNK_SIZE = 10;
// Mirror the size limits enforced in firestore.rules.
const MAX_NAME = 80;
const MAX_EMAIL = 320;

export type ProfileIdentity = {
  displayName: string;
  email: string;
  photoURL: string | null;
};

export type ProfilePosition = {
  completedCount: number;
  completedPsetCount: number;
  currentLessonId: string | null;
};

function toCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.trunc(value) : 0;
}

/** Lowercases + trims a name for prefix search and the `nameLower` field. */
export function normalizeNameForSearch(name: string): string {
  return name.trim().toLowerCase();
}

function toProfile(id: string, raw: unknown): Profile {
  const data = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    uid: id,
    displayName: typeof data.displayName === 'string' ? data.displayName : '',
    nameLower: typeof data.nameLower === 'string' ? data.nameLower : '',
    email: typeof data.email === 'string' ? data.email : '',
    photoURL: typeof data.photoURL === 'string' ? data.photoURL : null,
    completedCount: toCount(data.completedCount),
    // Optional for back-compat: profiles written before problem-set tracking
    // simply default to 0 until the owner next syncs.
    completedPsetCount: toCount(data.completedPsetCount),
    currentLessonId: typeof data.currentLessonId === 'string' ? data.currentLessonId : null,
  };
}

/**
 * Creates or overwrites the user's public profile so it stays in sync with
 * their auth identity and course position. No-ops when Firestore is unconfigured.
 */
export async function upsertProfile(
  uid: string,
  identity: ProfileIdentity,
  position: ProfilePosition,
): Promise<void> {
  if (!db) {
    return;
  }

  // displayName + nameLower must be 1..80 chars (see firestore.rules), so fall
  // back to a non-empty default for users without a Google display name.
  const displayName = (identity.displayName.trim() || 'Learner').slice(0, MAX_NAME);
  const nameLower = normalizeNameForSearch(displayName).slice(0, MAX_NAME) || 'learner';

  await setDoc(doc(db, PROFILES_COLLECTION, uid), {
    displayName,
    nameLower,
    email: identity.email.slice(0, MAX_EMAIL),
    photoURL: identity.photoURL,
    completedCount: Math.max(0, Math.trunc(position.completedCount)),
    completedPsetCount: Math.max(0, Math.trunc(position.completedPsetCount)),
    currentLessonId: position.currentLessonId,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Prefix-searches profiles by lowercased display name (Standard-edition
 * Firestore has no native full-text search). Matches the start of the full
 * name only. Optionally excludes a uid (typically the current user).
 */
export async function searchProfilesByName(term: string, excludeUid?: string): Promise<Profile[]> {
  if (!db) {
    return [];
  }

  const normalized = normalizeNameForSearch(term);
  if (!normalized) {
    return [];
  }

  const profilesQuery = query(
    collection(db, PROFILES_COLLECTION),
    orderBy('nameLower'),
    startAt(normalized),
    endAt(`${normalized}\uf8ff`),
    limit(SEARCH_LIMIT),
  );

  const snapshot = await getDocs(profilesQuery);
  return snapshot.docs
    .map((profileDoc) => toProfile(profileDoc.id, profileDoc.data()))
    .filter((profile) => profile.uid !== excludeUid);
}

/**
 * Lists profiles by name for the add-friend picker. Standard-edition Firestore
 * has no full-text search, so the dropdown simply loads the roster (capped) and
 * the client filters out the current user and existing relationships.
 */
export async function listProfiles(excludeUid?: string): Promise<Profile[]> {
  if (!db) {
    return [];
  }

  const profilesQuery = query(
    collection(db, PROFILES_COLLECTION),
    orderBy('nameLower'),
    limit(LIST_LIMIT),
  );

  const snapshot = await getDocs(profilesQuery);
  return snapshot.docs
    .map((profileDoc) => toProfile(profileDoc.id, profileDoc.data()))
    .filter((profile) => profile.uid !== excludeUid);
}

/**
 * Subscribes to the live profiles for the given uids (e.g. a friend list), so
 * their avatars/positions update in real time. Reports a uid -> Profile map on
 * every change. Returns an unsubscribe function.
 */
export function subscribeProfilesByIds(
  ids: string[],
  onChange: (profiles: Map<string, Profile>) => void,
): () => void {
  const uniqueIds = [...new Set(ids)].filter(Boolean);
  if (!db || uniqueIds.length === 0) {
    onChange(new Map());
    return () => {};
  }

  const database = db;
  const chunks: string[][] = [];
  for (let index = 0; index < uniqueIds.length; index += ID_CHUNK_SIZE) {
    chunks.push(uniqueIds.slice(index, index + ID_CHUNK_SIZE));
  }

  const perChunk: Array<Map<string, Profile>> = chunks.map(() => new Map());
  const emit = () => {
    const merged = new Map<string, Profile>();
    for (const chunkMap of perChunk) {
      for (const [id, profile] of chunkMap) {
        merged.set(id, profile);
      }
    }
    onChange(merged);
  };

  const unsubscribes = chunks.map((chunk, chunkIndex) => {
    const chunkQuery = query(collection(database, PROFILES_COLLECTION), where(documentId(), 'in', chunk));
    return onSnapshot(
      chunkQuery,
      (snapshot) => {
        const next = new Map<string, Profile>();
        snapshot.forEach((profileDoc) => next.set(profileDoc.id, toProfile(profileDoc.id, profileDoc.data())));
        perChunk[chunkIndex] = next;
        emit();
      },
      (error) => {
        console.error('Failed to load friend profiles', error);
      },
    );
  });

  return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
}
