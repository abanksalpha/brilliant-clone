import { useEffect, useState } from 'react';
import type { Step } from '../../content';
import { FeedbackRenderer, type AnswerStatus } from './FeedbackRenderer';
import { RichText } from './RichText';
import type { LearnerChoice, LearnerStep } from './lessonExperience';
import { BuildFormula } from './interactions/BuildFormula';
import { ChargeSandbox } from './interactions/ChargeSandbox';
import { NumericInput } from './interactions/NumericInput';
import { VectorAim } from './interactions/VectorAim';
import {
  AtomScene,
  CancelScene,
  ChargeNeededScene,
  DirectionScene,
  DistanceTableScene,
  ForceFieldScene,
  FormulaNameScene,
  HookScene,
  NumericChargeScene,
  NumericComputeScene,
  NumericDistanceScene,
  SummaryScene,
  SuperpositionScene,
  TwoDialsScene,
  UnitsScene,
  WhySquaredScene,
} from './scenes/conceptScenes';
import {
  AttractionDragScene,
  ChargeSliderScene,
  CompareSignsTapScene,
  InverseSquareSliderScene,
  PredictionScene,
  RepulsionDragScene,
  RubTransferScene,
} from './scenes/interactiveScenes';

export const COULOMB_LESSON_ID = 'coulombs-law';

// Steps that hide the answer choices until the learner has explored the scene.
const EXPLORE_GATED = new Set([3, 6, 8, 11, 16, 25]);
// Steps where a confirmation control appears only after a correct prediction.
const REVEAL_ON_CORRECT = new Set([12]);
// Steps where the answer is chosen on the canvas itself (not in the rail).
const STAGE_CHOICE_STEPS = new Set([7]);

export function CoulombExperience({
  isFinalStep,
  learnerStep,
  onContinue,
  step,
}: {
  isFinalStep: boolean;
  learnerStep: LearnerStep;
  onContinue: () => void;
  step: Step;
}) {
  const [status, setStatus] = useState<AnswerStatus | null>(null);
  const [wrongChoiceId, setWrongChoiceId] = useState<string | undefined>(undefined);
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | undefined>(undefined);
  const [explored, setExplored] = useState(!EXPLORE_GATED.has(step.stepNumber));

  useEffect(() => {
    setStatus(null);
    setWrongChoiceId(undefined);
    setSelectedChoiceId(undefined);
    setExplored(!EXPLORE_GATED.has(step.stepNumber));
  }, [step.stepNumber]);

  const isConcept = step.type === 'concept';
  const interactionType = step.type === 'interactive' ? step.interactionType : null;
  const isCorrect = status === 'correct';
  const revealConfirm = REVEAL_ON_CORRECT.has(step.stepNumber) && isCorrect;

  function selectChoice(choice: LearnerChoice) {
    if (isCorrect) return;
    setSelectedChoiceId(choice.id);
    setStatus(choice.correct ? 'correct' : 'wrong');
    setWrongChoiceId(choice.correct ? undefined : choice.id);
  }

  function reportResult(next: AnswerStatus) {
    setStatus(next);
    if (next === 'wrong') setWrongChoiceId(undefined);
  }

  function retry() {
    setStatus(null);
    setWrongChoiceId(undefined);
    setSelectedChoiceId(undefined);
  }

  const railChoices =
    step.type === 'interactive' &&
    learnerStep.choices.length > 0 &&
    !STAGE_CHOICE_STEPS.has(step.stepNumber);

  return (
    <article className="lesson-experience cl1-experience" key={step.stepNumber}>
      <section className="lesson-visual cl1-stage" role="group" aria-label={sceneLabel(step.stepNumber)}>
        {renderStage()}
      </section>

      <div className={`experience-panel cl1-rail${isConcept ? ' experience-panel-concept' : ''}`}>
        {isConcept ? (
          <>
            <p className="eyebrow">Key idea</p>
            {learnerStep.body ? <RichText text={learnerStep.body} /> : null}
            <button className="secondary-button" type="button" onClick={onContinue}>
              {isFinalStep ? 'Finish lesson' : 'Continue'}
            </button>
          </>
        ) : (
          <>
            <h2>{learnerStep.prompt}</h2>
            {renderResponder()}
            <FeedbackRenderer
              status={status}
              wrongChoiceId={wrongChoiceId}
              isFinalStep={isFinalStep}
              step={learnerStep}
              onContinue={onContinue}
              onRetry={retry}
            />
          </>
        )}
      </div>
    </article>
  );

  function renderResponder() {
    if (interactionType === 'numeric' && step.type === 'interactive' && step.numeric) {
      return <NumericInput config={step.numeric} disabled={isCorrect} onResult={reportResult} />;
    }

    if (railChoices) {
      if (!explored) {
        return <p className="cl1-hint">{exploreHint(step.stepNumber)}</p>;
      }
      return (
        <div className="choice-list" aria-label="Predictions">
          {learnerStep.choices.map((choice) => (
            <button
              className="choice-button"
              disabled={isCorrect}
              key={choice.id}
              type="button"
              onClick={() => selectChoice(choice)}
            >
              {choice.text}
            </button>
          ))}
        </div>
      );
    }

    return null;
  }

  function renderStage() {
    switch (step.stepNumber) {
      case 1:
        return <HookScene />;
      case 2:
        return <AtomScene />;
      case 3:
        return <RubTransferScene onExplore={() => setExplored(true)} />;
      case 4:
        return <ChargeNeededScene />;
      case 5:
        return <ForceFieldScene />;
      case 6:
        return <AttractionDragScene onExplore={() => setExplored(true)} />;
      case 7:
        return (
          <CompareSignsTapScene
            choices={learnerStep.choices}
            disabled={isCorrect}
            onChoose={selectChoice}
            selectedId={selectedChoiceId}
          />
        );
      case 8:
        return <RepulsionDragScene onExplore={() => setExplored(true)} />;
      case 9:
        return step.type === 'interactive' && step.vectorAim ? (
          <VectorAim config={step.vectorAim} disabled={isCorrect} onResult={reportResult} />
        ) : null;
      case 10:
        return <DistanceTableScene />;
      case 11:
        return <InverseSquareSliderScene onExplore={() => setExplored(true)} />;
      case 12:
        return <PredictionScene revealConfirm={revealConfirm} />;
      case 13:
        return <WhySquaredScene />;
      case 14:
        return <NumericDistanceScene />;
      case 15:
        return <TwoDialsScene />;
      case 16:
        return <ChargeSliderScene onExplore={() => setExplored(true)} />;
      case 17:
        return <NumericChargeScene />;
      case 18:
        return step.type === 'interactive' && step.buildFormula ? (
          <BuildFormula config={step.buildFormula} disabled={isCorrect} onResult={reportResult} />
        ) : null;
      case 19:
        return <FormulaNameScene />;
      case 20:
        return <UnitsScene />;
      case 21:
        return <NumericComputeScene />;
      case 22:
        return <DirectionScene />;
      case 23:
        return <CancelScene />;
      case 24:
        return <SuperpositionScene />;
      case 25:
        return step.type === 'interactive' && step.sandbox ? (
          <ChargeSandbox config={step.sandbox} disabled={isCorrect} onExplore={() => setExplored(true)} />
        ) : null;
      case 26:
        return step.type === 'interactive' && step.sandbox ? (
          <ChargeSandbox config={step.sandbox} disabled={isCorrect} onResult={reportResult} />
        ) : null;
      default:
        return <SummaryScene />;
    }
  }
}

