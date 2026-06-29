import '@testing-library/jest-dom/vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PhaseBar, type PhaseDescriptor } from './PhaseBar';

const LABELS = ['Review', 'Inquiry', 'Learn', 'Apply', 'Solve'];

const PHASES: PhaseDescriptor[] = [
  { label: 'Review', steps: 2 },
  { label: 'Inquiry', steps: 1 },
  { label: 'Learn', steps: 3 },
  { label: 'Apply', steps: 4 },
  { label: 'Solve', steps: 5 },
];

function cellStates(index: number): string[] {
  const segment = screen.getByTestId(`phase-seg-${index}`);
  return Array.from(segment.querySelectorAll('.phase-bar__cell')).map(
    (cell) => cell.getAttribute('data-cell-state') ?? '',
  );
}

describe('PhaseBar', () => {
  it('renders exactly one labeled segment per phase, in order', () => {
    render(<PhaseBar phases={PHASES} current={0} withinStep={0} maxVisited={0} />);

    const segments = screen.getAllByTestId(/^phase-seg-\d$/);
    expect(segments).toHaveLength(LABELS.length);
    LABELS.forEach((label, index) => {
      expect(screen.getByTestId(`phase-seg-${index}`)).toHaveTextContent(label);
    });
  });

  it('exposes an accessible, labeled progress list', () => {
    render(<PhaseBar phases={PHASES} current={1} withinStep={0} maxVisited={1} />);

    const list = screen.getByRole('list', { name: /progress/i });
    expect(list).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(LABELS.length);
  });

  it('marks earlier phases complete, the current active, and later upcoming', () => {
    render(<PhaseBar phases={PHASES} current={2} withinStep={0} maxVisited={2} />);

    expect(screen.getByTestId('phase-seg-0')).toHaveAttribute('data-state', 'complete');
    expect(screen.getByTestId('phase-seg-1')).toHaveAttribute('data-state', 'complete');

    const active = screen.getByTestId('phase-seg-2');
    expect(active).toHaveAttribute('data-state', 'active');
    expect(active).toHaveAttribute('aria-current', 'step');

    expect(screen.getByTestId('phase-seg-3')).toHaveAttribute('data-state', 'upcoming');
    expect(screen.getByTestId('phase-seg-4')).toHaveAttribute('data-state', 'upcoming');
  });

  it('exposes exactly one current step for assistive tech', () => {
    render(<PhaseBar phases={PHASES} current={3} withinStep={0} maxVisited={3} />);

    const current = screen
      .getAllByRole('listitem')
      .filter((segment) => segment.getAttribute('aria-current') === 'step');
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent('Apply');
  });

  it('subdivides each segment into one cell per step, with a floor of one', () => {
    render(
      <PhaseBar
        phases={[
          { label: 'Review', steps: 0 },
          { label: 'Inquiry', steps: 1 },
          { label: 'Learn', steps: 3 },
          { label: 'Apply', steps: 4 },
          { label: 'Solve', steps: 5 },
        ]}
        current={0}
        withinStep={0}
        maxVisited={0}
      />,
    );

    expect(cellStates(0)).toHaveLength(1); // steps 0 floors to a single cell
    expect(cellStates(1)).toHaveLength(1);
    expect(cellStates(2)).toHaveLength(3);
    expect(cellStates(3)).toHaveLength(4);
    expect(cellStates(4)).toHaveLength(5);
  });

  // The worked example from the spec: the 2nd of 3 Learn slides. Review and
  // Inquiry are fully blue, Learn reads blue/red/gray across its thirds, and
  // Apply and Solve stay fully gray.
  it('colors the within-phase cells: done before, current at, upcoming after withinStep', () => {
    render(<PhaseBar phases={PHASES} current={2} withinStep={1} maxVisited={2} />);

    expect(cellStates(0)).toEqual(['done', 'done']);
    expect(cellStates(1)).toEqual(['done']);
    expect(cellStates(2)).toEqual(['done', 'current', 'upcoming']);
    expect(cellStates(3)).toEqual(['upcoming', 'upcoming', 'upcoming', 'upcoming']);
    expect(cellStates(4)).toEqual(['upcoming', 'upcoming', 'upcoming', 'upcoming', 'upcoming']);
  });

  it('lets the learner navigate to any visited phase but not later ones', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(
      <PhaseBar phases={PHASES} current={1} withinStep={0} maxVisited={2} onNavigate={onNavigate} />,
    );

    await user.click(within(screen.getByTestId('phase-seg-0')).getByRole('button'));
    expect(onNavigate).toHaveBeenCalledWith(0, 0);

    await user.click(within(screen.getByTestId('phase-seg-2')).getByRole('button'));
    expect(onNavigate).toHaveBeenLastCalledWith(2, 0);

    // Phases past the furthest reached are not selectable.
    expect(within(screen.getByTestId('phase-seg-3')).queryByRole('button')).toBeNull();
    expect(within(screen.getByTestId('phase-seg-4')).queryByRole('button')).toBeNull();
  });

  it('in free navigation, every subpart is its own jump target and reads accessible (blue)', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(
      <PhaseBar
        phases={PHASES}
        current={0}
        withinStep={0}
        maxVisited={0}
        onNavigate={onNavigate}
        freeNavigation
      />,
    );

    // A later phase's later subpart is directly reachable: the 5th Solve cell,
    // which normal (gated) navigation never exposes.
    await user.click(screen.getByRole('button', { name: 'Go to Solve, part 5' }));
    expect(onNavigate).toHaveBeenLastCalledWith(4, 4);

    // A single-step phase drops the "part N" suffix.
    await user.click(screen.getByRole('button', { name: 'Go to Inquiry' }));
    expect(onNavigate).toHaveBeenLastCalledWith(1, 0);

    // Accessible cells read blue (done); only the current cell (Review part 1)
    // reads red (current).
    expect(cellStates(0)).toEqual(['current', 'done']);
    expect(cellStates(4)).toEqual(['done', 'done', 'done', 'done', 'done']);
  });

  it('in free navigation, the current subpart reads clickable but does nothing on click', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(
      <PhaseBar
        phases={PHASES}
        current={0}
        withinStep={0}
        maxVisited={0}
        onNavigate={onNavigate}
        freeNavigation
      />,
    );

    // The current subpart is a button so it reads clickable (pointer + hover) like
    // the others, but clicking it must not navigate anywhere.
    const current = screen.getByRole('button', { name: /current/i });
    await user.click(current);
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('renders no navigation buttons when onNavigate is omitted', () => {
    render(<PhaseBar phases={PHASES} current={2} withinStep={0} maxVisited={4} />);

    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('handles the first phase: nothing complete, first phase active', () => {
    render(<PhaseBar phases={PHASES} current={0} withinStep={0} maxVisited={0} />);

    expect(screen.getByTestId('phase-seg-0')).toHaveAttribute('data-state', 'active');
    for (let index = 1; index < LABELS.length; index += 1) {
      expect(screen.getByTestId(`phase-seg-${index}`)).toHaveAttribute('data-state', 'upcoming');
    }
  });

  it('handles the last phase: every earlier phase complete, last active', () => {
    render(<PhaseBar phases={PHASES} current={4} withinStep={0} maxVisited={4} />);

    for (let index = 0; index < LABELS.length - 1; index += 1) {
      expect(screen.getByTestId(`phase-seg-${index}`)).toHaveAttribute('data-state', 'complete');
    }
    expect(screen.getByTestId('phase-seg-4')).toHaveAttribute('data-state', 'active');
  });
});
