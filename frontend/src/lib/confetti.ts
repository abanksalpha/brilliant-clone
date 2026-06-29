import confetti from 'canvas-confetti';

const COLORS = ['#e7a13a', '#2f7ad1', '#dd7159'];

// True only in a real browser that can animate: never in jsdom/test
// environments, never under prefers-reduced-motion, and never without a working
// 2D canvas. Both celebrations share this guard so neither runs (or logs) in
// tests or for a learner who opted out of motion.
function canFire(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
  }

  if (typeof navigator !== 'undefined' && navigator.userAgent.includes('jsdom')) {
    return false;
  }

  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    return false;
  }

  try {
    const probe = document.createElement('canvas');
    if (!probe.getContext || !probe.getContext('2d')) {
      return false;
    }
  } catch {
    return false;
  }

  return true;
}

// A single, restrained celebration burst for finishing a whole lesson.
export function celebrate() {
  if (!canFire()) {
    return;
  }

  const fire = (particleRatio: number, options: confetti.Options) => {
    confetti({
      origin: { y: 0.62 },
      colors: COLORS,
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

// A lighter single burst for the smaller wins: entering a lesson and solving a
// problem correctly. Reuses the same guard so it never runs in tests or under
// reduced motion, and stays smaller than the lesson-complete celebrate above.
export function celebrateSmall() {
  if (!canFire()) {
    return;
  }

  confetti({
    origin: { y: 0.7 },
    colors: COLORS,
    disableForReducedMotion: true,
    particleCount: 50,
    spread: 55,
    startVelocity: 40,
    scalar: 0.9,
  });
}
