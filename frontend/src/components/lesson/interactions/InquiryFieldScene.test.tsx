import { fireEvent, render, screen } from '@testing-library/react';
import { InquiryFieldScene } from './InquiryFieldScene';
import type { InquiryFieldScreen } from '../../../content/schema';

vi.mock('../../../lib/confetti', () => ({ celebrateSmall: vi.fn() }));

const pointChargeScreen: InquiryFieldScreen = {
  kind: 'field',
  id: 'point-field',
  prompt: 'Predict the field at the open point.',
  sources: [{ id: 's', x: 3, y: 3, q: 1 }],
  probe: { x: 7, y: 3 },
  show: 'net',
  revealCaption: 'The field points away from the positive charge.',
  explore: 'move-probe',
};

const nullScreen: InquiryFieldScreen = {
  kind: 'field',
  id: 'null-point',
  prompt: 'Predict the field at the midpoint.',
  sources: [
    { id: 'a', x: 2.5, y: 3, q: 1 },
    { id: 'b', x: 7.5, y: 3, q: 1 },
  ],
  probe: { x: 5, y: 3 },
  show: 'contributions',
  revealCaption: 'The two fields cancel: a null point.',
};

describe('InquiryFieldScene', () => {
  it('hides the field and caption until reveal, then shows the net field', () => {
    render(<InquiryFieldScene screen={pointChargeScreen} onComplete={() => {}} />);
    expect(screen.queryByTestId('field-net')).not.toBeInTheDocument();
    expect(screen.queryByText('The field points away from the positive charge.')).not.toBeInTheDocument();
    expect(screen.getByTestId('field-ghost')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /reveal/i }));
    expect(screen.getByTestId('field-net')).toBeInTheDocument();
    expect(screen.getByText('The field points away from the positive charge.')).toBeInTheDocument();
  });

  it('lets the learner move the probe after reveal, which clears the guess', () => {
    render(<InquiryFieldScene screen={pointChargeScreen} onComplete={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /reveal/i }));
    expect(screen.getByTestId('field-ghost')).toBeInTheDocument();
    fireEvent.keyDown(screen.getByTestId('field-probe-handle'), { key: 'ArrowRight' });
    expect(screen.queryByTestId('field-ghost')).not.toBeInTheDocument();
  });

  it('shows the canceling contributions at a null point, then completes', () => {
    const onComplete = vi.fn();
    render(<InquiryFieldScene screen={nullScreen} onComplete={onComplete} />);
    fireEvent.click(screen.getByRole('button', { name: /reveal/i }));
    expect(screen.getByTestId('field-contributions')).toBeInTheDocument();
    expect(screen.getByText('The two fields cancel: a null point.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
