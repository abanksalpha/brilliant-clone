import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { Link, Navigate } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';

const COURSE_GROUPS = [
  {
    subject: 'Math',
    courses: ['Precalculus', 'Calculus AB', 'Calculus BC', 'Statistics'],
  },
  {
    subject: 'Science',
    courses: [
      'Biology',
      'Chemistry',
      'Environmental Science',
      'Physics 1',
      'Physics 2',
      'Physics C: Mechanics',
      'Physics C: Electricity & Magnetism',
    ],
  },
  {
    subject: 'Computer science',
    courses: ['Computer Science A', 'Computer Science Principles'],
  },
  {
    subject: 'English',
    courses: ['English Language', 'English Literature'],
  },
  {
    subject: 'History & social science',
    courses: [
      'US History',
      'World History: Modern',
      'European History',
      'US Government & Politics',
      'Psychology',
      'Macroeconomics',
      'Microeconomics',
      'Human Geography',
    ],
  },
];

type Point = { x: number; y: number };
type Charge = { id: string; q: number; x: number; y: number };

const VIEW = { w: 440, h: 340 };
const CHARGE_R = 18;

// Field-line (streamline) tracing.
const LINES_PER_CHARGE = 20; // field lines seeded around each positive charge
const TRACE_STEP = 5; // arc-length per integration step on-screen, in viewBox units
const TRACE_ANG = 0.09; // off-screen step as a fraction of distance-to-charge (~5 deg of a loop)
const TRACE_STEP_MAX = 2400; // sanity cap on a single off-screen step
const TRACE_MAX_STEPS = 1000; // cap so a line still terminates even when it never returns
// Trace lines WAY past the viewBox: a line leaving the back of the positive charge arcs out
// through (clipped) off-screen space and comes back into the negative charge from behind, so
// the two charges end up with matching lines on their far sides. Off-screen the step grows
// with distance from the charges (constant angular resolution, see stepSize), so a loop of ANY
// size costs about the same handful of steps and this enormous margin stays cheap. The SVG
// clips everything outside the frame, so on-screen the lines still meet the border cleanly.
const TRACE_MARGIN = { x: VIEW.w * 260, y: VIEW.h * 260 };
const SEED_RADIUS = CHARGE_R + 3; // start lines just outside the charge disc
const CAPTURE_RADIUS = CHARGE_R + 2; // a line that gets this close to a charge terminates on it
const MIN_FIELD = 1e-13; // so weak the line has effectively stalled; tiny enough to let wide loops run far out
const HEAD_SPACING = 13; // integration steps between direction arrowheads along a line
const HEAD_LEN = 6;
const HEAD_W = 3.4;

const DRAG_BOUND = { x0: 54, y0: 54, x1: 386, y1: 286 };
const MIN_SEPARATION = 54;
const KEY_STEP = 6;

const INITIAL_CHARGES: Charge[] = [
  { id: 'a', q: 1, x: 140, y: 180 },
  { id: 'b', q: -1, x: 288, y: 170 },
];

// Electric field vector (superposition of the point charges) at p.
function fieldAt(p: Point, charges: Charge[]): Point {
  let ex = 0;
  let ey = 0;
  for (const c of charges) {
    const dx = p.x - c.x;
    const dy = p.y - c.y;
    const r2 = dx * dx + dy * dy || 1e-6;
    const invR3 = c.q / (r2 * Math.sqrt(r2));
    ex += dx * invR3;
    ey += dy * invR3;
  }
  return { x: ex, y: ey };
}

function round1(n: number): string {
  return (Math.round(n * 10) / 10).toString();
}

// Unit field direction at p (optionally reversed for negative seeds). Returns null
// where the field is effectively zero so the tracer can stop at a saddle point.
function fieldDir(p: Point, charges: Charge[], sign: number): Point | null {
  const f = fieldAt(p, charges);
  const m = Math.hypot(f.x, f.y);
  if (m < MIN_FIELD) return null;
  return { x: (f.x / m) * sign, y: (f.y / m) * sign };
}

// Integration step length: fine (TRACE_STEP) while the line is on or near the screen so the
// visible curve and the spot where it re-enters the frame stay accurate; far off-screen it
// scales with the distance to the nearest charge, giving a roughly constant angular resolution
// so a loop of any size, however enormous, is traced in about the same number of steps.
function stepSize(p: Point, charges: Charge[]): number {
  if (p.x > -24 && p.x < VIEW.w + 24 && p.y > -24 && p.y < VIEW.h + 24) return TRACE_STEP;
  let r = Infinity;
  for (const c of charges) r = Math.min(r, Math.hypot(p.x - c.x, p.y - c.y));
  return Math.min(Math.max(TRACE_STEP, r * TRACE_ANG), TRACE_STEP_MAX);
}

