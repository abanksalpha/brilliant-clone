import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RichText } from './RichText';

describe('RichText feedback rendering', () => {
  it('renders prose that begins with "Right." as a single paragraph', () => {
    const text = 'Right. Opposite signs attract, and the pull gets stronger as the gap shrinks.';
    const { container } = render(<RichText text={text} variant="feedback" />);

    // The whole sentence should stay together in one paragraph...
    const paragraph = screen.getByText(text);
    expect(paragraph.tagName).toBe('P');

    // ...and never be split into a bold "Right" label list.
    expect(container.querySelector('strong')).toBeNull();
    expect(container.querySelector('.rich-label-list')).toBeNull();
  });

  it('does not treat other position-word sentence starters as labels', () => {
    for (const text of [
      'Left of the midpoint the force flips direction.',
      'Center the test charge and the net force is zero.',
    ]) {
      const { container, unmount } = render(<RichText text={text} />);
      expect(screen.getByText(text).tagName).toBe('P');
      expect(container.querySelector('strong')).toBeNull();
      unmount();
    }
  });

  it('still renders a genuine "Label: text" block as a labeled list', () => {
    const { container } = render(
      <RichText text={'Left: the positive charge\nRight: the negative charge'} />,
    );

    const list = container.querySelector('.rich-label-list');
    expect(list).not.toBeNull();

    const labels = Array.from(container.querySelectorAll('strong')).map((node) => node.textContent);
    expect(labels).toEqual(['Left', 'Right']);
    expect(screen.getByText('the positive charge')).toBeInTheDocument();
    expect(screen.getByText('the negative charge')).toBeInTheDocument();
  });
});
