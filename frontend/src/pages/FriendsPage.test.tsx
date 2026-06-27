import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProgressProvider } from '../progress/ProgressContext';
import { SocialProvider } from '../social/SocialContext';
import { pairId, sortedPair } from '../social/friendsStore';
import { FriendsPage } from './FriendsPage';
import type { Friendship, Profile } from '../social/types';

const authState = vi.hoisted(() => ({
  currentUser: { uid: 'me', email: 'me@example.com', displayName: 'Me', photoURL: null },
}));

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => authState,
}));

const cloud = vi.hoisted(() => ({
  EMPTY: {
    progress: {
      completedLessonIds: [] as string[],
      completionDates: {} as Record<string, string>,
      lastOpenedLessonId: null as string | null,
      answeredQuestionIds: [] as string[],
      questionXp: 0,
      dailyXp: {} as Record<string, number>,
    },
    lessonSessions: {} as Record<string, { stepIndex: number; maxVisitedStepIndex: number }>,
  },
}));

vi.mock('../progress/cloudStore', () => ({
  EMPTY_CLOUD_STATE: cloud.EMPTY,
  subscribeUserCloudState: (_userId: string, onChange: (state: unknown) => void) => {
    onChange(cloud.EMPTY);
    return () => {};
  },
  saveUserCloudState: async () => {},
  resetUserCloudState: async () => {},
}));

// In-memory fake of the Firestore-backed social stores.
const store = vi.hoisted(() => {
  const state = {
    profiles: new Map<string, Profile>(),
    friendships: [] as Friendship[],
  };
  const friendshipCbs = new Set<(friendships: Friendship[]) => void>();
  const profileSubs: Array<{ ids: string[]; cb: (profiles: Map<string, Profile>) => void }> = [];

  const profilesFor = (ids: string[]) => {
    const map = new Map<string, Profile>();
    for (const id of ids) {
      const profile = state.profiles.get(id);
      if (profile) {
        map.set(id, profile);
      }
    }
    return map;
  };
  const notifyFriendships = () => friendshipCbs.forEach((cb) => cb([...state.friendships]));
  const notifyProfiles = () => profileSubs.forEach((sub) => sub.cb(profilesFor(sub.ids)));

  return {
    state,
    friendshipCbs,
    profileSubs,
    profilesFor,
    notifyFriendships,
    notifyProfiles,
    reset: () => {
      state.profiles.clear();
      state.friendships = [];
      friendshipCbs.clear();
      profileSubs.length = 0;
    },
  };
});

vi.mock('../social/profileStore', () => ({
  upsertProfile: async () => {},
  normalizeNameForSearch: (name: string) => name.trim().toLowerCase(),
  searchProfilesByName: async (term: string, excludeUid?: string) => {
    const normalized = term.trim().toLowerCase();
    return [...store.state.profiles.values()].filter(
      (profile) => profile.nameLower.startsWith(normalized) && profile.uid !== excludeUid,
    );
  },
  listProfiles: async (excludeUid?: string) =>
    [...store.state.profiles.values()].filter((profile) => profile.uid !== excludeUid),
  subscribeProfilesByIds: (ids: string[], onChange: (profiles: Map<string, Profile>) => void) => {
    const entry = { ids, cb: onChange };
    store.profileSubs.push(entry);
    onChange(store.profilesFor(ids));
    return () => {
      const index = store.profileSubs.indexOf(entry);
      if (index >= 0) {
        store.profileSubs.splice(index, 1);
      }
    };
  },
}));

vi.mock('../social/friendsStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../social/friendsStore')>();
  return {
    ...actual,
    subscribeFriendships: (_uid: string, onChange: (friendships: Friendship[]) => void) => {
      store.friendshipCbs.add(onChange);
      onChange([...store.state.friendships]);
      return () => store.friendshipCbs.delete(onChange);
    },
    sendFriendRequest: async (myUid: string, otherUid: string) => {
      const id = actual.pairId(myUid, otherUid);
      if (store.state.friendships.some((friendship) => friendship.pairId === id)) {
        return;
      }
      store.state.friendships = [
        ...store.state.friendships,
        { pairId: id, participants: actual.sortedPair(myUid, otherUid), status: 'pending', requestedBy: myUid },
      ];
      store.notifyFriendships();
      store.notifyProfiles();
    },
    acceptFriendRequest: async (myUid: string, otherUid: string) => {
      const id = actual.pairId(myUid, otherUid);
      store.state.friendships = store.state.friendships.map((friendship) =>
        friendship.pairId === id ? { ...friendship, status: 'accepted' as const } : friendship,
      );
      store.notifyFriendships();
    },
    removeFriendship: async (myUid: string, otherUid: string) => {
      const id = actual.pairId(myUid, otherUid);
      store.state.friendships = store.state.friendships.filter((friendship) => friendship.pairId !== id);
      store.notifyFriendships();
    },
  };
});

