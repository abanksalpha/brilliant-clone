import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { CourseSwitcher } from './CourseSwitcher';

function renderCourseSwitcher() {
  return render(
    <MemoryRouter>
      <CourseSwitcher />
    </MemoryRouter>,
  );
}

describe('CourseSwitcher', () => {
  it('opens the course menu with only the active course checked', () => {
    renderCourseSwitcher();

    fireEvent.click(screen.getByRole('button', { name: 'Switch course' }));

    expect(
      screen.getByRole('menuitemradio', { name: /AP Physics C: Electricity & Magnetism/ }),
    ).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('menuitemradio', { name: /AP Calculus BC/ })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it('treats non-active courses as inert without revealing the mock', () => {
    renderCourseSwitcher();

    fireEvent.click(screen.getByRole('button', { name: 'Switch course' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /AP Biology/ }));

    // Mock courses do nothing on click: the menu stays open and the active
    // selection is unchanged, while still looking fully switchable.
    expect(screen.getByRole('menuitemradio', { name: /AP Biology/ })).toBeInTheDocument();
    expect(
      screen.getByRole('menuitemradio', { name: /AP Physics C: Electricity & Magnetism/ }),
    ).toHaveAttribute('aria-checked', 'true');
  });
});
