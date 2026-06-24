import '@testing-library/jest-dom/vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProgressProvider } from '../progress/ProgressContext';
import { DashboardPage } from './DashboardPage';
import type { FriendView, Profile } from '../social/types';

const authState = vi.hoisted(() => ({
  currentUser: { uid: 'me', email: 'me@example.com' },
  logout: vi.fn(),
}));

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => authState,
}));

const cloud = vi.hoisted(() => {
  const EMPTY = {
    progress: {
      completedLessonIds: [] as string[],
      completionDates: {} as Record<string, string>,
      lastOpenedLessonId: null as string | null,
      answeredQuestionIds: [] as string[],
      questionXp: 0,
      dailyXp: {} as Record<string, number>,
    },
    lessonSessions: {} as Record<string, { stepIndex: number; maxVisitedStepIndex: number }>,
  };
  return { EMPTY };
});

vi.mock('../progress/cloudStore', () => ({
  EMPTY_CLOUD_STATE: cloud.EMPTY,
  subscribeUserCloudState: (_userId: string, onChange: (state: unknown) => void) => {
    onChange(cloud.EMPTY);
    return () => {};
  },
  saveUserCloudState: async () => {},
  resetUserCloudState: async () => {},
}));

const social = vi.hoisted(() => ({
  friends: [] as FriendView[],
}));

vi.mock('../social/SocialContext', () => ({
  useSocial: () => ({
    friends: social.friends,
    incomingRequests: [],
    outgoingRequests: [],
    incomingCount: 0,
    search: async () => [],
    getRelationship: () => 'none',
    sendRequest: async () => {},
    acceptRequest: async () => {},
    declineRequest: async () => {},
    cancelRequest: async () => {},
    removeFriend: async () => {},
  }),
  SocialProvider: ({ children }: { children: React.ReactNode }) => children,
}));

function makeFriend(uid: string, displayName: string, completedCount: number): FriendView {
  const profile: Profile = {
    uid,
    displayName,
    nameLower: displayName.toLowerCase(),
    email: '',
    photoURL: null,
    completedCount,
    currentLessonId: null,
  };
  return { uid, profile };
}

function renderDashboard() {
  return render(
    <MemoryRouter>
      <ProgressProvider>
        <DashboardPage />
      </ProgressProvider>
    </MemoryRouter>,
  );
}

describe('Dashboard friend overlay', () => {
  beforeEach(() => {
    social.friends = [];
  });

  it("places each friend's avatar on the lesson node matching their completed count", () => {
    social.friends = [makeFriend('ada', 'Ada Lovelace', 0), makeFriend('carl', 'Carl Gauss', 1)];

    renderDashboard();

    const adaAvatar = screen.getByRole('img', { name: 'Ada Lovelace' });
    expect(within(adaAvatar.closest('li')!).getByText("Coulomb's Law")).toBeInTheDocument();

    const carlAvatar = screen.getByRole('img', { name: 'Carl Gauss' });
    expect(within(carlAvatar.closest('li')!).getByText('Superposition of Electric Forces')).toBeInTheDocument();
  });

  it('renders no friend avatars when you have no friends', () => {
    renderDashboard();

    expect(screen.queryByRole('img', { name: 'Ada Lovelace' })).not.toBeInTheDocument();
  });
});
