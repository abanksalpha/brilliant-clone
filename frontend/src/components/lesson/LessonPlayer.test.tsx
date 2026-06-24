import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { getCourseLessons, getLessonById, type Lesson } from '../../content';
import { ADVANCE_LABEL, completeCurrentStep, revealLessonOneGates } from '../../test/lessonDriver';
import { LessonPlayer } from './LessonPlayer';

function renderLessonPlayer(
  lesson: Lesson,
  options?: {
    onLessonComplete?: (lessonId: string) => number | void;
    onQuestionAnswered?: (lessonId: string, stepNumber: number) => number | void;
    initialStepIndex?: number;
  },
) {
  return render(
    <MemoryRouter>
      <LessonPlayer
        initialStepIndex={options?.initialStepIndex}
        lesson={lesson}
        onLessonComplete={options?.onLessonComplete}
        onQuestionAnswered={options?.onQuestionAnswered}
      />
    </MemoryRouter>,
  );
}

function getChoiceButton(choiceText: string) {
  return screen.getByRole('button', {
    name: (_name, element) => {
      const visibleChoiceText = element?.textContent?.trim();

      return visibleChoiceText === choiceText;
    },
  });
}

describe('LessonPlayer', () => {
  it('renders progress without step or total-step copy', () => {
    const lesson = getLessonById('coulombs-law')!;

    renderLessonPlayer(lesson);

    expect(screen.getByText('Progress')).toBeInTheDocument();
    expect(screen.queryByText(/^Step \d+/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\d+ total/)).not.toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Course progress' })).toBeInTheDocument();
  });

  it('lets learners click back to any previously visited screen', async () => {
    const user = userEvent.setup();
    const navLesson: Lesson = {
      lessonId: 'segment-nav-test',
      lessonNumber: 97,
      title: 'Segment Navigation Test',
      sourceFile: 'lesson-segment-nav-test.json',
      prerequisites: [],
      targetIntuitions: [],
      learningArc: 'Verify visited segment navigation.',
      counts: {
        totalSteps: 4,
        interactiveProblems: 0,
        conceptCards: 4,
      },
      steps: [
        {
          stepNumber: 1,
          type: 'concept',
          title: 'Screen One',
          body: 'First screen',
          visual: { type: 'text-description', description: 'One' },
        },
        {
          stepNumber: 2,
          type: 'concept',
          title: 'Screen Two',
          body: 'Second screen',
          visual: { type: 'text-description', description: 'Two' },
        },
        {
          stepNumber: 3,
          type: 'concept',
          title: 'Screen Three',
          body: 'Third screen',
          visual: { type: 'text-description', description: 'Three' },
        },
        {
          stepNumber: 4,
          type: 'concept',
          title: 'Screen Four',
          body: 'Fourth screen',
          visual: { type: 'text-description', description: 'Four' },
        },
      ],
    };

    renderLessonPlayer(navLesson);

    await user.click(screen.getByRole('button', { name: ADVANCE_LABEL }));
    await user.click(screen.getByRole('button', { name: ADVANCE_LABEL }));

    const firstScreenSegment = screen.getByRole('button', { name: 'Go to screen 1' });
    const fourthScreenSegment = screen.getByRole('button', { name: 'Go to screen 4' });
    expect(fourthScreenSegment).toBeDisabled();

    await user.click(firstScreenSegment);
    expect(screen.getByText('First screen')).toBeInTheDocument();
  });

  it('does not expose authoring artifacts while progressing through every lesson', async () => {
    const user = userEvent.setup();
    const hiddenAuthoringText =
      /Step \d+|\d+ total|Visual sketch|Interactive|Concept|As learner|After dragging|Correct trigger|Learner must identify|This interaction will use a dedicated simulation|Lesson \d/;

    for (const lesson of getCourseLessons()) {
      const rendered = renderLessonPlayer(lesson);

      for (const step of lesson.steps) {
        expect(screen.queryByText(hiddenAuthoringText)).not.toBeInTheDocument();
        await completeCurrentStep(user, step);
      }

      rendered.unmount();
    }
  });

  it('renders answer choices without authoring IDs', () => {
    const lesson = getLessonById('coulombs-law')!;

    // Step 6 (drag) reveals its choices after exploration; jump straight there.
    renderLessonPlayer(lesson, { initialStepIndex: 5 });
    revealLessonOneGates();

    expect(
      getChoiceButton('It pulls them together, and grows as they get closer'),
    ).toBeInTheDocument();
    expect(screen.queryByText('A')).not.toBeInTheDocument();
    expect(screen.queryByText('B')).not.toBeInTheDocument();
    expect(screen.queryByText('C')).not.toBeInTheDocument();
  });

  it('does not render visual role labels, captions, or diagnostic readouts in charge scenes', async () => {
    const user = userEvent.setup();
    const lesson = getLessonById('coulombs-law')!;

    renderLessonPlayer(lesson);

    expect(screen.queryByText('positive')).not.toBeInTheDocument();
    expect(screen.queryByText('negative')).not.toBeInTheDocument();
    expect(screen.queryByText(/Charge signs and spacing/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.queryByText('positive source')).not.toBeInTheDocument();
    expect(screen.queryByText('negative test charge')).not.toBeInTheDocument();
    expect(screen.queryByText('Force direction')).not.toBeInTheDocument();
    expect(screen.queryByText('attraction')).not.toBeInTheDocument();
    expect(screen.queryByText(/Opposite signs attract/)).not.toBeInTheDocument();

    await completeCurrentStep(user, lesson.steps[1]);

    expect(screen.queryByText('+ and +')).not.toBeInTheDocument();
    expect(screen.queryByText('+ and -')).not.toBeInTheDocument();
    expect(screen.queryByText('repulsion and attraction')).not.toBeInTheDocument();
    expect(screen.queryByText(/Same signs repel outward/)).not.toBeInTheDocument();
  });

  it('does not show internal interaction notes as learner copy', async () => {
    const user = userEvent.setup();
    const lesson = getLessonById('coulombs-law')!;

    renderLessonPlayer(lesson);

    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.queryByText('Interactive')).not.toBeInTheDocument();
    expect(screen.queryByText(/As learner drags/)).not.toBeInTheDocument();
    expect(screen.queryByText(/After dragging/)).not.toBeInTheDocument();
  });

  it('renders lesson visual tables as real tables', () => {
    const lesson = getLessonById('coulombs-law')!;

    // Step 10 introduces the distance/force table.
    renderLessonPlayer(lesson, { initialStepIndex: 9 });

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Distance' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Force' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '2r' })).toBeInTheDocument();
  });

  it('can step through every lesson without visible authoring notes', async () => {
    const user = userEvent.setup();
    const hiddenAuthoringText = /As learner|After dragging|Correct trigger|Learner must identify/;

    for (const lesson of getCourseLessons()) {
      const rendered = renderLessonPlayer(lesson);

      for (const step of lesson.steps) {
        expect(screen.queryByText(hiddenAuthoringText)).not.toBeInTheDocument();
        await completeCurrentStep(user, step);
      }

      expect(screen.getByText('You finished this topic.')).toBeInTheDocument();
      rendered.unmount();
    }
  });

  it('animates question XP after a newly answered question', async () => {
    const user = userEvent.setup();
    const microLesson: Lesson = {
      lessonId: 'question-xp-test',
      lessonNumber: 98,
      title: 'Question XP Test',
      sourceFile: 'lesson-question-test.json',
      prerequisites: [],
      targetIntuitions: [],
      learningArc: 'Single interactive question to verify XP burst animation.',
      counts: {
        totalSteps: 2,
        interactiveProblems: 1,
        conceptCards: 1,
      },
      steps: [
        {
          stepNumber: 1,
          type: 'interactive',
          interactionType: 'multiple-choice',
          prompt: 'What is 1 + 1?',
          visual: {
            type: 'text-description',
            description: 'Simple arithmetic prompt',
          },
          choices: [
            { id: 'a', text: '2', correct: true },
            { id: 'b', text: '3', correct: false },
          ],
          feedback: {
            correct: 'Correct.',
            wrong: [{ text: 'Try again.' }],
          },
        },
        {
          stepNumber: 2,
          type: 'concept',
          title: 'Done',
          body: 'Concept wrap-up',
          visual: {
            type: 'text-description',
            description: 'Simple concept card',
          },
        },
      ],
    };

    renderLessonPlayer(microLesson, {
      onQuestionAnswered: () => 20,
    });

    await user.click(getChoiceButton('2'));
    await user.click(screen.getByRole('button', { name: ADVANCE_LABEL }));

    expect(screen.getByTestId('lesson-xp-burst')).toHaveTextContent('+20 XP');
  });

  it('shows XP reward copy when lesson completion grants XP', async () => {
    const user = userEvent.setup();
    const microLesson: Lesson = {
      lessonId: 'xp-reward-test',
      lessonNumber: 99,
      title: 'XP Reward Test',
      sourceFile: 'lesson-test.json',
      prerequisites: [],
      targetIntuitions: [],
      learningArc: 'Single-step completion for reward verification.',
      counts: {
        totalSteps: 1,
        interactiveProblems: 0,
        conceptCards: 1,
      },
      steps: [
        {
          stepNumber: 1,
          type: 'concept',
          title: 'Complete me',
          body: 'One step',
          visual: {
            type: 'text-description',
            description: 'Simple visual',
          },
        },
      ],
    };

    renderLessonPlayer(microLesson, {
      onLessonComplete: () => 120,
    });

    await user.click(screen.getByRole('button', { name: ADVANCE_LABEL }));

    expect(screen.getByText('You finished this topic.')).toBeInTheDocument();
    expect(screen.getByTestId('lesson-xp-earned')).toHaveTextContent('+120 XP');
    expect(screen.getByText('Reward unlocked')).toBeInTheDocument();
  });
});
