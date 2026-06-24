import type { MouseEvent } from 'react';

/**
 * Stops a mouse click from focusing the element it is attached to.
 *
 * Why this exists: the draggable charges / sensors / probes in the simulations
 * are focusable SVG `<g>` elements (role="slider" / "button", tabIndex={0}) so
 * they remain keyboard accessible. On macOS, WebKit/Safari (and Chromium with
 * "Full Keyboard Access") paints a native blue focus ring around whichever
 * element is focused. That ring is drawn by the OS, not the page, so it CANNOT
 * be removed with CSS — `outline`, `box-shadow`, and `-webkit-tap-highlight`
 * all have no effect on it (and it never shows up in headless screenshots).
 *
 * The ring only appears on a *focused* element, and focusing on click is the
 * default action of `mousedown`. Cancelling that default keeps the element from
 * being focused by a click/drag, so no ring is ever drawn — while Tab focus and
 * arrow-key control still work, because the keyboard never fires `mousedown`.
 *
 * Attach as `onMouseDown` on any focusable, pointer-draggable handle.
 * Pointer-event dragging is unaffected: `setPointerCapture` runs on
 * `pointerdown` (which fires first) and pointer move/up are not cancelled.
 */
export function preventClickFocus(event: MouseEvent): void {
  event.preventDefault();
}
