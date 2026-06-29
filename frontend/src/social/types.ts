// Shared types for the social layer (profiles + friendships). These mirror the
// Firestore documents described in `firestore.rules`.

/**
 * The searchable, friend-visible identity + course position for a user. Stored
 * at `profiles/{uid}` and readable by any signed-in user.
 */
export type Profile = {
  uid: string;
  displayName: string;
  nameLower: string;
  email: string;
  photoURL: string | null;
  /** Number of live lessons completed; doubles as the timeline node index. */
  completedCount: number;
  currentLessonId: string | null;
};

export type FriendshipStatus = 'pending' | 'accepted';

/**
 * A mutual friendship or pending request between two users. Stored at
 * `friendships/{pairId}` where `pairId === "<minUid>_<maxUid>"`.
 */
export type Friendship = {
  pairId: string;
  participants: [string, string];
  status: FriendshipStatus;
  requestedBy: string;
};

/** A friend/request paired with their (possibly not-yet-loaded) profile. */
export type FriendView = {
  uid: string;
  profile: Profile | null;
};

/** Relationship of some other user to the current user, for UI affordances. */
export type RelationshipStatus = 'none' | 'friends' | 'incoming' | 'outgoing' | 'self';
