import { fireEvent, render, screen } from '@testing-library/react';
import { InquiryScene, closeEnough } from './InquiryScene';
import { celebrateSmall } from '../../../lib/confetti';
import type { InquiryPredictScreen } from '../../../content/schema';

vi.mock('../../../lib/confetti', () => ({ celebrateSmall: vi.fn() }));

const chargeScreen: InquiryPredictScreen = {
  id: 'charge', variable: 'charge', mode: 'cycle', prompt: 'Predict the force when the right charge triples.',
  left: { id: 'left', x: 3, y: 3, q: 1 }, right: { id: 'right', x: 7, y: 3, q: 1 },
  target: { apply: 'set-charge', chargeId: 'right', toQ: 3 },
  revealCaption: 'Triple the charge, triple the force.',
};

const distanceScreen: InquiryPredictScreen = {
  id: 'distance', variable: 'distance', mode: 'move', prompt: 'Predict the force at double the distance.',
  left: { id: 'left', x: 2, y: 3, q: 2 }, right: { id: 'right', x: 4, y: 3, q: 2 },
  target: { apply: 'set-distance', toDistanceFactor: 2 },
  revealCaption: 'Double the distance, quarter the force.',
};

describe('InquiryScene', () => {
  it('hides the caption until reveal, then shows it and a Continue', () => {
    const onComplete = vi.fn();
    render(<InquiryScene screen={chargeScreen} onComplete={onComplete} />);
    expect(screen.queryByText('Triple the charge, triple the force.')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /reveal/i }));
    expect(screen.getByText('Triple the charge, triple the force.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('only allows cycling after reveal in a cycle screen', () => {
    render(<InquiryScene screen={chargeScreen} onComplete={() => {}} />);
    expect(screen.queryByTestId('cycle-left')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /reveal/i }));
    expect(screen.getByTestId('cycle-left')).toBeInTheDocument();
  });

  it('keeps the changed charge hidden until reveal', () => {
    render(<InquiryScene screen={chargeScreen} onComplete={() => {}} />);
    // The tripled charge (+++) is the answer, so it must not appear before reveal.
    expect(screen.queryByText('+++')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /reveal/i }));
    expect(screen.getByText('+++')).toBeInTheDocument();
  });

  it('shows a move handle (never cycle) only after reveal in a move screen', () => {
    render(<InquiryScene screen={distanceScreen} onComplete={() => {}} />);
    expect(screen.queryByTestId('move-right')).not.toBeInTheDocument();
    expect(screen.queryByTestId('cycle-left')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /reveal/i }));
    expect(screen.getByTestId('move-right')).toBeInTheDocument();
    expect(screen.queryByTestId('cycle-left')).not.toBeInTheDocument();
    expect(screen.getByText('Double the distance, quarter the force.')).toBeInTheDocument();
  });

  it('keeps the prediction through reveal, then clears it on the first cycle', () => {
    render(<InquiryScene screen={chargeScreen} onComplete={() => {}} />);
    expect(screen.getByTestId('ghost-arrow')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /reveal/i }));
    // Survives the reveal so the guess can be compared to the revealed force.
    expect(screen.getByTestId('ghost-arrow')).toBeInTheDocument();
    // The first explore edit (cycling a charge) clears it.
    fireEvent.click(screen.getByTestId('cycle-left'));
    expect(screen.queryByTestId('ghost-arrow')).not.toBeInTheDocument();
  });

  it('keeps the prediction after a move screen reveal until the charge is moved', () => {
    render(<InquiryScene screen={distanceScreen} onComplete={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /reveal/i }));
    // The reveal moves the right charge, but the guess stays put.
    expect(screen.getByTestId('ghost-arrow')).toBeInTheDocument();
    // Moving a charge (here via the keyboard handle) clears it.
    fireEvent.keyDown(screen.getByTestId('move-right'), { key: 'ArrowRight' });
    expect(screen.queryByTestId('ghost-arrow')).not.toBeInTheDocument();
  });

  it('does not celebrate when the default (deliberately off) guess is revealed', () => {
    vi.mocked(celebrateSmall).mockClear();
    render(<InquiryScene screen={chargeScreen} onComplete={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /reveal/i }));
    expect(celebrateSmall).not.toHaveBeenCalled();
  });
});

describe('closeEnough', () => {
  it('accepts a guess tip within tolerance of the force tip', () => {
    // tolerance for a 126px arrow is max(34, 40.3) = 40.3.
    expect(closeEnough({ x: 100, y: 100 }, { x: 130, y: 100 }, 126)).toBe(true);
  });

  it('rejects a guess tip well past the tolerance', () => {
    expect(closeEnough({ x: 100, y: 100 }, { x: 220, y: 100 }, 126)).toBe(false);
  });

  it('keeps a usable floor so a short arrow is not impossibly strict', () => {
    // A 30px arrow's tolerance floors at 34, so a 30px miss still counts as close.
    expect(closeEnough({ x: 0, y: 0 }, { x: 30, y: 0 }, 30)).toBe(true);
  });
});
