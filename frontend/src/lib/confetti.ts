import confetti from 'canvas-confetti';

// A single, restrained celebration burst. Guarded so it never runs (or logs) in
// jsdom/test environments or when the user prefers reduced motion.
export function celebrate() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  if (typeof navigator !== 'undefined' && navigator.userAgent.includes('jsdom')) {
    return;
  }

  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  try {
    const probe = document.createElement('canvas');
    if (!probe.getContext || !probe.getContext('2d')) {
      return;
    }
  } catch {
    return;
  }

  const colors = ['#e7a13a', '#2f7ad1', '#4cae7a', '#dd7159'];
  const fire = (particleRatio: number, options: confetti.Options) => {
    confetti({
      origin: { y: 0.62 },
      colors,
      disableForReducedMotion: true,
      particleCount: Math.floor(160 * particleRatio),
      ...options,
    });
  };

  fire(0.25, { spread: 26, startVelocity: 55 });
  fire(0.2, { spread: 60 });
  fire(0.35, { spread: 100, decay: 0.91, scalar: 0.9 });
  fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
  fire(0.1, { spread: 120, startVelocity: 45 });
}