// One RK4 step along the normalized field, so spacing is by arc length (even steps).
function rk4Step(p: Point, charges: Charge[], sign: number): Point | null {
  const h = stepSize(p, charges);
  const k1 = fieldDir(p, charges, sign);
  if (!k1) return null;
  const k2 = fieldDir({ x: p.x + (k1.x * h) / 2, y: p.y + (k1.y * h) / 2 }, charges, sign);
  if (!k2) return null;
  const k3 = fieldDir({ x: p.x + (k2.x * h) / 2, y: p.y + (k2.y * h) / 2 }, charges, sign);
  if (!k3) return null;
  const k4 = fieldDir({ x: p.x + k3.x * h, y: p.y + k3.y * h }, charges, sign);
  if (!k4) return null;
  return {
    x: p.x + (h / 6) * (k1.x + 2 * k2.x + 2 * k3.x + k4.x),
    y: p.y + (h / 6) * (k1.y + 2 * k2.y + 2 * k3.y + k4.y),
  };
}

// Follow the field from a seed point until it lands on a charge, leaves the frame,
// or stalls at a saddle. Returns the polyline of points.
function tracePoints(start: Point, charges: Charge[], sign: number): Point[] {
  const pts: Point[] = [start];
  let p = start;
  for (let i = 0; i < TRACE_MAX_STEPS; i += 1) {
    const next = rk4Step(p, charges, sign);
    if (!next) break;

    if (
      next.x < -TRACE_MARGIN.x ||
      next.x > VIEW.w + TRACE_MARGIN.x ||
      next.y < -TRACE_MARGIN.y ||
      next.y > VIEW.h + TRACE_MARGIN.y
    ) {
      pts.push(next);
      break;
    }

    let captured = false;
    for (const c of charges) {
      const dx = next.x - c.x;
      const dy = next.y - c.y;
      const d = Math.hypot(dx, dy);
      if (d < CAPTURE_RADIUS) {
        const u = d || 1e-6;
        pts.push({ x: c.x + (dx / u) * CHARGE_R, y: c.y + (dy / u) * CHARGE_R });
        captured = true;
        break;
      }
    }
    if (captured) break;

    pts.push(next);
    p = next;
  }
  return pts;
}

function lineToPath(pts: Point[]): string {
  let d = `M${round1(pts[0].x)},${round1(pts[0].y)}`;
  for (let i = 1; i < pts.length; i += 1) d += ` L${round1(pts[i].x)},${round1(pts[i].y)}`;
  return d;
}

// A small filled triangle at pts[i] pointing along the field. `sign` is the seed
// direction: negative charges are traced backward, so flip the traversal to recover
// the true field direction (always from + toward -).
function arrowHeadAt(pts: Point[], i: number, sign: number): string {
  const cur = pts[i];
  const prev = pts[i - 1];
  const dx = (cur.x - prev.x) * sign;
  const dy = (cur.y - prev.y) * sign;
  const m = Math.hypot(dx, dy) || 1e-6;
  const ux = dx / m;
  const uy = dy / m;
  const nx = -uy;
  const ny = ux;
  const backX = cur.x - ux * HEAD_LEN;
  const backY = cur.y - uy * HEAD_LEN;
  return (
    `M${round1(cur.x)},${round1(cur.y)}` +
    ` L${round1(backX + nx * HEAD_W)},${round1(backY + ny * HEAD_W)}` +
    ` L${round1(backX - nx * HEAD_W)},${round1(backY - ny * HEAD_W)}Z`
  );
}

// Trace field lines as ONE family, seeded only from the positive charge(s): LINES_PER_CHARGE
// lines evenly around each source, each followed forward until it lands on a negative charge
// or runs off the (enormous) trace margin. There are no separate probe lines, so there is no
// second family that could sit on top of the first: distinct streamlines of a single source
// never touch, which makes doubled lines impossible. The negative charge still fills in all
// the way around, including behind it, because for equal and opposite charges almost every
// source line eventually curves around to the sink; the huge TRACE_MARGIN lets the outer lines
// arc through off-screen space and re-enter the sink from its far side.
// Returns one path for the lines and one for the arrowheads (two <path> elements total).
function buildFieldLines(charges: Charge[]): { lines: string; heads: string } {
  const lineSegs: string[] = [];
  const headSegs: string[] = [];

  const emit = (pts: Point[]) => {
    if (pts.length < 2) return;
    lineSegs.push(lineToPath(pts));
    for (let i = HEAD_SPACING; i < pts.length - 2; i += HEAD_SPACING) {
      headSegs.push(arrowHeadAt(pts, i, 1));
    }
  };

  for (const source of charges) {
    if (source.q <= 0) continue;
    for (let k = 0; k < LINES_PER_CHARGE; k += 1) {
      const angle = ((k + 0.5) / LINES_PER_CHARGE) * Math.PI * 2;
      const start = {
        x: source.x + Math.cos(angle) * SEED_RADIUS,
        y: source.y + Math.sin(angle) * SEED_RADIUS,
      };
      emit(tracePoints(start, charges, 1));
    }
  }

  return { lines: lineSegs.join(' '), heads: headSegs.join(' ') };
}

