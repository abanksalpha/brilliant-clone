import { fireEvent, render, screen } from '@testing-library/react';
import { InquiryShareScene } from './InquiryShareScene';
import type { InquiryShareScreen } from '../../../content/schema';

vi.mock('../../../lib/confetti', () => ({ celebrateSmall: vi.fn() }));

const shareScreen: InquiryShareScreen = {
  kind: 'share',
  id: 'share',
  prompt: 'Tap the right sphere to predict its charge after they touch.',
  leftStart: 2,
  revealCaption: 'Identical spheres share the total evenly.',
  note: 'Charge is conserved.',
};

describe('InquiryShareScene', () => {
  it('offers a tappable guess and hides the caption until reveal', () => {
    render(<InquiryShareScene screen={shareScreen} onComplete={() => {}} />);
    expect(screen.getByTestId('share-guess')).toBeInTheDocument();
    expect(screen.queryByText('Identical spheres share the total evenly.')).not.toBeInTheDocument();
  });

  it('cycles the guess on tap', () => {
    render(<InquiryShareScene screen={shareScreen} onComplete={() => {}} />);
    // Starts neutral (0), so the only glyph is the charged left sphere (++).
    expect(screen.getByText('++')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('share-guess'));
    // After one tap the guess is +1, so a single + glyph appears.
    expect(screen.getByText('+')).toBeInTheDocument();
  });

  it('reveals the even split and the caption, then completes', () => {
    const onComplete = vi.fn();
    render(<InquiryShareScene screen={shareScreen} onComplete={onComplete} />);
    fireEvent.click(screen.getByRole('button', { name: /reveal/i }));
    expect(screen.getByText('Identical spheres share the total evenly.')).toBeInTheDocument();
    expect(screen.queryByTestId('share-guess')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
