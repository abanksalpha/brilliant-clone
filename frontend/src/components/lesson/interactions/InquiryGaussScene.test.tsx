import { fireEvent, render, screen } from '@testing-library/react';
import { InquiryGaussScene } from './InquiryGaussScene';
import type { InquiryGaussScreen } from '../../../content/schema';

vi.mock('../../../lib/confetti', () => ({ celebrateSmall: vi.fn() }));

const enclosedScreen: InquiryGaussScreen = {
  kind: 'gauss',
  id: 'charge-inside',
  prompt: 'Predict the net flux through this loop around the charge.',
  enclosed: true,
  revealCaption: 'All of the charge is enclosed, so the net flux is Q / epsilon_0.',
};

const outsideScreen: InquiryGaussScreen = {
  kind: 'gauss',
  id: 'charge-outside',
  prompt: 'Predict the net flux through this loop beside the charge.',
  enclosed: false,
  revealCaption: 'The charge is outside, so every line that enters also leaves: the net flux is zero.',
};

describe('InquiryGaussScene', () => {
  it('offers a gauge and hides the caption until reveal', () => {
    render(<InquiryGaussScene screen={enclosedScreen} onComplete={() => {}} />);
    expect(screen.getByTestId('gauss-gauge-handle')).toBeInTheDocument();
    // The reveal caption is typeset (MathText splits the math into sub nodes), so
    // match on its plain leading clause via a regex rather than the full string.
    expect(screen.queryByText(/All of the charge is enclosed/)).not.toBeInTheDocument();
  });

  it('fills the gauge for an enclosed charge on reveal, then completes', () => {
    const onComplete = vi.fn();
    render(<InquiryGaussScene screen={enclosedScreen} onComplete={onComplete} />);
    fireEvent.click(screen.getByRole('button', { name: /reveal/i }));
    expect(screen.getByTestId('gauss-out')).toBeInTheDocument();
    expect(screen.getByTestId('gauss-gauge-fill')).toBeInTheDocument();
    expect(screen.getByText(/All of the charge is enclosed/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('shows zero net flux and in/out arcs for a charge outside the loop', () => {
    render(<InquiryGaussScene screen={outsideScreen} onComplete={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /reveal/i }));
    expect(screen.getByTestId('gauss-inout')).toBeInTheDocument();
    expect(screen.queryByTestId('gauss-gauge-fill')).not.toBeInTheDocument();
    expect(screen.getByText(/every line that enters also leaves/)).toBeInTheDocument();
  });
});
