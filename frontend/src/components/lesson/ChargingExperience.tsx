import { useEffect, useState } from 'react';
import type { Step } from '../../content';
import { FeedbackRenderer, type AnswerStatus } from './FeedbackRenderer';
import { RichText } from './RichText';
import type { LearnerChoice, LearnerStep } from './lessonExperience';
import { NumericInput } from './interactions/NumericInput';
import { Ordering } from './interactions/Ordering';
import { Step01_StickyBalloon } from './scenes/charging/Step01_StickyBalloon';
import { Step02_TwoMaterials } from './scenes/charging/Step02_TwoMaterials';
import { Step03_ElectronMobility } from './scenes/charging/Step03_ElectronMobility';
import { Step04_ElectronSea } from './scenes/charging/Step04_ElectronSea';
import { Step05_ClassifyMaterials } from './scenes/charging/Step05_ClassifyMaterials';
import { Step06_ChargeNearby } from './scenes/charging/Step06_ChargeNearby';
import { Step07_PolarizeMetal } from './scenes/charging/Step07_PolarizeMetal';
import { Step08_WhichSidePositive } from './scenes/charging/Step08_WhichSidePositive';
import { Step09_WhyAttract } from './scenes/charging/Step09_WhyAttract';
import { Step10_NetPull } from './scenes/charging/Step10_NetPull';
import { Step11_AttractOrRepel } from './scenes/charging/Step11_AttractOrRepel';
import { Step12_ThreeWays } from './scenes/charging/Step12_ThreeWays';
import { Step13_Conduction } from './scenes/charging/Step13_Conduction';
import { Step14_ConductionSign } from './scenes/charging/Step14_ConductionSign';
import { Step15_Grounding } from './scenes/charging/Step15_Grounding';
import { Step16_DrainToGround } from './scenes/charging/Step16_DrainToGround';
import { Step17_InductionTrick } from './scenes/charging/Step17_InductionTrick';
import { Step18_Induction } from './scenes/charging/Step18_Induction';
import { Step19_InductionSign } from './scenes/charging/Step19_InductionSign';
import { Step20_OrderInduction } from './scenes/charging/Step20_OrderInduction';
import { Step21_InsulatorsPolarize } from './scenes/charging/Step21_InsulatorsPolarize';
import { Step22_PolarizeInsulator } from './scenes/charging/Step22_PolarizeInsulator';
import { Step23_SurfaceCharge } from './scenes/charging/Step23_SurfaceCharge';
import { Step24_SpreadToSurface } from './scenes/charging/Step24_SpreadToSurface';
import { Step25_ShareCharge } from './scenes/charging/Step25_ShareCharge';
import { Step26_Summary } from './scenes/charging/Step26_Summary';

export const CHARGING_LESSON_ID = 'charging-conductors-insulators';

// Steps that hide the answer choices until the learner has explored the scene.
const EXPLORE_GATED = new Set([2, 7, 10, 13, 16, 18, 22, 24]);
// Steps where the answer is chosen on the canvas itself (not in the rail).
const STAGE_CHOICE_STEPS = new Set([8]);
// Steps where a confirmation control appears only after a correct prediction.
const REVEAL_ON_CORRECT = new Set<number>();

export function ChargingExperience({
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
      <section
        className="lesson-visual cl1-stage"
        role="group"
        aria-label={sceneLabel(step.stepNumber)}
        data-reveal-confirm={revealConfirm ? 'true' : undefined}
      >
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

    if (interactionType === 'ordering' && step.type === 'interactive' && step.ordering) {
      return <Ordering config={step.ordering} disabled={isCorrect} onResult={reportResult} />;
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
        return <Step01_StickyBalloon />;
      case 2:
        return <Step03_ElectronMobility onExplore={() => setExplored(true)} />;
      case 3:
        return <Step02_TwoMaterials />;
      case 4:
        return <Step04_ElectronSea />;
      case 5:
        return <Step05_ClassifyMaterials />;
      case 6:
        return <Step06_ChargeNearby />;
      case 7:
        return <Step07_PolarizeMetal onExplore={() => setExplored(true)} />;
      case 8:
        return (
          <Step08_WhichSidePositive
            choices={learnerStep.choices}
            disabled={isCorrect}
            onChoose={selectChoice}
            selectedId={selectedChoiceId}
          />
        );
      case 9:
        return <Step09_WhyAttract />;
      case 10:
        return <Step10_NetPull onExplore={() => setExplored(true)} />;
      case 11:
        return <Step11_AttractOrRepel />;
      case 12:
        return <Step12_ThreeWays />;
      case 13:
        return <Step13_Conduction onExplore={() => setExplored(true)} />;
      case 14:
        return <Step14_ConductionSign />;
      case 15:
        return <Step15_Grounding />;
      case 16:
        return <Step16_DrainToGround onExplore={() => setExplored(true)} />;
      case 17:
        return <Step17_InductionTrick />;
      case 18:
        return <Step18_Induction onExplore={() => setExplored(true)} />;
      case 19:
        return <Step19_InductionSign />;
      case 20:
        return <Step20_OrderInduction />;
      case 21:
        return <Step21_InsulatorsPolarize />;
      case 22:
        return <Step22_PolarizeInsulator onExplore={() => setExplored(true)} />;
      case 23:
        return <Step23_SurfaceCharge />;
      case 24:
        return <Step24_SpreadToSurface onExplore={() => setExplored(true)} />;
      case 25:
        return <Step25_ShareCharge />;
      case 26:
        return <Step26_Summary />;
      default:
        return <Step26_Summary />;
    }
  }
}

function exploreHint(stepNumber: number) {
  switch (stepNumber) {
    case 2:
      return 'Tap each material to nudge its electrons, then answer.';
    case 7:
      return 'Drag the rod toward the sphere and watch the electrons, then answer.';
    case 10:
      return 'Drag the rod and watch the net arrow, then answer.';
    case 13:
      return 'Touch the rod to the sphere, then answer.';
    case 16:
      return 'Connect the sphere to ground and watch the electrons, then answer.';
    case 18:
      return 'Step through the induction stages, then answer.';
    case 22:
      return 'Drag the rod near the insulator and watch the molecules, then answer.';
    case 24:
      return 'Add electrons and let them settle, then answer.';
    default:
      return 'Explore the scene first, then answer.';
  }
}

function sceneLabel(stepNumber: number) {
  switch (stepNumber) {
    case 1:
      return 'The sticky balloon';
    case 2:
      return 'Where electrons can move';
    case 3:
      return 'Two kinds of material';
    case 4:
      return 'The sea of free electrons';
    case 5:
      return 'Conductor or insulator';
    case 6:
      return 'Charge nearby disturbs it';
    case 7:
      return 'Polarize the metal';
    case 8:
      return 'Which side turns positive';
    case 9:
      return 'Why neutral things attract';
    case 10:
      return 'See the net pull';
    case 11:
      return 'Attract or repel';
    case 12:
      return 'Three ways to charge';
    case 13:
      return 'Charging by conduction';
    case 14:
      return 'What sign after touching';
    case 15:
      return 'Grounding';
    case 16:
      return 'Drain it to ground';
    case 17:
      return 'The induction trick';
    case 18:
      return 'Charging by induction';
    case 19:
      return 'What sign after induction';
    case 20:
      return 'Order the induction steps';
    case 21:
      return 'Insulators polarize too';
    case 22:
      return 'Polarize an insulator';
    case 23:
      return 'Charge rides the surface';
    case 24:
      return 'Spread to the surface';
    case 25:
      return 'Share the charge';
    default:
      return 'You explained the balloon';
  }
}