function clampToFrame(p: Point): Point {
  return {
    x: Math.min(Math.max(p.x, DRAG_BOUND.x0), DRAG_BOUND.x1),
    y: Math.min(Math.max(p.y, DRAG_BOUND.y0), DRAG_BOUND.y1),
  };
}

// Clamp to the frame, then keep a minimum gap from every other charge.
function placeCharge(target: Point, others: Charge[]): Point {
  let p = clampToFrame(target);
  for (let pass = 0; pass < 4; pass += 1) {
    let adjusted = false;
    for (const o of others) {
      const dx = p.x - o.x;
      const dy = p.y - o.y;
      const d = Math.hypot(dx, dy);
      if (d < MIN_SEPARATION) {
        const u = d || 1e-6;
        p = clampToFrame({ x: o.x + (dx / u) * MIN_SEPARATION, y: o.y + (dy / u) * MIN_SEPARATION });
        adjusted = true;
      }
    }
    if (!adjusted) break;
  }
  return p;
}

function FieldSketch() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const [charges, setCharges] = useState<Charge[]>(INITIAL_CHARGES);
  const [hasMoved, setHasMoved] = useState(false);

  const toLocal = useCallback((clientX: number, clientY: number): Point | null => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!ctm) return null;
    const local = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return { x: local.x, y: local.y };
  }, []);

  const moveCharge = useCallback((id: string, target: Point) => {
    setCharges((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...placeCharge(target, prev.filter((o) => o.id !== id)) } : c)),
    );
  }, []);

  const handlePointerDown = (id: string) => (event: ReactPointerEvent<SVGGElement>) => {
    const local = toLocal(event.clientX, event.clientY);
    const charge = charges.find((c) => c.id === id);
    if (!local || !charge) return;
    dragRef.current = { id, dx: local.x - charge.x, dy: local.y - charge.y };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
    setHasMoved(true);
  };

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const local = toLocal(event.clientX, event.clientY);
    if (!local) return;
    moveCharge(drag.id, { x: local.x - drag.dx, y: local.y - drag.dy });
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  const handleKeyDown = (id: string) => (event: ReactKeyboardEvent<SVGGElement>) => {
    let dx = 0;
    let dy = 0;
    if (event.key === 'ArrowLeft') dx = -KEY_STEP;
    else if (event.key === 'ArrowRight') dx = KEY_STEP;
    else if (event.key === 'ArrowUp') dy = -KEY_STEP;
    else if (event.key === 'ArrowDown') dy = KEY_STEP;
    else return;
    event.preventDefault();
    const charge = charges.find((c) => c.id === id);
    if (!charge) return;
    setHasMoved(true);
    moveCharge(id, { x: charge.x + dx, y: charge.y + dy });
  };

  const field = useMemo(() => buildFieldLines(charges), [charges]);
  const negative = charges.find((c) => c.q < 0);

  const renderCharge = (charge: Charge) => {
    const isPos = charge.q > 0;
    // The positive charge is anchored; only the negative charge can be moved.
    const movable = !isPos;

    const body = (
      <>
        <circle
          cx={charge.x}
          cy={charge.y}
          r={CHARGE_R}
          style={{
            fill: isPos
              ? 'color-mix(in oklab, var(--sketch-accent) 34%, var(--hd-raised))'
              : 'color-mix(in oklab, var(--sketch-secondary) 30%, var(--hd-raised))',
            stroke: 'var(--sketch-ink)',
            strokeWidth: 2.5,
          }}
        />
        <text
          x={charge.x}
          y={charge.y}
          textAnchor="middle"
          dominantBaseline="central"
          style={{
            fontFamily: 'var(--font-hand-title)',
            fontSize: '16px',
            fill: 'var(--sketch-ink)',
            pointerEvents: 'none',
          }}
        >
          {isPos ? '+' : '−'}
        </text>
      </>
    );

    if (!movable) {
      return (
        <g key={charge.id} role="img" aria-label="Fixed positive charge">
          {body}
        </g>
      );
    }

    return (
      <g
        key={charge.id}
        className="field-charge drag-charge-handle drag-charge-handle--negative"
        role="button"
        tabIndex={0}
        aria-label="Negative charge. Drag, or use the arrow keys, to move it."
        onPointerDown={handlePointerDown(charge.id)}
        onKeyDown={handleKeyDown(charge.id)}
      >
        <circle cx={charge.x} cy={charge.y} r={26} fill="transparent" />
        <circle className="pot-hit-target pot-hit-target--drag" cx={charge.x} cy={charge.y} r={24} />
        {body}
      </g>
    );
  };

  return (
    <svg
      ref={svgRef}
      className="field-sketch"
      viewBox="0 0 440 340"
      role="group"
      aria-label="Interactive electric field lines of a fixed positive charge and a movable negative charge. Drag the negative charge to redraw the field lines in real time."
      style={{ touchAction: 'none' }}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <defs>
        <pattern id="landing-graph" width="28" height="28" patternUnits="userSpaceOnUse">
          <path d="M28 0H0V28" fill="none" stroke="var(--sketch-secondary)" strokeOpacity="0.13" strokeWidth="1" />
        </pattern>
      </defs>
      <rect x="0" y="0" width="440" height="340" fill="url(#landing-graph)" />

      <path
        d={field.lines}
        fill="none"
        stroke="var(--sketch-ink)"
        strokeWidth="1.8"
        strokeOpacity="0.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d={field.heads} fill="var(--sketch-ink)" fillOpacity="0.6" stroke="none" />

      {charges.map((charge) => renderCharge(charge))}

      {!hasMoved && negative ? (
        <g
          className="field-drag-hint"
          transform={`translate(${negative.x} ${negative.y})`}
          aria-hidden="true"
          pointerEvents="none"
        >
          <g className="field-drag-hint-bob">
            <path className="field-drag-hint-arrow" d="M0,-41 L0,-28 M-4,-33 L0,-28 L4,-33" />
            <g transform="translate(0 -57)">
              <rect className="field-drag-hint-pill" x="-46" y="-16" width="92" height="31" rx="15.5" />
              <text className="field-drag-hint-text" x="0" y="5" textAnchor="middle">
                drag me
              </text>
            </g>
          </g>
        </g>
      ) : null}
    </svg>
  );
}

