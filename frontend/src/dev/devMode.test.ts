import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveDevMode } from './devMode';

// jsdom's localStorage is not reliably functional in this env, so install a small
// in-memory one to exercise the sticky-toggle persistence deterministically.
beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: () => null,
    get length() {
      return store.size;
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('resolveDevMode', () => {
  it('is off by default', () => {
    expect(resolveDevMode('')).toBe(false);
  });

  it('turns on with dev=1 and stays on across navigation (sticky)', () => {
    expect(resolveDevMode('dev=1')).toBe(true);
    // A later URL without the param keeps the stored toggle in effect.
    expect(resolveDevMode('')).toBe(true);
    expect(resolveDevMode('foo=bar')).toBe(true);
  });

  it('turns off with dev=0', () => {
    resolveDevMode('dev=1');
    expect(resolveDevMode('dev=0')).toBe(false);
    expect(resolveDevMode('')).toBe(false);
  });

  it('accepts true/false and a leading question mark', () => {
    expect(resolveDevMode('?dev=true')).toBe(true);
    expect(resolveDevMode('?dev=false')).toBe(false);
  });
});
