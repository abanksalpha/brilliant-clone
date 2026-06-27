import { Legend, MiniPanel } from '../primitives';
import './Step12_ThreeWays.css';

// Step 12 (concept) - the three ways to give an object a net charge, shown as
// three small labeled panels in a row. Friction is the one the learner already
// met (the balloon); conduction and induction are the two new ones the rest of
// the lesson builds up. Each panel is a static hand-drawn icon that shares the
// sphere, rod, and electron tints used by the conduction (Step 13) and induction
// (Step 18) scenes, so the overview previews exactly what is coming. No props:
// the rail shows the concept body.

const ELEC_R = 5.5;

// A back-and-forth rub indicator drawn as a light double-headed arrow.
function RubArrow() {
  return (
    <g>
      <line className="cci-12-rub" x1={50} x2={100} y1={20} y2={20} />
      <polygon className="cci-12-rub-head" points="50,20 59,15 59,25" />
      <polygon className="cci-12-rub-head" points="100,20 91,15 91,25" />
    </g>
  );
}

// Friction: two different materials rubbed together trade electrons, leaving one
// positive and one negative.
function FrictionFigure() {
  return (
    <svg viewBox="0 0 150 110" data-testid="cci-12-friction" aria-hidden="true">
      <RubArrow />
      <rect className="cci-12-block cci-12-block--a" x={22} y={40} width={52} height={46} rx={12} />
      <rect className="cci-12-block cci-12-block--b" x={76} y={40} width={52} height={46} rx={12} />
      <circle className="cl1-electron cci-12-electron" cx={71} cy={59} r={ELEC_R} />
      <circle className="cl1-electron cci-12-electron" cx={83} cy={64} r={ELEC_R} />
      <text className="cci-12-sign cci-12-sign--pos" x={42} y={70}>
        +
      </text>
      <text className="cci-12-sign cci-12-sign--neg" x={108} y={70}>
        {'\u2212'}
      </text>
    </svg>
  );
}

// Conduction: a charged rod touches the metal sphere, so some of its electrons
// cross over and the sphere ends the same sign as the rod.
function ConductionFigure() {
  return (
    <svg viewBox="0 0 150 110" data-testid="cci-12-conduction" aria-hidden="true">
      <circle className="cci-12-sphere" cx={98} cy={56} r={27} />
      <rect className="cci-12-rod" x={14} y={44} width={58} height={24} rx={12} />
      <text className="cci-12-rod-sign" x={32} y={56}>
        {'\u2212'}
      </text>
      <text className="cci-12-rod-sign" x={52} y={56}>
        {'\u2212'}
      </text>
      <circle className="cl1-electron cci-12-electron" cx={84} cy={50} r={ELEC_R} />
      <circle className="cl1-electron cci-12-electron" cx={104} cy={62} r={ELEC_R} />
    </svg>
  );
}

// Induction: a charged rod is held near the sphere (a visible gap, no contact)
// while a ground wire drains the repelled electrons away to earth.
function InductionFigure() {
  return (
    <svg viewBox="0 0 150 110" data-testid="cci-12-induction" aria-hidden="true">
      <circle className="cci-12-sphere" cx={82} cy={40} r={23} />
      <rect className="cci-12-rod" x={4} y={28} width={46} height={24} rx={12} />
      <text className="cci-12-rod-sign" x={18} y={40}>
        {'\u2212'}
      </text>
      <text className="cci-12-rod-sign" x={36} y={40}>
        {'\u2212'}
      </text>
      <text className="cci-12-sign cci-12-sign--pos" x={64} y={38}>
        +
      </text>
      <circle className="cl1-electron cci-12-electron" cx={96} cy={42} r={ELEC_R} />

      <path className="cci-12-wire" d="M82 63 V83" />
      <circle className="cl1-electron cci-12-electron" cx={82} cy={74} r={ELEC_R} />
      <g className="cci-12-ground">
        <line x1={70} x2={94} y1={85} y2={85} />
        <line x1={74} x2={90} y1={90} y2={90} />
        <line x1={78} x2={86} y1={95} y2={95} />
      </g>
    </svg>
  );
}

export function Step12_ThreeWays() {
  return (
    <>
      <div className="cci-12-row" data-testid="cci-12-row">
        <MiniPanel title="Friction">
          <FrictionFigure />
          <p>Rub two materials together.</p>
        </MiniPanel>
        <MiniPanel title="Conduction">
          <ConductionFigure />
          <p>Touch shares the same sign.</p>
        </MiniPanel>
        <MiniPanel title="Induction">
          <InductionFigure />
          <p>Hold near, then ground it.</p>
        </MiniPanel>
      </div>
      <Legend text="There are three ways to give an object a net charge. Friction you have met with the balloon. Conduction charges by touching, and induction charges without touching by using a nearby charge and a ground." />
    </>
  );
}