export function LandingPage() {
  const { currentUser } = useAuth();

  if (currentUser) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="landing-page theme-handdrawn">
      <header className="topbar">
        <Link className="brand" to="/">
          <GraduationCap className="brand-icon" size={28} strokeWidth={2.2} aria-hidden="true" />
          <span className="brand-word">APT</span>
        </Link>
        <Link className="landing-bar-link" to="/login">
          Sign in
        </Link>
      </header>

      <main className="landing">
        <section className="landing-hero">
          <div className="landing-hero-copy">
            <h1>Interactive lessons for AP classes</h1>
            <p className="landing-lede">
              Each lesson is a hands-on, interactive experience with AI-powered feedback and mastery assessment.
            </p>
            <div className="landing-actions">
              <Link className="secondary-button" to="/login">
                Sign in
              </Link>
            </div>
          </div>

          <figure className="landing-figure">
            <FieldSketch />
          </figure>
        </section>

        <section className="landing-intro" aria-labelledby="intro-title">
          <h2 id="intro-title">Learn by doing</h2>
          <p>
            Reading the textbook and grinding practice tests only gets you so far. Every concept here is a
            lesson you work through yourself: you change something and watch what happens, then figure out
            why. After that, you flip the script and teach it back to an AI student that starts out confidently
            wrong. You learn it far better this way, because you don't fully understand a concept until you can
            catch every mistake it makes.
          </p>
        </section>

        <section className="landing-course" aria-labelledby="courses-title">
          <h2 id="courses-title">Courses we teach</h2>
          <div className="course-catalog">
            {COURSE_GROUPS.map((group) => (
              <section className="course-group" key={group.subject}>
                <h3>{group.subject}</h3>
                <ul>
                  {group.courses.map((course) => (
                    <li key={course}>{course}</li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </section>

        <section className="landing-end">
          <p>Create an account to get started</p>
          <Link className="secondary-button" to="/signup">
            Create account
          </Link>
        </section>
      </main>
    </div>
  );
}
