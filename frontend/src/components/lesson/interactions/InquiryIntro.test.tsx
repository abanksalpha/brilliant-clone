import { fireEvent, render, screen } from '@testing-library/react';
import { InquiryIntro } from './InquiryIntro';
import type { InquiryIntroScreen } from '../../../content/schema';

const introScreen: InquiryIntroScreen = {
  kind: 'intro',
  id: 'intro',
  heading: 'What is charge?',
  body: 'Electric charge is a basic property of matter.',
  left: { id: 'left', x: 3, y: 3, q: 1 },
  right: { id: 'right', x: 7, y: 3, q: -1 },
};

describe('InquiryIntro', () => {
  it('shows the heading and body and continues on click', () => {
    const onComplete = vi.fn();
    render(<InquiryIntro screen={introScreen} onComplete={onComplete} />);
    expect(screen.getByText('What is charge?')).toBeInTheDocument();
    expect(screen.getByText('Electric charge is a basic property of matter.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('shows an attracting and a repelling pair with force arrows, and no predict control', () => {
    const { container } = render(<InquiryIntro screen={introScreen} onComplete={() => {}} />);
    // Two demonstration rows: opposite charges (attract) and like charges (repel).
    expect(screen.getByTestId('intro-row-attract')).toBeInTheDocument();
    expect(screen.getByTestId('intro-row-repel')).toBeInTheDocument();
    // A hairline divider separates the two rows so they read as distinct scenes.
    expect(screen.getByTestId('intro-divider')).toBeInTheDocument();
    // A '+' on each row's left charge plus the repel row's right charge; one '-'.
    expect(screen.getAllByText('+')).toHaveLength(3);
    expect(screen.getByText('-')).toBeInTheDocument();
    // Four equal-and-opposite force arrows, two per row.
    expect(container.querySelectorAll('.inline-arrow-head')).toHaveLength(4);
    expect(screen.queryByRole('button', { name: /reveal/i })).not.toBeInTheDocument();
  });
});
