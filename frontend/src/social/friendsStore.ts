import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Friendship, RelationshipStatus } from './types';

const FRIENDSHIPS_COLLECTION = 'friendships';

/** Canonical, order-independent document id for a pair of users. */
export function pairId(a: string, b: string): string {
  return a < b ? `${a}_${b}` : `${b}_${a}`;
}

/** The two uids sorted ascending, matching the `participants` field ordering. */
export function sortedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

/** The participant that is NOT the current user. */
export function otherParticipant(friendship: Friendship, myUid: string): string {
  return friendship.participants[0] === myUid ? friendship.participants[1] : friendship.participants[0];
}

export type PartitionedFriendships = {
  /** Accepted friends (the other uid). */
  friendIds: string[];
  /** Pending requests sent TO me that I can accept/decline. */
  incomingIds: string[];
  /** Pending requests I sent that are awaiting the other person. */
  outgoingIds: string[];
};

/**
 * Splits a user's friendships into accepted friends, incoming requests, and
 * outgoing requests. Pure + side-effect free for easy testing.
 */
export function partitionFriendships(friendships: Friendship[], myUid: string): PartitionedFriendships {
  const friendIds: string[] = [];
  const incomingIds: string[] = [];
  const outgoingIds: string[] = [];

  for (const friendship of friendships) {
    if (!friendship.participants.includes(myUid)) {
      continue;
    }
    const other = otherParticipant(friendship, myUid);
    if (friendship.status === 'accepted') {
      friendIds.push(other);
    } else if (friendship.status === 'pending') {
      if (friendship.requestedBy === myUid) {
        outgoingIds.push(other);
      } else {
        incomingIds.push(other);
      }
    }
  }

  return { friendIds, incomingIds, outgoingIds };
}

/** Classifies another user relative to the current user, for UI affordances. */
export function relationshipFor(
  uid: string,
  partitioned: PartitionedFriendships,
  myUid: string,
): RelationshipStatus {
  if (uid === myUid) {
    return 'self';
  }
  if (partitioned.friendIds.includes(uid)) {
    return 'friends';
  }
  if (partitioned.incomingIds.includes(uid)) {
    return 'incoming';
  }
  if (partitioned.outgoingIds.includes(uid)) {
    return 'outgoing';
  }
  return 'none';
}

function toFriendship(id: string, raw: unknown): Friendship | null {
  const data = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
  if (!data) {
    return null;
  }

  const participants = Array.isArray(data.participants)
    ? data.participants.filter((participant): participant is string => typeof participant === 'string')
    : [];
  if (participants.length !== 2) {
    return null;
  }

  const status = data.status === 'accepted' ? 'accepted' : data.status === 'pending' ? 'pending' : null;
  const requestedBy = typeof data.requestedBy === 'string' ? data.requestedBy : null;
  if (!status || !requestedBy) {
    return null;
  }

  return {
    pairId: id,
    participants: [participants[0]!, participants[1]!],
    status,
    requestedBy,
  };
}

/**
 * Sends a friend request from `myUid` to `otherUid` as a 'pending' document the
 * recipient must explicitly accept. No-ops when Firestore is unconfigured.
 *
 * We write the request directly rather than reading it back first: the security
 * rules gate friendship reads on `resource.data.participants`, which is null for
 * a document that does not exist yet, so a pre-read of a brand-new pair is
 * denied with "insufficient permissions". The add-friend UI already hides anyone
 * you have an existing relationship with, so creating the pending request is the
 * only operation that needs to happen here.
 */
export async function sendFriendRequest(myUid: string, otherUid: string): Promise<void> {
  if (!db) {
    return;
  }
  if (myUid === otherUid) {
    throw new Error("You can't add yourself.");
  }

  const [first, second] = sortedPair(myUid, otherUid);
  await setDoc(doc(db, FRIENDSHIPS_COLLECTION, pairId(myUid, otherUid)), {
    participants: [first, second],
    status: 'pending',
    requestedBy: myUid,
    createdAt: serverTimestamp(),
  });
}

/** Accepts a pending request from `otherUid` (flips status to 'accepted'). */
export async function acceptFriendRequest(myUid: string, otherUid: string): Promise<void> {
  if (!db) {
    return;
  }
  await updateDoc(doc(db, FRIENDSHIPS_COLLECTION, pairId(myUid, otherUid)), { status: 'accepted' });
}

/**
 * Removes a friendship or request between the two users (used for decline,
 * cancel, and unfriend, which are all just a delete of the shared document).
 */
export async function removeFriendship(myUid: string, otherUid: string): Promise<void> {
  if (!db) {
    return;
  }
  await deleteDoc(doc(db, FRIENDSHIPS_COLLECTION, pairId(myUid, otherUid)));
}

/**
 * Subscribes to all friendships the user participates in. Reports the full list
 * on every change. Returns an unsubscribe function.
 */
export function subscribeFriendships(
  myUid: string,
  onChange: (friendships: Friendship[]) => void,
  onError?: (error: Error) => void,
): () => void {
  if (!db) {
    onChange([]);
    return () => {};
  }

  const friendshipsQuery = query(
    collection(db, FRIENDSHIPS_COLLECTION),
    where('participants', 'array-contains', myUid),
  );

  return onSnapshot(
    friendshipsQuery,
    (snapshot) => {
      const result: Friendship[] = [];
      snapshot.forEach((friendshipDoc) => {
        const friendship = toFriendship(friendshipDoc.id, friendshipDoc.data());
        if (friendship) {
          result.push(friendship);
        }
      });
      onChange(result);
    },
    (error) => onError?.(error),
  );
}