function profile(
  uid: string,
  displayName: string,
  email = '',
  completedCount = 0,
  completedPsetCount = 0,
): Profile {
  return {
    uid,
    displayName,
    nameLower: displayName.toLowerCase(),
    email,
    photoURL: null,
    completedCount,
    completedPsetCount,
    currentLessonId: null,
  };
}

function renderFriends() {
  return render(
    <MemoryRouter>
      <ProgressProvider>
        <SocialProvider>
          <FriendsPage />
        </SocialProvider>
      </ProgressProvider>
    </MemoryRouter>,
  );
}

describe('FriendsPage', () => {
  beforeEach(() => {
    store.reset();
    authState.currentUser = { uid: 'me', email: 'me@example.com', displayName: 'Me', photoURL: null };
    store.state.profiles.set('me', profile('me', 'Me', 'me@example.com'));
    store.state.profiles.set('zoe', profile('zoe', 'Zoe Curie', 'zoe@example.com'));
  });

  it('links back to the dashboard', () => {
    renderFriends();
    expect(screen.getByRole('link', { name: /return to dashboard/i })).toHaveAttribute('href', '/dashboard');
  });

  it('finds a classmate by email and shows their name', async () => {
    renderFriends();

    const search = await screen.findByLabelText(/search by email/i);
    await waitFor(() => expect(search).not.toBeDisabled());

    // A name-only term does not match: search is by email only.
    fireEvent.change(search, { target: { value: 'curie' } });
    expect(await screen.findByText(/no one found with that email/i)).toBeInTheDocument();

    // Searching the email surfaces the person, displayed by name.
    fireEvent.change(search, { target: { value: 'zoe@example.com' } });
    const results = await screen.findByLabelText('Search results');
    expect(within(results).getByText('Zoe Curie')).toBeInTheDocument();
    expect(within(results).getByText('zoe@example.com')).toBeInTheDocument();
  });

  it('sends a friend request from the search results and reflects the pending state', async () => {
    renderFriends();

    const search = await screen.findByLabelText(/search by email/i);
    await waitFor(() => expect(search).not.toBeDisabled());
    fireEvent.change(search, { target: { value: 'zoe@example.com' } });

    const results = await screen.findByLabelText('Search results');
    fireEvent.click(within(results).getByRole('button', { name: /add friend/i }));

    // The request is pending until the other person accepts; it is not an
    // instant friendship.
    expect(await screen.findByText(/need to accept it/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /sent requests/i })).toBeInTheDocument();
    const sent = screen.getByLabelText('Sent friend requests');
    expect(within(sent).getByText('Zoe Curie')).toBeInTheDocument();
    expect(screen.queryByLabelText('Your friends')).not.toBeInTheDocument();
  });

  it('accepts an incoming request and moves the person into the friends list', async () => {
    store.state.profiles.set('ann', profile('ann', 'Ann Newton', 'ann@example.com', 2, 2));
    store.state.friendships = [
      { pairId: pairId('me', 'ann'), participants: sortedPair('me', 'ann'), status: 'pending', requestedBy: 'ann' },
    ];

    renderFriends();

    expect(await screen.findByRole('heading', { name: /friend requests/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /accept/i }));

    await waitFor(() => {
      const friendsList = screen.getByLabelText('Your friends');
      expect(within(friendsList).getByText('Ann Newton')).toBeInTheDocument();
    });
    // Position is rendered from both counts: 2 lessons done with both their
    // problem sets done sits on the next lesson (index 2).
    expect(screen.getByText(/On: Electric Field & Field Lines/)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /friend requests/i })).not.toBeInTheDocument();
  });
});
