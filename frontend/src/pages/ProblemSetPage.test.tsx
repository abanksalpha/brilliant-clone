import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProblemSetPage } from './ProblemSetPage';
import { buildPostLessonAssignment, rehydrateAssignment } from '../assign/buildAssignment';
import { useProgress } from '../progress/ProgressContext';
import { EMPTY_PROGRESS, type DashboardProgress } from '../progress/dashboardProgress';
import type { Problem } from '../content/problems';
import type { ProblemSetSession } from '../progress/problemSessionProgress';

// Boundary mocks only. The page's job here is orchestration: rehydrate a saved
// session synchronously, otherwise build the assignment asynchronously (the
// builder now generates review slots via the backend, so it returns a promise)
// from loaded progress exactly once after the cloud load resolves, then hold it
// stable for the session. The assignment builder, the progress store, and the
// heavy ProblemPlayer (ink canvas, pdf.js, grading) are the seams it talks to,
// so they are stubbed and the page logic runs for real.
vi.mock('../assign/buildAssignment', () => ({
  buildPostLessonAssignment: vi.fn(),
  rehydrateAssignment: vi.fn(),
}));

vi.mock('../progress/ProgressContext', () => ({
  useProgress: vi.fn(),
}));

vi.mock('../components/problem/ProblemPlayer', () => ({
  ProblemPlayer: ({
    problems,
    title,
    initialSession,
  }: {
    problems: Problem[];
    title: string;
    initialSession?: ProblemSetSession | null;
  }) => (
    <div
      data-testid="problem-player"
      data-title={title}
      data-ids={problems.map((problem) => problem.problemId).join(',')}
      data-initial-session={JSON.stringify(initialSession ?? null)}
    />
  ),
}));

type ProgressApi = {
  isLoading: boolean;
  progress: DashboardProgress;
  getProblemSetSession: ReturnType<typeof vi.fn>;
  saveProblemSetSession: ReturnType<typeof vi.fn>;
  clearProblemSetSession: ReturnType<typeof vi.fn>;
};

let progressApi: ProgressApi;

function makeProblem(id: string): Problem {
  return {
    problemId: id,
    lessonId: 'coulombs-law',
    unitId: 'electrostatics',
    skillIds: ['coulombs-law'],
    principleIds: ['field-concept'],
    misconceptionTags: [],
    kind: 'single',
    difficulty: 2,
    difficultyBand: 2,
    difficultyFeatures: { steps: 3, symbolic: false, calculus: false, multiPart: false, hasTrap: false },
    provenance: 'authored',
    title: `${id} title`,
    prompt: `${id} prompt`,
  };
}

// A fresh element per render. Reusing one element object would trip React's
// same-element bail-out on rerender, so the post-load update would never run and
// the stability assertions would pass for the wrong reason.
function ui() {
  return (
    <MemoryRouter initialEntries={['/problem-set/coulombs-law']}>
      <Routes>
        <Route path="/problem-set/:lessonId" element={<ProblemSetPage />} />
      </Routes>
    </MemoryRouter>
  );
}

function expectLoadingPanel(container: HTMLElement) {
  const main = container.querySelector('main.lesson-shell.theme-handdrawn.theme-handdrawn--lesson');
  expect(main).not.toBeNull();
  const section = main?.querySelector('section.panel.lesson-loading');
  expect(section).not.toBeNull();
  const status = section?.querySelector('p.eyebrow');
  expect(status).not.toBeNull();
  expect(status).toHaveAttribute('role', 'status');
  expect(status).toHaveTextContent('Loading…');
}

beforeEach(() => {
  vi.clearAllMocks();
  progressApi = {
    isLoading: true,
    progress: EMPTY_PROGRESS,
    getProblemSetSession: vi.fn(() => null),
    saveProblemSetSession: vi.fn(),
    clearProblemSetSession: vi.fn(),
  };
  vi.mocked(useProgress).mockImplementation(
    () => progressApi as unknown as ReturnType<typeof useProgress>,
  );
  vi.mocked(buildPostLessonAssignment).mockResolvedValue([]);
  vi.mocked(rehydrateAssignment).mockReturnValue([]);
});

