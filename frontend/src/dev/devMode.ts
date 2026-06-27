// Opt-in dev mode for testing the course path. Append `?dev=1` to any in-app URL
// to turn it on (it sticks in this browser via localStorage so it survives
// navigating into a lesson and back), and `?dev=0` to turn it off. When on, the
// dashboard unlocks every live lesson and its problem set so they can be opened
// without finishing the prerequisites. It only affects the local browser; it does
// not change anyone's stored progress.

const DEV_MODE_KEY = 'apt.devMode';

function safeStorage(): Storage | null {
  try {
    const storage = globalThis.localStorage as Storage | undefined;
    // Validate the methods exist: some environments (privacy modes, test jsdom)
    // expose a localStorage object whose methods are missing, and reading them
    // unguarded would throw and crash the caller during render.
    if (
      storage &&
      typeof storage.getItem === 'function' &&
      typeof storage.setItem === 'function' &&
      typeof storage.removeItem === 'function'
    ) {
      return storage;
    }
  } catch {
    // Accessing localStorage can throw outright when it is disabled.
  }
  return null;
}

/**
 * Resolves whether dev mode is active given a URL query string, persisting an
 * explicit `dev=1`/`dev=0` toggle. An absent `dev` param leaves the stored value
 * unchanged, so the mode stays on across navigation once enabled.
 */
export function resolveDevMode(search: string): boolean {
  const storage = safeStorage();
  let enabled = storage?.getItem(DEV_MODE_KEY) === '1';

  try {
    const value = new URLSearchParams(search).get('dev');
    if (value === '1' || value === 'true') {
      enabled = true;
      storage?.setItem(DEV_MODE_KEY, '1');
    } else if (value === '0' || value === 'false') {
      enabled = false;
      storage?.removeItem(DEV_MODE_KEY);
    }
  } catch {
    // A malformed search string just leaves the stored value in effect.
  }

  return enabled;
}
