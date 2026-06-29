import { fireEvent, render, screen } from '@testing-library/react';
import { InquiryPolarizeScene } from './InquiryPolarizeScene';
import type { InquiryPolarizeScreen } from '../../../content/schema';

vi.mock('../../../lib/confetti', () => ({ celebrateSmall: vi.fn() }));

const polarizeScreen: InquiryPolarizeScreen = {
  kind: 'polarize',
  id: 'polarize',
  prompt: 'Predict the net force the neutral sphere feels.',
  rodCharge: 3,
  revealCaption: 'A neutral sphere is drawn in.',
  note: 'It is still neutral overall.',
};

describe('InquiryPolarizeScene', () => {
  it('hides the induced charge, the net force, and the caption until reveal', () => {
    render(<InquiryPolarizeScene screen={polarizeScreen} onComplete={() => {}} />);
    expect(screen.queryByTestId('polarize-induced')).not.toBeInTheDocument();
    expect(screen.queryByTestId('polarize-net-force')).not.toBeInTheDocument();
    expect(screen.queryByText('A neutral sphere is drawn in.')).not.toBeInTheDocument();
    // The dashed guess is present from the start for the learner to aim.
    expect(screen.getByTestId('polarize-ghost')).toBeInTheDocument();
  });

  it('reveals the induced separation, net force, and caption, then completes', () => {
    const onComplete = vi.fn();
    render(<InquiryPolarizeScene screen={polarizeScreen} onComplete={onComplete} />);
    fireEvent.click(screen.getByRole('button', { name: /reveal/i }));
    expect(screen.getByTestId('polarize-induced')).toBeInTheDocument();
    expect(screen.getByTestId('polarize-net-force')).toBeInTheDocument();
    expect(screen.getByText('A neutral sphere is drawn in.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('keeps the guess through reveal, then clears it on the first rod move', () => {
    render(<InquiryPolarizeScene screen={polarizeScreen} onComplete={() => {}} />);
    expect(screen.getByTestId('polarize-ghost')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /reveal/i }));
    expect(screen.getByTestId('polarize-ghost')).toBeInTheDocument();
    fireEvent.keyDown(screen.getByTestId('polarize-rod'), { key: 'ArrowLeft' });
    expect(screen.queryByTestId('polarize-ghost')).not.toBeInTheDocument();
  });
});