function exploreHint(stepNumber: number) {
  switch (stepNumber) {
    case 3:
      return 'Rub the two objects together first, then answer.';
    case 6:
      return 'Drag the blue charge toward the red one, then make your prediction.';
    case 8:
      return 'Drag the charge farther away and watch the arrow shrink, then answer.';
    case 11:
      return 'Move the distance slider and read the force, then answer.';
    case 16:
      return 'Move the charge slider and read the force, then answer.';
    case 25:
      return 'Drag the test charge around the board, then answer.';
    default:
      return 'Explore the scene first, then answer.';
  }
}

function sceneLabel(stepNumber: number) {
  switch (stepNumber) {
    case 1:
      return 'Everyday static electricity';
    case 2:
      return 'Inside an atom';
    case 3:
      return 'Charging by transferring electrons';
    case 4:
      return 'What an electric force needs';
    case 5:
      return 'Force across empty space';
    case 6:
      return 'Opposite charges attract';
    case 7:
      return 'Attraction versus repulsion';
    case 8:
      return 'Repulsion weakens with distance';
    case 9:
      return 'Aim the force arrow';
    case 10:
      return 'Distance and force table';
    case 11:
      return 'Inverse-square slider';
    case 12:
      return 'Predict the force at 4r';
    case 13:
      return 'Why distance is squared';
    case 14:
      return 'Force at five times the distance';
    case 15:
      return 'Distance and charge dials';
    case 16:
      return 'Charge scaling slider';
    case 17:
      return 'Combined charge scaling';
    case 18:
      return 'Build Coulombs Law';
    case 19:
      return 'Coulombs Law named';
    case 20:
      return 'Units of charge and force';
    case 21:
      return 'Compute the force';
    case 22:
      return 'Direction of the force';
    case 23:
      return 'Two factors that cancel';
    case 24:
      return 'Superposition of forces';
    case 25:
      return 'Charge sandbox';
    case 26:
      return 'Find the balance point';
    default:
      return 'Coulombs Law summary';
  }
}
