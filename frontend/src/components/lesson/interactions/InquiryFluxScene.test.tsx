import { fireEvent, render, screen } from '@testing-library/react';
import { InquiryFluxScene } from './InquiryFluxScene';
import type { InquiryFluxScreen } from '../../../content/schema';

vi.mock('../../../lib/confetti', () => ({ celebrateSmall: vi.fn() }));

const plateScreen: InquiryFluxScreen = {
  kind: 'flux',
  id: 'plate-tilt',
  prompt: 'Predict the flux through this tilted surface.',
  surface: 'plate',
  tiltDeg: 60,
  revealCaption: 'Tilt to 60 degrees and the flux halves.',
  note: 'Only the perpendicular part counts.',
};

const boxScreen: InquiryFluxScreen = {
  kind: 'flux',
  id: 'box-closed',
  prompt: 'Predict the net flux through this closed box.',
  surface: 'box',
  revealCaption: 'Every line that enters also leaves, so the net flux is zero.',
  note: 'Add a charge inside and the net flux becomes Q_enc / epsilon_0.',
};

describe('InquiryFluxScene', () => {
  it('offers a gauge and hides the highlights and caption until reveal', () => {
    render(<InquiryFluxScene screen={plateScreen} onComplete={() => {}} />);
    expect(screen.getByTestId('flux-gauge-handle')).toBeInTheDocument();
    expect(screen.queryByTestId('flux-line-active')).not.toBeInTheDocument();
    expect(screen.queryByText('Tilt to 60 degrees and the flux halves.')).not.toBeInTheDocument();
  });

  it('reveals the crossing lines and the caption, then completes', () => {
    const onComplete = vi.fn();
    render(<InquiryFluxScene screen={plateScreen} onComplete={onComplete} />);
    fireEvent.click(screen.getByRole('button', { name: /reveal/i }));
    expect(screen.getAllByTestId('flux-line-active').length).toBeGreaterThan(0);
    expect(screen.getByText('Tilt to 60 degrees and the flux halves.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('marks the in and out faces of a closed box on reveal', () => {
    render(<InquiryFluxScene screen={boxScreen} onComplete={() => {}} />);
    expect(screen.getByTestId('flux-box')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /reveal/i }));
    expect(screen.getByText('Every line that enters also leaves, so the net flux is zero.')).toBeInTheDocument();
  });

  it('typesets canonical math in the reveal note instead of showing raw ASCII', () => {
    const { container } = render(<InquiryFluxScene screen={boxScreen} onComplete={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /reveal/i }));
    const note = container.querySelector('.inquiry-note');
    expect(note).not.toBeNull();
    // Authored "Q_enc / epsilon_0" must render as real subscripts, not raw source.
    expect(note?.textContent).not.toMatch(/naught/i);
    expect(note?.textContent).not.toContain('epsilon_0');
    expect(note?.textContent).not.toContain('Q_enc');
    expect((note?.querySelectorAll('sub').length ?? 0)).toBeGreaterThan(0);
  });
});
