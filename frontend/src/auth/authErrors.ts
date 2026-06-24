const CANCELLED_POPUP_CODES = new Set([
  'auth/popup-closed-by-user',
  'auth/cancelled-popup-request',
  'auth/user-cancelled',
]);

function getAuthErrorCode(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : undefined;
  }

  return undefined;
}

export function isCancelledPopupError(error: unknown): boolean {
  const code = getAuthErrorCode(error);
  return code !== undefined && CANCELLED_POPUP_CODES.has(code);
}
