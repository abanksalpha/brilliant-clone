import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MasteryPage } from './MasteryPage';
import { useProgress } from '../progress/ProgressContext';
import { EMPTY_PROGRESS, type DashboardProgress } from '../progress/dashboardProgress';
import type { MisconceptionGraph, MisconceptionNode } from '../mastery/misconceptionGraph';

// The page reads its rows from the per-student graph via useProgress, so that is
// the seam under test. AppShell only frames the page (TopBar, StatDock, course
// switcher) and pulls in unrelated auth/social/xp context, so it is stubbed to
// keep the test focused on the mastery list and its empty state.
vi.mock('../progress/ProgressContext', () => ({
  useProgress: vi.fn(),
}));

vi.mock('../components/shell/AppShell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

// Strength decays from lastSeen, so pinning "now" to the nodes' lastSeen makes
// the rendered percent equal to the stored strength with zero elapsed decay.
const NOW = new Date('2026-06-26T12:00:00.000Z');
const NOW_ISO = NOW.toISOString();

let progressValue: { progress: DashboardProgress };

function setGraph(misconceptionGraph: MisconceptionGraph) {
  progressValue = { progress: { ...EMPTY_PROGRESS, misconceptionGraph } };
}

function trackedNode(overrides: Partial<MisconceptionNode> & { id: string }): MisconceptionNode {
  return {
    id: overrides.id,
    status: 'tracked',
    principleId: 'field-concept',
    wrongBelief: 'A wrong belief',
    specificNote: 'A specific note',
    caught: 0,
    missed: 0,
    strength: 0,
    lastSeenISO: NOW_ISO,
    caughtDayStamps: [],
    createdISO: NOW_ISO,
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <MasteryPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  setGraph({});
  vi.mocked(useProgress).mockImplementation(() => progressValue as unknown as ReturnType<typeof useProgress>);
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('MasteryPage', () => {
  it('renders a tracked node with its wrong belief, strength percent, counts, and spacing indicator', () => {
    setGraph({
      'mc:1': trackedNode({
        id: 'mc:1',
        wrongBelief: 'Field is zero where the potential is zero',
        specificNote: 'Set E to zero at the midpoint',
        caught: 2,
        missed: 1,
        strength: 0.6,
        caughtDayStamps: ['2026-06-24', '2026-06-25'],
      }),
    });

    renderPage();

    expect(screen.getByText('Field is zero where the potential is zero')).toBeInTheDocument();
    expect(screen.getByText('Set E to zero at the midpoint')).toBeInTheDocument();
    expect(screen.getByText('60%')).toBeInTheDocument();
    expect(screen.getByText(/2 caught/)).toBeInTheDocument();
    expect(screen.getByText(/1 missed/)).toBeInTheDocument();
    expect(screen.getByText('2 of 3 days')).toBeInTheDocument();
    expect(screen.queryByText(/No misconceptions yet/i)).not.toBeInTheDocument();
  });

  it('caps the spacing indicator at three distinct days', () => {
    setGraph({
      'mc:1': trackedNode({
        id: 'mc:1',
        wrongBelief: 'Adds field magnitudes',
        caughtDayStamps: ['2026-06-22', '2026-06-23', '2026-06-24', '2026-06-25'],
      }),
    });

    renderPage();

    expect(screen.getByText('3 of 3 days')).toBeInTheDocument();
  });

  it('orders tracked nodes by ascending current strength, weakest first', () => {
    setGraph({
      'mc:strong': trackedNode({ id: 'mc:strong', wrongBelief: 'Strong belief', strength: 0.8 }),
      'mc:weak': trackedNode({ id: 'mc:weak', wrongBelief: 'Weak belief', strength: 0.2 }),
    });

    renderPage();

    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Weak belief');
    expect(rows[1]).toHaveTextContent('Strong belief');
  });

  it('shows the empty state and no rows when there are no tracked nodes', () => {
    setGraph({});

    renderPage();

    expect(screen.getByText(/No misconceptions yet\./i)).toBeInTheDocument();
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Misconception mastery')).not.toBeInTheDocument();
  });

  it('does not render notes, only tracked misconceptions', () => {
    setGraph({
      'mc:note': trackedNode({ id: 'mc:note', status: 'note', wrongBelief: 'A note-only belief' }),
    });

    renderPage();

    expect(screen.queryByText('A note-only belief')).not.toBeInTheDocument();
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
    expect(screen.getByText(/No misconceptions yet\./i)).toBeInTheDocument();
  });
});
