import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { getLessonModule } from '../content';
import { LessonSession } from '../components/lesson/LessonSession';
import { ProgressProvider } from '../progress/ProgressContext';
import {
  advanceSlides,
  answerInquiry,
  completeWorkedLadder,
  solveProblemSet,
  type LessonUser,
} from './lessonDriver';

// Wave 3 re-enables this end-to-end walk. It needs the authored lessons (a real
// Phase 1 review pool and graded Phase 5 problems) plus the grading mocks the
// ProblemPlayer suite uses, none of which exist on the Foundation. Until then the
// graded phases cannot complete, so the full per-lesson walk stays skipped; the
// driver helpers it relies on are exercised by the component suites in the
// meantime.
describe('five-phase lesson walk (Wave 3)', () => {
  it.skip('plays a lesson through all five phases and completes it', async () => {
    const user: LessonUser = userEvent.setup();
    const module = getLessonModule('coulombs-law');
    if (!module) throw new Error('coulombs-law module missing');

    render(
      <MemoryRouter>
        <ProgressProvider>
          <LessonSession
            module={module}
            initialPhase={0}
            initialWithin={0}
            onPhaseChange={() => {}}
            onLessonComplete={() => {}}
          />
        </ProgressProvider>
      </MemoryRouter>,
    );

    await solveProblemSet(user); // Phase 1 review
    await answerInquiry(user); // Phase 2 inquiry
    await advanceSlides(user); // Phase 3 explanation
    await completeWorkedLadder(user); // Phase 4 worked-to-faded
    await solveProblemSet(user); // Phase 5 independent

    expect(screen.getByTestId('phase-bar')).toBeInTheDocument();
  });
});