describe('ProblemSetPage', () => {
  it('shows the loading panel and does not build the set while progress is loading', () => {
    progressApi.isLoading = true;

    const { container } = render(ui());

    expectLoadingPanel(container);
    expect(screen.queryByTestId('problem-player')).not.toBeInTheDocument();
    expect(buildPostLessonAssignment).not.toHaveBeenCalled();
  });

  it('builds the set from the loaded progress once, after the cloud load resolves', async () => {
    const built = [makeProblem('p-alpha'), makeProblem('p-beta')];
    vi.mocked(buildPostLessonAssignment).mockResolvedValue(built);

    const { rerender } = render(ui());
    expect(buildPostLessonAssignment).not.toHaveBeenCalled();

    const loaded: DashboardProgress = {
      ...EMPTY_PROGRESS,
      problemAttempts: { 'cl-field-point-charge': { attempts: 1, hintsUsed: 0 } },
    };
    progressApi.isLoading = false;
    progressApi.progress = loaded;
    rerender(ui());

    // The builder is async now, so the player only appears once the promise
    // resolves; until then the loading panel holds.
    expect(await screen.findByTestId('problem-player')).toHaveAttribute('data-ids', 'p-alpha,p-beta');
    expect(buildPostLessonAssignment).toHaveBeenCalledTimes(1);
    expect(buildPostLessonAssignment).toHaveBeenCalledWith('coulombs-law', loaded, expect.any(Date));
  });

  it('keeps the set stable when progress mutates after the first build', async () => {
    const built = [makeProblem('p-alpha'), makeProblem('p-beta')];
    vi.mocked(buildPostLessonAssignment).mockResolvedValue(built);

    progressApi.isLoading = false;
    progressApi.progress = { ...EMPTY_PROGRESS };
    const { rerender } = render(ui());
    expect(await screen.findByTestId('problem-player')).toHaveAttribute('data-ids', 'p-alpha,p-beta');
    expect(buildPostLessonAssignment).toHaveBeenCalledTimes(1);

    // recordProblemResult hands back a fresh progress object mid-set; the set
    // must not rebuild or reshuffle off the back of it.
    vi.mocked(buildPostLessonAssignment).mockResolvedValue([makeProblem('p-gamma')]);
    progressApi.progress = {
      ...EMPTY_PROGRESS,
      problemAttempts: { 'p-alpha': { attempts: 1, hintsUsed: 0 } },
    };
    rerender(ui());

    expect(buildPostLessonAssignment).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('problem-player')).toHaveAttribute('data-ids', 'p-alpha,p-beta');
  });

  it('forwards the resume session captured after load to the player', async () => {
    vi.mocked(buildPostLessonAssignment).mockResolvedValue([makeProblem('p-alpha')]);
    const session: ProblemSetSession = {
      index: 0,
      visitedCount: 1,
      solvedProblemIds: [],
      problemIds: [],
      work: {},
    };
    progressApi.isLoading = false;
    progressApi.getProblemSetSession = vi.fn(() => session);

    render(ui());

    expect(progressApi.getProblemSetSession).toHaveBeenCalledWith('coulombs-law');
    expect(await screen.findByTestId('problem-player')).toHaveAttribute(
      'data-initial-session',
      JSON.stringify(session),
    );
  });

  it('rehydrates the saved set synchronously without calling the async builder', () => {
    const session: ProblemSetSession = {
      index: 0,
      visitedCount: 1,
      solvedProblemIds: [],
      problemIds: ['cl-field-point-charge'],
      work: {},
    };
    progressApi.isLoading = false;
    progressApi.getProblemSetSession = vi.fn(() => session);
    vi.mocked(rehydrateAssignment).mockReturnValue([makeProblem('cl-field-point-charge')]);
    vi.mocked(buildPostLessonAssignment).mockResolvedValue([makeProblem('freshly-built')]);

    render(ui());

    expect(rehydrateAssignment).toHaveBeenCalledWith(
      ['cl-field-point-charge'],
      EMPTY_PROGRESS.misconceptionGraph,
    );
    expect(buildPostLessonAssignment).not.toHaveBeenCalled();
    expect(screen.getByTestId('problem-player')).toHaveAttribute('data-ids', 'cl-field-point-charge');
  });

  it('renders the empty state when the built set has no problems', async () => {
    vi.mocked(buildPostLessonAssignment).mockResolvedValue([]);
    progressApi.isLoading = false;

    render(ui());

    expect(await screen.findByText('No problems yet')).toBeInTheDocument();
    expect(screen.queryByTestId('problem-player')).not.toBeInTheDocument();
  });

  it('degrades to the empty state when the builder rejects (no white screen)', async () => {
    vi.mocked(buildPostLessonAssignment).mockRejectedValue(new Error('cannot fill slot: single'));
    progressApi.isLoading = false;

    expect(() => render(ui())).not.toThrow();

    expect(await screen.findByText('No problems yet')).toBeInTheDocument();
    expect(screen.queryByTestId('problem-player')).not.toBeInTheDocument();
  });

  it('degrades to the empty state when rehydrating a saved set throws', () => {
    const session: ProblemSetSession = {
      index: 0,
      visitedCount: 1,
      solvedProblemIds: [],
      problemIds: ['cl-field-point-charge'],
      work: {},
    };
    progressApi.isLoading = false;
    progressApi.getProblemSetSession = vi.fn(() => session);
    vi.mocked(rehydrateAssignment).mockImplementation(() => {
      throw new Error('unresolved problem id: cl-field-point-charge');
    });

    expect(() => render(ui())).not.toThrow();

    expect(screen.getByText('No problems yet')).toBeInTheDocument();
    expect(screen.queryByTestId('problem-player')).not.toBeInTheDocument();
  });
});
