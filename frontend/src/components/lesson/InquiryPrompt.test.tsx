import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { InquiryPrompt } from './InquiryPrompt';
import type { InquiryPrompt as InquiryPromptModel } from '../../content';

function textInquiry(): InquiryPromptModel {
  return {
    question: 'What happens to the force when you double the distance?',
    capture: 'text',
    resolvedBy: 'inverse-square',
  };
}

function choiceInquiry(): InquiryPromptModel {
  return {
    question: 'Which charge feels the stronger pull?',
    capture: 'choice',
    choices: [
      { id: 'closer', text: 'The closer charge' },
      { id: 'farther', text: 'The farther charge' },
    ],
    resolvedBy: 'inverse-square',
  };
}

function sandboxInquiry(): InquiryPromptModel {
  return {
    question: 'Where could the test charge sit so it feels no push at all?',
    capture: 'sandbox',
    resolvedBy: 'superposition',
  };
}

describe('InquiryPrompt', () => {
  describe('text capture', () => {
    it('renders the question prominently with a short guess field', () => {
      render(<InquiryPrompt inquiry={textInquiry()} onComplete={vi.fn()} />);

      expect(
        screen.getByRole('heading', { name: /double the distance/i }),
      ).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /your guess/i })).toBeInTheDocument();
    });

    it('enables Continue once a guess is written, then calls onComplete', () => {
      const onComplete = vi.fn();
      render(<InquiryPrompt inquiry={textInquiry()} onComplete={onComplete} />);

      const continueButton = screen.getByRole('button', { name: 'Continue' });
      expect(continueButton).toBeDisabled();

      fireEvent.change(screen.getByRole('textbox', { name: /your guess/i }), {
        target: { value: 'The force gets weaker' },
      });

      expect(continueButton).toBeEnabled();
      fireEvent.click(continueButton);
      expect(onComplete).toHaveBeenCalledTimes(1);
    });

    it('treats whitespace as no guess', () => {
      render(<InquiryPrompt inquiry={textInquiry()} onComplete={vi.fn()} />);

      fireEvent.change(screen.getByRole('textbox', { name: /your guess/i }), {
        target: { value: '   ' },
      });

      expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    });
  });

  describe('choice capture', () => {
    it('renders every choice as a selectable option', () => {
      render(<InquiryPrompt inquiry={choiceInquiry()} onComplete={vi.fn()} />);

      expect(screen.getByRole('radio', { name: 'The closer charge' })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'The farther charge' })).toBeInTheDocument();
    });

    it('enables Continue once a choice is selected, then calls onComplete', () => {
      const onComplete = vi.fn();
      render(<InquiryPrompt inquiry={choiceInquiry()} onComplete={onComplete} />);

      const continueButton = screen.getByRole('button', { name: 'Continue' });
      expect(continueButton).toBeDisabled();

      const option = screen.getByRole('radio', { name: 'The closer charge' });
      fireEvent.click(option);

      expect(option).toHaveAttribute('aria-checked', 'true');
      expect(continueButton).toBeEnabled();
      fireEvent.click(continueButton);
      expect(onComplete).toHaveBeenCalledTimes(1);
    });
  });

  describe('sandbox capture', () => {
    it('embeds the charge sandbox in an exploratory mode', () => {
      render(<InquiryPrompt inquiry={sandboxInquiry()} onComplete={vi.fn()} />);

      expect(
        screen.getByRole('heading', { name: /no push at all/i }),
      ).toBeInTheDocument();
      expect(screen.getByTestId('charge-sandbox')).toBeInTheDocument();
      // Exploratory mode shows a live readout and never a graded check button.
      expect(screen.getByText(/net force on test charge/i)).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /check this spot/i }),
      ).not.toBeInTheDocument();
    });

    it('always enables Continue and calls onComplete without input', () => {
      const onComplete = vi.fn();
      render(<InquiryPrompt inquiry={sandboxInquiry()} onComplete={onComplete} />);

      const continueButton = screen.getByRole('button', { name: 'Continue' });
      expect(continueButton).toBeEnabled();
      fireEvent.click(continueButton);
      expect(onComplete).toHaveBeenCalledTimes(1);
    });
  });

  it('frames a guess with no correct, incorrect, or wrong labeling in any mode', () => {
    for (const inquiry of [textInquiry(), choiceInquiry(), sandboxInquiry()]) {
      const { container, unmount } = render(
        <InquiryPrompt inquiry={inquiry} onComplete={vi.fn()} />,
      );

      expect(container).not.toHaveTextContent(/correct/i);
      expect(container).not.toHaveTextContent(/incorrect/i);
      expect(container).not.toHaveTextContent(/wrong/i);

      unmount();
    }
  });
});

const twoScreen: InquiryPromptModel = {
  question: 'unused when screens present', capture: 'text', resolvedBy: 'inverse square law',
  screens: [
    { id: 'charge', variable: 'charge', mode: 'cycle', prompt: 'Charge prompt.',
      left: { id: 'left', x: 3, y: 3, q: 1 }, right: { id: 'right', x: 7, y: 3, q: 1 },
      target: { apply: 'set-charge', chargeId: 'right', toQ: 3 }, revealCaption: 'Charge caption.' },
    { id: 'distance', variable: 'distance', mode: 'move', prompt: 'Distance prompt.',
      left: { id: 'left', x: 2, y: 3, q: 2 }, right: { id: 'right', x: 5, y: 3, q: 2 },
      target: { apply: 'set-distance', toDistanceFactor: 2 }, revealCaption: 'Distance caption.' },
  ],
};

describe('InquiryPrompt screens flow', () => {
  it('walks both screens then completes', () => {
    const onComplete = vi.fn();
    render(<InquiryPrompt inquiry={twoScreen} onComplete={onComplete} />);
    expect(screen.getByTestId('inquiry-scene-charge')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /reveal/i }));
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(screen.getByTestId('inquiry-scene-distance')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /reveal/i }));
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
