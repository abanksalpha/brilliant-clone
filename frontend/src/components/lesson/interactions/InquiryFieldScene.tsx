import { useMemo, useState } from 'react';
import type { InquiryFieldScreen } from '../../../content/schema';
import { celebrateSmall } from '../../../lib/confetti';
import { forceOnCharge, magnitude, netForceFromCharges } from '../physics';
import { clamp, scaleByReference } from '../scenes/primitives';
import { FieldProbe, type FieldSource } from './FieldProbe';
import { closeEnough } from './InquiryScene';
import { ARROW_GAP, FIELD, FIELD_CHARGE_R, type Point } from './TwoChargeField';

// Source and probe positions are authored in this grid, then scaled to the scene.
const GRID = { w: 10, h: 6 };
const REF_PX = 120;
const MARGIN = 34;
const PROBE_R = 7;
// Keep the probe a sensible distance off any source so the field stays finite.
const MIN_PROBE_GAP = FIELD_CHARGE_R + 26;
const START_TILT = Math.PI / 4;

function toScene(p: { x: number; y: number }): Point {
  return { x: (p.x / GRID.w) * FIELD.w, y: (p.y / GRID.h) * FIELD.h };
}

type Stage = 'predict' | 'revealed';

// Phase 2 (Inquiry) for Electric Field: source charges and a probe point. The
// learner predicts the field at the probe (drag the dashed arrow), then the reveal
// shows it: the field of a lone charge (pointing away, weakening with distance), or
// two equal-and-opposite fields canceling at a null point. Ungraded, like every
// inquiry.
export function InquiryFieldScene({ screen, onComplete }: { screen: InquiryFieldScreen; onComplete: () => void }) {
  const sources: FieldSource[] = useMemo(
    () => screen.sources.map((s) => ({ id: s.id, q: s.q, ...toScene(s) })),
    [screen.sources],
  );
  const probe0 = useMemo(() => toScene(screen.probe), [screen.probe]);
  const [probe, setProbe] = useState<Point>(probe0);
  const [stage, setStage] = useState<Stage>('predict');
  // The dashed guess stays through the reveal so it can be compared to the truth;
  // it clears once the learner starts exploring (moving the probe).
  const [explored, setExplored] = useState(false);

  // One fixed reference at the starting probe. For a net-field screen it is the net
  // magnitude, so the net arrow opens at REF_PX (a sum of many pieces would otherwise
  // run off the figure). For a contributions screen (a null point) it is the
  // strongest single contribution, so each contribution arrow opens at REF_PX.
  const refForce = useMemo(() => {
    const probePC = { x: probe0.x, y: probe0.y, q: 1 };
    if (screen.show === 'net') {
      const net = magnitude(netForceFromCharges(probePC, sources.map((s) => ({ x: s.x, y: s.y, q: s.q }))));
      if (net > 1e-12) return net;
    }
    const contribs = sources.map((s) => magnitude(forceOnCharge(probePC, { x: s.x, y: s.y, q: s.q })));
    return Math.max(...contribs, 1e-12) || 1;
  }, [sources, probe0, screen.show]);

  const predicting = stage === 'predict';

  const [prediction, setPrediction] = useState<Point>(() => {
    const reach = PROBE_R + ARROW_GAP + REF_PX;
    return {
      x: clamp(probe0.x + reach * Math.cos(START_TILT), MARGIN, FIELD.w - MARGIN),
      y: clamp(probe0.y + reach * Math.sin(START_TILT), MARGIN, FIELD.h - MARGIN),
    };
  });

  function reveal() {
    const net = netForceFromCharges({ x: probe.x, y: probe.y, q: 1 }, sources.map((s) => ({ x: s.x, y: s.y, q: s.q })));
    const mag = magnitude(net);
    const len = scaleByReference(mag, refForce, REF_PX);
    const u = mag > 1e-12 ? { x: net.x / mag, y: net.y / mag } : { x: 1, y: 0 };
    const tip = { x: probe.x + u.x * (PROBE_R + ARROW_GAP + len), y: probe.y + u.y * (PROBE_R + ARROW_GAP + len) };
    if (closeEnough(prediction, tip, len)) celebrateSmall();
    setStage('revealed');
  }

  function moveProbe(pt: Point) {
    setExplored(true);
    let p: Point = { x: clamp(pt.x, MARGIN, FIELD.w - MARGIN), y: clamp(pt.y, MARGIN, FIELD.h - MARGIN) };
    for (const s of sources) {
      const dx = p.x - s.x;
      const dy = p.y - s.y;
      const d = Math.hypot(dx, dy);
      if (d < MIN_PROBE_GAP) {
        const ux = d < 1e-9 ? 1 : dx / d;
        const uy = d < 1e-9 ? 0 : dy / d;
        p = { x: clamp(s.x + ux * MIN_PROBE_GAP, MARGIN, FIELD.w - MARGIN), y: clamp(s.y + uy * MIN_PROBE_GAP, MARGIN, FIELD.h - MARGIN) };
      }
    }
    setProbe(p);
  }

  const canExplore = !predicting && screen.explore === 'move-probe';

  return (
    <article className="lesson-experience cl1-experience inquiry-scene" data-testid={`inquiry-scene-${screen.id}`}>
      <section className="lesson-visual cl1-stage" aria-label={screen.prompt}>
        <FieldProbe
          sources={sources}
          probe={probe}
          showField={!predicting}
          showMode={screen.show}
          refForce={refForce}
          refPx={REF_PX}
          prediction={explored ? null : prediction}
          onPredictMove={predicting ? setPrediction : undefined}
          onProbeMove={canExplore ? moveProbe : undefined}
          probeMovable={canExplore}
        />
      </section>
      <div className="experience-panel cl1-rail inquiry-rail">
        <p className="eyebrow">Prediction</p>
        <p className="inquiry-prompt-text">{screen.prompt}</p>
        {predicting ? (
          <>
            <p className="inquiry-hint">
              Drag the dashed arrow to the field you expect at the open point. Committing to a guess first makes the answer stick, even when you miss.
            </p>
            <button type="button" className="secondary-button" onClick={reveal}>
              Reveal
            </button>
          </>
        ) : (
          <>
            <hr className="inquiry-divider" aria-hidden="true" />
            <p className="inquiry-reveal-caption">{screen.revealCaption}</p>
            {screen.note ? <p className="inquiry-note">{screen.note}</p> : null}
            {canExplore ? <p className="inquiry-hint">Drag the open point to read the field somewhere else.</p> : null}
            <button type="button" className="secondary-button" onClick={onComplete}>
              Continue
            </button>
          </>
        )}
      </div>
    </article>
  );
}
