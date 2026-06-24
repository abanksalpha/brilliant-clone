import { FormulaCaption, FormulaDisplay, Fraction, RuleList } from '../conceptVisuals';
import { Arrow, Charge, Figure, Legend, MiniPanel } from './primitives';

// Step 1 - everyday static electricity hook (balloon clinging to hair).
export function HookScene() {
  return (
    <>
      <Figure>
        <g className="cl1-hook">
          <ellipse className="cl1-balloon" cx={132} cy={104} rx={52} ry={64} />
          <polygon className="cl1-balloon-knot" points="132,168 126,180 138,180" />
          <path className="cl1-balloon-string" d="M132 180 q 14 22 -6 36" fill="none" />
          <g transform="translate(-44 0)">
            {[0, 1, 2, 3, 4].map((index) => (
              <path
                key={index}
                className="cl1-hair"
                d={`M232 ${72 + index * 18} q -34 ${2 + index} -52 -2`}
                fill="none"
              />
            ))}
          </g>
          {[
            [196, 78],
            [188, 120],
            [200, 150],
          ].map(([x, y]) => (
            <text key={`${x}-${y}`} className="cl1-spark" x={x} y={y}>
              +
            </text>
          ))}
        </g>
      </Figure>
      <Legend text="A balloon rubbed on hair tugs the strands toward it without touching. That invisible tug is electric charge." />
    </>
  );
}

// Step 2 - atoms carry protons and electrons.
export function AtomScene() {
  return (
    <>
      <Figure>
        <ellipse className="cl1-orbit" cx={180} cy={110} rx={120} ry={66} />
        <g>
          <Charge x={166} y={104} sign="+" r={15} />
          <Charge x={194} y={116} sign="+" r={15} />
          <Charge x={181} y={92} sign="neutral" r={13} />
        </g>
        <Charge x={60} y={110} sign="-" r={13} />
        <Charge x={300} y={110} sign="-" r={13} />
      </Figure>
      <Legend text="Every atom has a core of protons (+) with electrons (-) around it. Balanced numbers make an atom neutral overall." />
    </>
  );
}

// Step 4 - what is required for an electric force (static support for an MCQ).
export function ChargeNeededScene() {
  return (
    <>
      <Figure>
        <Charge x={110} y={110} sign="+" />
        <Charge x={250} y={110} sign="-" />
        <line className="cl1-aim-axis" x1={134} x2={226} y1={110} y2={110} />
        <text className="cl1-big-question" x={180} y={86} textAnchor="middle">
          ?
        </text>
      </Figure>
      <Legend text="What does it take for two objects to push or pull each other across a gap like this?" />
    </>
  );
}

// Step 5 - the electric force acts across empty space.
export function ForceFieldScene() {
  return (
    <>
      <Figure>
        <Charge x={104} y={110} sign="+" />
        <Charge x={256} y={110} sign="-" />
        <Arrow x1={134} x2={170} y1={110} y2={110} />
        <Arrow x1={226} x2={190} y1={110} y2={110} />
      </Figure>
      <Legend text="No strings, no contact. The charges still pull on each other straight across the empty gap." />
    </>
  );
}

