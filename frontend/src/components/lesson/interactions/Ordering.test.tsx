import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { OrderingConfig } from '../../../content';
import { Ordering } from './Ordering';

type OrderingUser = ReturnType<typeof userEvent.setup>;

const config: OrderingConfig = {
  items: [
    { id: 'o1', label: 'Bring the rod near' },
    { id: 'o2', label: 'Connect the ground' },
    { id: 'o3', label: 'Disconnect the ground' },
    { id: 'o4', label: 'Remove the rod' },
  ],
};

const CORRECT_IDS = ['o1', 'o2', 'o3', 'o4'];
const LABEL_BY_ID = new Map(config.items.map((item) => [item.id, item.label]));

function renderedIds(): string[] {
  return Array.from(document.querySelectorAll('[data-cci-order-id]')).map(
    (element) => element.getAttribute('data-cci-order-id') ?? '',
  );
}

// Selection sort using the widget's Up buttons: bring each wanted id to its slot
// from the top down, exactly as a learner (or the lesson driver) would.
async function sortToCorrect(user: OrderingUser, correctIds: string[]) {
  for (let targetIndex = 0; targetIndex < correctIds.length; targetIndex += 1) {
    const wantedId = correctIds[targetIndex];
    let currentIndex = renderedIds().indexOf(wantedId);
    while (currentIndex > targetIndex) {
      const label = LABEL_BY_ID.get(wantedId) ?? '';
      await user.click(screen.getByRole('button', { name: `Move ${label} up` }));
      currentIndex -= 1;
    }
  }
}

describe('Ordering widget', () => {
  it('renders the items but never already in the correct order', () => {
    render(<Ordering config={config} onResult={vi.fn()} />);

    const ids = renderedIds();
    expect(ids).toHaveLength(CORRECT_IDS.length);
    expect([...ids].sort()).toEqual([...CORRECT_IDS].sort());
    expect(ids).not.toEqual(CORRECT_IDS);
  });

  it('reports correct once the learner reorders the steps into the right order', async () => {
    const user = userEvent.setup();
    const onResult = vi.fn();
    render(<Ordering config={config} onResult={onResult} />);

    await sortToCorrect(user, CORRECT_IDS);
    expect(renderedIds()).toEqual(CORRECT_IDS);

    await user.click(screen.getByRole('button', { name: 'Check order' }));
    expect(onResult).toHaveBeenCalledWith('correct');
  });

  it('reports wrong when the order is not the correct one', async () => {
    const user = userEvent.setup();
    const onResult = vi.fn();
    render(<Ordering config={config} onResult={onResult} />);

    // The initial render is guaranteed not to be the correct order.
    await user.click(screen.getByRole('button', { name: 'Check order' }));
    expect(onResult).toHaveBeenCalledWith('wrong');
    expect(onResult).not.toHaveBeenCalledWith('correct');
  });
});
