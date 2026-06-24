import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';
import { AuthProvider } from '../auth/AuthContext';
import { ProgressProvider } from '../progress/ProgressContext';
import { LessonPage } from './LessonPage';

vi.mock('../lib/firebase', () => ({
  auth: null,
  googleProvider: {},
  isFirebaseConfigured: false,
  db: null,
}));

describe('LessonPage', () => {
  it('uses the hand-drawn shell for lesson routes', () => {
    render(
      <MemoryRouter initialEntries={['/lesson/not-a-real-lesson']}>
        <AuthProvider>
          <ProgressProvider>
            <Routes>
              <Route path="/lesson/:lessonId" element={<LessonPage />} />
            </Routes>
          </ProgressProvider>
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(screen.getByRole('main')).toHaveClass('lesson-shell', 'theme-handdrawn');
    expect(screen.getByRole('heading', { name: 'Topic not found' })).toBeInTheDocument();
  });
});