// Step 10 - distance/force table setup.
export function DistanceTableScene() {
  return (
    <>
      <Figure>
        <Charge x={104} y={84} sign="+" />
        <Charge x={218} y={84} sign="+" />
        <Arrow x1={246} x2={284} y1={84} y2={84} />
      </Figure>
      <div className="rich-table-wrap">
        <table className="rich-table cl1-table">
          <thead>
            <tr>
              <th>Distance</th>
              <th>Force</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>r</td>
              <td>F</td>
            </tr>
            <tr>
              <td>2r</td>
              <td>?</td>
            </tr>
            <tr>
              <td>3r</td>
              <td>?</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

// Step 13 - why the force is squared (influence spreads over a sphere).
export function WhySquaredScene() {
  return (
    <>
      <Figure>
        {[34, 64, 94].map((radius, index) => (
          <circle
            key={radius}
            className="cl1-shell"
            cx={120}
            cy={100}
            r={radius}
            style={{ opacity: 0.7 - index * 0.18 }}
          />
        ))}
        <Charge x={120} y={100} sign="+" r={14} />
        <text className="cl1-shell-label" x={120} y={211} textAnchor="middle">
          area grows as r squared
        </text>
      </Figure>
      <Legend text="The same influence spreads over a bigger and bigger sphere. Surface area grows as r squared, so the force thins out as one over r squared." />
    </>
  );
}

// Step 15 - two independent dials: distance vs charge.
export function TwoDialsScene() {
  return (
    <div className="cl1-compare-grid">
      <MiniPanel title="Distance">
        <svg viewBox="0 0 160 100" aria-hidden="true">
          <Charge x={44} y={52} sign="+" r={14} />
          <Charge x={120} y={52} sign="+" r={14} />
          <Arrow x1={138} x2={154} y1={52} y2={52} />
        </svg>
        <p>2x distance, one quarter force</p>
      </MiniPanel>
      <MiniPanel title="Charge">
        <svg viewBox="0 0 160 100" aria-hidden="true">
          <Charge x={44} y={52} sign="+" r={14} />
          <Charge x={104} y={52} sign="+" r={19} />
          <Arrow x1={130} x2={156} y1={52} y2={52} />
        </svg>
        <p>2x charge, double force</p>
      </MiniPanel>
    </div>
  );
}

// Step 14 - numeric: force at 5r (visual support).
export function NumericDistanceScene() {
  return (
    <>
      <Figure>
        <text className="cl1-row-label" x={20} y={66}>
          r
        </text>
        <Charge x={70} y={64} sign="+" r={13} />
        <Charge x={128} y={64} sign="+" r={13} />
        <Arrow x1={144} x2={188} y1={64} y2={64} />
        <text className="cl1-row-value" x={210} y={70}>
          F
        </text>

        <text className="cl1-row-label" x={20} y={154}>
          5r
        </text>
        <Charge x={70} y={152} sign="+" r={13} />
        <Charge x={300} y={152} sign="+" r={13} />
        <Arrow x1={316} x2={326} y1={152} y2={152} />
        <text className="cl1-row-value" x={300} y={196} textAnchor="middle">
          ?
        </text>
      </Figure>
      <Legend text="Same charges, five times farther apart. How big is the force compared with F?" />
    </>
  );
}

// Step 17 - numeric: combined charge scaling (visual support).
export function NumericChargeScene() {
  return (
    <>
      <Figure>
        <Charge x={96} y={110} sign="+" r={28} />
        <text className="cl1-row-label" x={96} y={170} textAnchor="middle">
          q1 x3
        </text>
        <Charge x={250} y={110} sign="+" r={23} />
        <text className="cl1-row-label" x={250} y={170} textAnchor="middle">
          q2 x2
        </text>
        <Arrow x1={278} x2={326} y1={110} y2={110} />
      </Figure>
      <Legend text="Distance is unchanged. One charge is tripled, the other doubled. What happens to the force?" />
    </>
  );
}

// Step 19 - name and constant.
export function FormulaNameScene() {
  return (
    <div className="cl1-formula-scene" data-testid="cl1-formula-scene">
      <FormulaDisplay>
        <span className="formula-term">F</span>
        <span className="formula-op">=</span>
        <span className="formula-term">k</span>
        <Fraction
          denominator={
            <>
              <span className="formula-term">r</span>
              <sup>2</sup>
            </>
          }
          numerator={
            <span className="cl1-formula-symbol">
              q<sub>1</sub>q<sub>2</sub>
            </span>
          }
        />
      </FormulaDisplay>
      <FormulaCaption>
        k = 8.99 x 10<sup>9</sup> N*m<sup>2</sup>/C<sup>2</sup>, Coulomb&apos;s constant.
      </FormulaCaption>
    </div>
  );
}

// Step 20 - units.
export function UnitsScene() {
  return (
    <div className="cl1-summary-stack cl1-summary-stack--center">
      <RuleList
        rules={[
          { detail: 'Charge is measured in coulombs (C).', icon: 'C', term: 'Charge' },
          { detail: 'One electron carries 1.6 x 10^-19 C, so one coulomb is a huge amount.', icon: 'e', term: 'Electron' },
          { detail: 'Force comes out in newtons (N).', icon: 'N', term: 'Force' },
        ]}
      />
    </div>
  );
}

// Step 21 - numeric: real computation (visual support).
export function NumericComputeScene() {
  return (
    <>
      <Figure>
        <Charge x={108} y={110} sign="+" />
        <Charge x={252} y={110} sign="+" />
        <text className="cl1-row-label" x={108} y={166} textAnchor="middle">
          3 C
        </text>
        <text className="cl1-row-label" x={252} y={166} textAnchor="middle">
          4 C
        </text>
        <line className="cl1-aim-axis" x1={126} x2={234} y1={92} y2={92} />
        <text className="cl1-row-value" x={180} y={84} textAnchor="middle">
          2 m
        </text>
      </Figure>
      <Legend text="A 3 C charge and a 4 C charge, two meters apart. Use k about 9 x 10^9 to find the force in newtons." />
    </>
  );
}

// Step 22 - direction and Newton's third law.
export function DirectionScene() {
  return (
    <>
      <Figure>
        <Charge x={108} y={110} sign="+" />
        <Charge x={252} y={110} sign="-" />
        <Arrow x1={134} x2={176} y1={110} y2={110} />
        <Arrow x1={226} x2={184} y1={110} y2={110} />
      </Figure>
      <Legend text="The force lies along the line joining the charges, and each charge feels an equal pull in the opposite direction." />
    </>
  );
}

// Step 23 - cancel: double distance and both charges (visual support for MCQ).
export function CancelScene() {
  return (
    <div className="cl1-compare-grid">
      <MiniPanel title="Start">
        <svg viewBox="0 0 160 100" aria-hidden="true">
          <Charge x={44} y={52} sign="+" r={14} />
          <Charge x={96} y={52} sign="+" r={14} />
          <Arrow x1={120} x2={152} y1={52} y2={52} />
        </svg>
        <p>Force F</p>
      </MiniPanel>
      <MiniPanel title="Double both charges and the distance">
        <svg viewBox="0 0 160 100" aria-hidden="true">
          <Charge x={32} y={52} sign="+" r={18} />
          <Charge x={116} y={52} sign="+" r={18} />
          <Arrow x1={128} x2={156} y1={52} y2={52} />
        </svg>
        <p>Force = ?</p>
      </MiniPanel>
    </div>
  );
}

// Step 24 - superposition: forces add as vectors.
export function SuperpositionScene() {
  return (
    <>
      <Figure>
        <Charge x={70} y={70} sign="+" r={15} />
        <Charge x={70} y={156} sign="+" r={15} />
        <Charge x={210} y={112} sign="-" r={16} />
        <Arrow x1={210} x2={150} y1={112} y2={84} tone="net" />
        <Arrow x1={210} x2={150} y1={112} y2={140} tone="net" />
        <Arrow x1={210} x2={120} y1={112} y2={112} />
      </Figure>
      <Legend text="Each charge pulls on the test charge on its own. Add those pulls like arrows to get the single net force." />
    </>
  );
}

// Step 27 - summary.
export function SummaryScene() {
  return (
    <div className="cl1-summary-stack">
      <FormulaDisplay>
        <span className="formula-term">F</span>
        <span className="formula-op">=</span>
        <span className="formula-term">k</span>
        <Fraction
          denominator={
            <>
              <span className="formula-term">r</span>
              <sup>2</sup>
            </>
          }
          numerator={
            <>
              <span className="formula-term">q</span>
              <sub>1</sub>
              <span className="formula-term">q</span>
              <sub>2</sub>
            </>
          }
        />
      </FormulaDisplay>
      <RuleList
        rules={[
          { detail: 'Opposite signs attract. Same signs repel.', icon: '±', term: 'Sign' },
          { detail: 'Doubling distance makes force one quarter.', icon: '1/r²', term: 'Distance' },
          { detail: 'Doubling either charge doubles force.', icon: '2q', term: 'Charge' },
          { detail: 'Many charges? Add their forces as vectors.', icon: 'Σ', term: 'Superposition' },
        ]}
      />
    </div>
  );
}
