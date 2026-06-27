import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import { eraseHitTest, segmentStrokesIntoLines, strokeBBox } from './inkGeometry';
import type { BBox, InkLine, InkPoint, Stroke } from './inkGeometry';
import { clampViewport, fitToContent, panBy, screenToWorld, zoomAbout, type Viewport } from './inkViewport';

export type InkCanvasHandle = {
  getStrokeLines: () => InkLine[];
  toPngBase64: () => string;
  annotate: (lineId: string | null) => void;
  clear: () => void;
  resetView: () => void;
  undo: () => void;
  redo: () => void;
  // Snapshot and restore the full drawing so a problem's work survives
  // navigating to another problem and back. Strokes live in world space and the
  // viewport is the pan/zoom, so restoring both returns the canvas exactly.
  getStrokes: () => Stroke[];
  setStrokes: (strokes: Stroke[]) => void;
  getViewport: () => Viewport;
  setViewport: (viewport: Viewport) => void;
};

export type Tool = 'pen' | 'eraser';

type InkCanvasProps = {
  className?: string;
  tool: Tool;
  // Fired after every committed change so a parent can mirror the live drawing
  // into its own state. React detaches this canvas's ref before a parent's
  // unmount cleanup runs, so the parent cannot read the handle on the way out;
  // these callbacks keep the parent's copy current instead.
  onStrokesChange?: (strokes: Stroke[]) => void;
  onViewportChange?: (viewport: Viewport) => void;
};

// Fist/palm rejection: a resting palm or fist makes a much larger contact patch
// than a fingertip, so a touch whose reported contact width or height (CSS px)
// exceeds this is treated as a palm and ignored. Tuned to clear a hand resting
// on an iPad while leaving fingertips (typically well under this) alone. Devices
// that do not report contact geometry leave width/height near 0, so this never
// rejects a finger there.
const PALM_CONTACT_SIZE = 60;

// How close (in screen pixels) the eraser has to pass a stroke to remove it. The
// world radius is derived from this by dividing out the current zoom, so the
// eraser feels the same size on screen at any scale.
const ERASER_RADIUS = 14;
// Margin (screen pixels) left around the content when fitting the view.
const FIT_PADDING = 24;
// Grid spacing in WORLD units. Matches the landing demo's 28px graph paper, so
// the whiteboard reads the same as the marketing canvas.
const GRID_WORLD = 28;

// The single pen color and base width in world units. The painted width is the
// base modulated by pen pressure, so a heavier press is thicker. Pointer devices
// without pressure report 0.5.
const PEN_COLOR = '#2d2d2d';
const BASE_PEN_WIDTH = 5;

function strokeWidth(pressure: number): number {
  const clamped = Math.max(0, Math.min(1, pressure));
  return BASE_PEN_WIDTH * (0.6 + 0.8 * clamped);
}

function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not acquire a 2D drawing context for the ink canvas.');
  }
  return ctx;
}

// Union of every stroke bbox in WORLD space, or null when there is no ink. Used
// to fit the view to the drawing.
function contentBBox(strokes: Stroke[]): BBox | null {
  if (strokes.length === 0) return null;
  let box = strokeBBox(strokes[0]);
  for (let i = 1; i < strokes.length; i += 1) {
    const next = strokeBBox(strokes[i]);
    const x = Math.min(box.x, next.x);
    const y = Math.min(box.y, next.y);
    const right = Math.max(box.x + box.w, next.x + next.w);
    const bottom = Math.max(box.y + box.h, next.y + next.h);
    box = { x, y, w: right - x, h: bottom - y };
  }
  return box;
}

// A single sketchy ellipse pass. The wobble is a fixed sine, so the same line
// always gets the same hand drawn ring (deterministic, no randomness).
function drawSketchEllipse(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  phase: number,
): void {
  const steps = 72;
  ctx.beginPath();
  for (let i = 0; i <= steps; i += 1) {
    const angle = (i / steps) * Math.PI * 2 + phase;
    const wobble = 1 + 0.03 * Math.sin(angle * 6 + phase * 3);
    const x = cx + Math.cos(angle) * rx * wobble;
    const y = cy + Math.sin(angle) * ry * wobble;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

export const InkCanvas = forwardRef<InkCanvasHandle, InkCanvasProps>(function InkCanvas(
  { className, tool, onStrokesChange, onViewportChange },
  ref,
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inkRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);

  // Strokes are stored in WORLD space and never change when the user pans or
  // zooms. The view transform below maps world to screen for display only.
  const strokesRef = useRef<Stroke[]>([]);
  const viewportRef = useRef<Viewport>({ scale: 1, tx: 0, ty: 0 });
  // Strokes removed by undo, newest last, so redo can restore them in order. Any
  // fresh mutation (a new stroke, an erase, a clear, or a load) discards it.
  const redoRef = useRef<Stroke[]>([]);

  const currentRef = useRef<Stroke | null>(null);
  const lastRef = useRef<InkPoint | null>(null);
  const rectRef = useRef<DOMRect | null>(null);
  const drawingRef = useRef(false);
  const erasingRef = useRef(false);
  // Palm rejection: while a pen is actively down, finger (touch) input is
  // ignored so a resting palm cannot pan, zoom, or draw. Fingers navigate again
  // as soon as the pen lifts.
  const penActiveRef = useRef(false);
  // Active touch points (screen space) keyed by pointer id, and the last gesture
  // sample. One finger draws (like a pen); a second finger turns the gesture into
  // pan/zoom and cancels the in-progress single-finger stroke.
  const touchesRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const gestureRef = useRef<{ centroid: { x: number; y: number }; spread: number } | null>(null);
  // The pointer id of the single finger currently drawing, or null. Lets move/up
  // tell the drawing finger apart from a finger that is only part of a gesture.
  const touchDrawIdRef = useRef<number | null>(null);
  // Middle mouse drag pans on desktop.
  const mousePanRef = useRef<{ x: number; y: number } | null>(null);

  const strokeSeqRef = useRef(0);
  const annotationRef = useRef<string | null>(null);
  const sizeRef = useRef({ w: 0, h: 0 });
  const accentColorRef = useRef('');
  const gridColorRef = useRef('');

  const toolRef = useRef<Tool>(tool);
  useEffect(() => {
    toolRef.current = tool;
  }, [tool]);

  // Change callbacks, mirrored into refs so the bound-once pointer handlers and
  // the stable imperative methods always reach the latest props.
  const onStrokesChangeRef = useRef(onStrokesChange);
  const onViewportChangeRef = useRef(onViewportChange);
  useEffect(() => {
    onStrokesChangeRef.current = onStrokesChange;
  }, [onStrokesChange]);
  useEffect(() => {
    onViewportChangeRef.current = onViewportChange;
  }, [onViewportChange]);

  const notifyStrokes = useCallback(() => {
    onStrokesChangeRef.current?.(strokesRef.current.slice());
  }, []);

  // Keep the view inside the finite board, so panning or zooming can never push
  // the work permanently off screen. Called after every view change, and reports
  // the resulting viewport so a parent can persist the pan/zoom.
  const clampView = useCallback(() => {
    const { w, h } = sizeRef.current;
    if (w !== 0 && h !== 0) {
      viewportRef.current = clampViewport(viewportRef.current, w, h);
    }
    onViewportChangeRef.current?.({ ...viewportRef.current });
  }, []);

  // Set the canvas transform so drawing in WORLD coordinates lands at the right
  // screen pixels for the current view, accounting for devicePixelRatio.
  const applyViewTransform = useCallback((ctx: CanvasRenderingContext2D) => {
    const dpr = window.devicePixelRatio || 1;
    const v = viewportRef.current;
    ctx.setTransform(v.scale * dpr, 0, 0, v.scale * dpr, v.tx * dpr, v.ty * dpr);
  }, []);

  const paintSegment = useCallback(
    (ctx: CanvasRenderingContext2D, from: InkPoint, to: InkPoint) => {
      ctx.strokeStyle = PEN_COLOR;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = strokeWidth(to.p);
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    },
    [],
  );

  const paintDot = useCallback((ctx: CanvasRenderingContext2D, point: InkPoint) => {
    ctx.fillStyle = PEN_COLOR;
    ctx.beginPath();
    ctx.arc(point.x, point.y, strokeWidth(point.p) / 2, 0, Math.PI * 2);
    ctx.fill();
  }, []);

  const paintStroke = useCallback(
    (ctx: CanvasRenderingContext2D, stroke: Stroke) => {
      const pts = stroke.points;
      if (pts.length === 0) return;
      if (pts.length === 1) {
        paintDot(ctx, pts[0]);
        return;
      }
      for (let i = 1; i < pts.length; i += 1) {
        paintSegment(ctx, pts[i - 1], pts[i]);
      }
    },
    [paintDot, paintSegment],
  );

  // Infinite graph-paper grid drawn in WORLD space, so it pans and zooms with
  // the strokes. Only visible cells are stroked, and it fades out once cells get
  // denser than a few screen pixels. The export path never calls this, so the
  // grid never reaches the grader.
  const drawGrid = useCallback((ctx: CanvasRenderingContext2D) => {
    const color = gridColorRef.current;
    if (!color) return;
    const v = viewportRef.current;
    const { w, h } = sizeRef.current;
    if (w === 0 || h === 0) return;
    if (GRID_WORLD * v.scale < 6) return;

    const left = -v.tx / v.scale;
    const top = -v.ty / v.scale;
    const right = (w - v.tx) / v.scale;
    const bottom = (h - v.ty) / v.scale;
    const startX = Math.floor(left / GRID_WORLD) * GRID_WORLD;
    const startY = Math.floor(top / GRID_WORLD) * GRID_WORLD;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.13;
    ctx.lineWidth = 1 / v.scale;
    ctx.beginPath();
    for (let x = startX; x <= right; x += GRID_WORLD) {
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
    }
    for (let y = startY; y <= bottom; y += GRID_WORLD) {
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
    }
    ctx.stroke();
    ctx.restore();
  }, []);

  const redrawInk = useCallback(() => {
    const ink = inkRef.current;
    if (!ink) return;
    const ctx = context2d(ink);
    // Clear the whole backing store in device pixels, then paint in world space.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ink.width, ink.height);
    applyViewTransform(ctx);
    drawGrid(ctx);
    for (const stroke of strokesRef.current) {
      paintStroke(ctx, stroke);
    }
  }, [applyViewTransform, paintStroke, drawGrid]);

  const applyAnnotation = useCallback(
    (lineId: string | null) => {
      const overlay = overlayRef.current;
      if (!overlay) return;
      const ctx = context2d(overlay);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, overlay.width, overlay.height);
      if (lineId === null) return;

      const line = segmentStrokesIntoLines(strokesRef.current).find(
        (candidate) => candidate.id === lineId,
      );
      if (!line) return;

      // The bbox is in WORLD space; drawing through the view transform makes the
      // ring track the content as the user pans or zooms.
      applyViewTransform(ctx);
      const scale = viewportRef.current.scale;
      const pad = 10;
      const cx = line.bbox.x + line.bbox.w / 2;
      const cy = line.bbox.y + line.bbox.h / 2;
      const rx = line.bbox.w / 2 + pad;
      const ry = line.bbox.h / 2 + pad;

      ctx.strokeStyle = accentColorRef.current;
      // Divide by scale so the ring keeps a constant thickness on screen.
      ctx.lineWidth = 3 / scale;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      drawSketchEllipse(ctx, cx, cy, rx, ry, 0);
      drawSketchEllipse(ctx, cx, cy, rx, ry, Math.PI / 9);
      ctx.beginPath();
      ctx.moveTo(cx - rx, cy + ry + 4);
      ctx.lineTo(cx + rx, cy + ry + 6);
      ctx.stroke();
    },
    [applyViewTransform],
  );

  const eraseAt = useCallback(
    (point: { x: number; y: number }) => {
      const radius = ERASER_RADIUS / viewportRef.current.scale;
      const hitId = eraseHitTest(strokesRef.current, point, radius);
      if (!hitId) return;
      strokesRef.current = strokesRef.current.filter((stroke) => stroke.id !== hitId);
      redoRef.current = [];
      redrawInk();
      applyAnnotation(annotationRef.current);
      notifyStrokes();
    },
    [redrawInk, applyAnnotation, notifyStrokes],
  );

  const undo = useCallback(() => {
    if (strokesRef.current.length === 0) return;
    const removed = strokesRef.current[strokesRef.current.length - 1];
    strokesRef.current = strokesRef.current.slice(0, -1);
    redoRef.current = [...redoRef.current, removed];
    redrawInk();
    applyAnnotation(annotationRef.current);
    notifyStrokes();
  }, [redrawInk, applyAnnotation, notifyStrokes]);

  const redo = useCallback(() => {
    if (redoRef.current.length === 0) return;
    const restored = redoRef.current[redoRef.current.length - 1];
    redoRef.current = redoRef.current.slice(0, -1);
    strokesRef.current = [...strokesRef.current, restored];
    redrawInk();
    applyAnnotation(annotationRef.current);
    notifyStrokes();
  }, [redrawInk, applyAnnotation, notifyStrokes]);

  const clearAll = useCallback(() => {
    strokesRef.current = [];
    redoRef.current = [];
    annotationRef.current = null;
    redrawInk();
    applyAnnotation(null);
    notifyStrokes();
  }, [redrawInk, applyAnnotation, notifyStrokes]);

  // Fit the view to the current ink, or reset to the identity view when empty.
  const resetView = useCallback(() => {
    const { w, h } = sizeRef.current;
    const box = contentBBox(strokesRef.current);
    if (!box || w === 0 || h === 0) {
      viewportRef.current = { scale: 1, tx: 0, ty: 0 };
    } else {
      viewportRef.current = fitToContent(box, w, h, FIT_PADDING);
    }
    clampView();
    redrawInk();
    applyAnnotation(annotationRef.current);
  }, [redrawInk, applyAnnotation, clampView]);

  // Size both layers to the container with devicePixelRatio scaling, and keep
  // them in sync on resize. Resizing clears the bitmap, so we repaint after.
  useEffect(() => {
    const stage = containerRef.current;
    const ink = inkRef.current;
    const overlay = overlayRef.current;
    if (!stage || !ink || !overlay) return;

    const styles = getComputedStyle(stage);
    accentColorRef.current = styles.getPropertyValue('--sketch-accent').trim();
    gridColorRef.current = styles.getPropertyValue('--sketch-secondary').trim();

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = stage.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      sizeRef.current = { w, h };
      for (const canvas of [ink, overlay]) {
        canvas.width = Math.max(1, Math.round(w * dpr));
        canvas.height = Math.max(1, Math.round(h * dpr));
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
      }
      // The board is sized from the view, so a resize can leave the old view out
      // of bounds. Re-clamp before repainting.
      clampView();
      redrawInk();
      applyAnnotation(annotationRef.current);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [redrawInk, applyAnnotation, clampView]);

  // Keyboard undo/redo for the whiteboard: Cmd/Ctrl+Z undoes the last stroke and
  // Cmd/Ctrl+Shift+Z (or Ctrl+Y) redoes it. Bound to the window so it works
  // whenever the board is on screen, but it yields to a focused text field so
  // native editing undo still works there.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable ||
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT')
      ) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (key === 'y') {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undo, redo]);

  // Pointer handling. The overlay sits on top but ignores pointer events, so all
  // input is captured on the ink layer. Pen, mouse, and a single finger draw
  // (screen is converted to world before a point is stored). Two or more fingers
  // pan and pinch; a pen takes over with palm rejection for resting fingers.
  useEffect(() => {
    const ink = inkRef.current;
    if (!ink) return;
    const ctx = context2d(ink);

    const localOf = (event: PointerEvent, rect: DOMRect) => ({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });

    const touchPoints = () => [...touchesRef.current.values()];
    const centroidOf = (pts: Array<{ x: number; y: number }>) => {
      let sx = 0;
      let sy = 0;
      for (const p of pts) {
        sx += p.x;
        sy += p.y;
      }
      return { x: sx / pts.length, y: sy / pts.length };
    };
    const spreadOf = (pts: Array<{ x: number; y: number }>, c: { x: number; y: number }) => {
      if (pts.length < 2) return 0;
      let total = 0;
      for (const p of pts) total += Math.hypot(p.x - c.x, p.y - c.y);
      return total / pts.length;
    };
    const sampleGesture = () => {
      const pts = touchPoints();
      const centroid = centroidOf(pts);
      return { centroid, spread: spreadOf(pts, centroid) };
    };

    // --- Stroke lifecycle, shared by pen, mouse, and single-finger touch ----
    const beginStrokeOrErase = (event: PointerEvent, rect: DOMRect) => {
      const local = localOf(event, rect);
      const world = screenToWorld(viewportRef.current, local.x, local.y);
      if (toolRef.current === 'eraser') {
        erasingRef.current = true;
        eraseAt(world);
        return;
      }
      drawingRef.current = true;
      strokeSeqRef.current += 1;
      const start: InkPoint = {
        x: world.x,
        y: world.y,
        p: event.pressure > 0 ? event.pressure : 0.5,
        t: event.timeStamp,
      };
      currentRef.current = { id: `stroke-${strokeSeqRef.current}`, points: [start] };
      lastRef.current = start;
      applyViewTransform(ctx);
      paintDot(ctx, start);
    };

    const extendStroke = (event: PointerEvent, rect: DOMRect) => {
      if (toolRef.current === 'eraser') {
        if (erasingRef.current) {
          const local = localOf(event, rect);
          eraseAt(screenToWorld(viewportRef.current, local.x, local.y));
        }
        return;
      }
      if (!drawingRef.current || !currentRef.current || !lastRef.current) return;
      const stroke = currentRef.current;
      let prev = lastRef.current;

      const coalesced =
        typeof event.getCoalescedEvents === 'function' ? event.getCoalescedEvents() : [];
      const samples = coalesced.length > 0 ? coalesced : [event];
      applyViewTransform(ctx);
      for (const item of samples) {
        const local = localOf(item, rect);
        const world = screenToWorld(viewportRef.current, local.x, local.y);
        const point: InkPoint = {
          x: world.x,
          y: world.y,
          p: item.pressure > 0 ? item.pressure : 0.5,
          t: item.timeStamp,
        };
        stroke.points.push(point);
        paintSegment(ctx, prev, point);
        prev = point;
      }
      lastRef.current = prev;
    };

    const commitStroke = () => {
      if (toolRef.current === 'eraser') {
        erasingRef.current = false;
        return;
      }
      if (!drawingRef.current) return;
      drawingRef.current = false;
      const stroke = currentRef.current;
      currentRef.current = null;
      lastRef.current = null;
      if (stroke && stroke.points.length > 0) {
        strokesRef.current.push(stroke);
        redoRef.current = [];
        notifyStrokes();
      }
    };

    // Throw away an in-progress single-finger stroke (or erase) when a second
    // finger lands, so starting a pan/zoom never leaves a stray mark behind.
    const abortTouchStroke = () => {
      touchDrawIdRef.current = null;
      erasingRef.current = false;
      if (drawingRef.current) {
        drawingRef.current = false;
        currentRef.current = null;
        lastRef.current = null;
        redrawInk();
        applyAnnotation(annotationRef.current);
      }
    };

    const onDown = (event: PointerEvent) => {
      rectRef.current = ink.getBoundingClientRect();
      const rect = rectRef.current;

      if (event.pointerType === 'touch') {
        if (penActiveRef.current) return; // palm rejection while a pen draws
        // Fist/palm rejection by contact size: a resting palm or fist makes a
        // far larger contact than a fingertip, so ignore it entirely (no draw,
        // pan, or zoom) when writing with a hand resting on the screen.
        if (event.width > PALM_CONTACT_SIZE || event.height > PALM_CONTACT_SIZE) return;
        ink.setPointerCapture(event.pointerId);
        touchesRef.current.set(event.pointerId, localOf(event, rect));

        if (touchesRef.current.size === 1) {
          // The first finger draws, exactly like a pen, so a phone with no
          // stylus can still write.
          touchDrawIdRef.current = event.pointerId;
          beginStrokeOrErase(event, rect);
          return;
        }

        // A second finger means the user wants to pan/zoom, not draw: drop the
        // accidental single-finger stroke and start a gesture from both points.
        abortTouchStroke();
        gestureRef.current = sampleGesture();
        return;
      }

      if (event.pointerType === 'mouse' && event.button === 1) {
        ink.setPointerCapture(event.pointerId);
        mousePanRef.current = localOf(event, rect);
        ink.style.cursor = 'grabbing';
        return;
      }

      if (event.pointerType === 'mouse' && event.button !== 0) return;

      if (event.pointerType === 'pen') {
        penActiveRef.current = true;
        touchesRef.current.clear();
        touchDrawIdRef.current = null;
        gestureRef.current = null;
      } else if (event.pointerType !== 'mouse') {
        return;
      }

      ink.setPointerCapture(event.pointerId);
      beginStrokeOrErase(event, rect);
    };

    const onMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch') {
        if (penActiveRef.current) return;
        // A contact that grows to palm/fist size after landing is a resting
        // hand: drop it so it stops driving the canvas (and cancel any stray
        // stroke it started).
        if (event.width > PALM_CONTACT_SIZE || event.height > PALM_CONTACT_SIZE) {
          if (touchesRef.current.has(event.pointerId)) {
            if (touchDrawIdRef.current === event.pointerId) abortTouchStroke();
            touchesRef.current.delete(event.pointerId);
            gestureRef.current = touchesRef.current.size >= 2 ? sampleGesture() : null;
          }
          return;
        }
        if (!touchesRef.current.has(event.pointerId)) return;
        const rect = rectRef.current ?? ink.getBoundingClientRect();
        touchesRef.current.set(event.pointerId, localOf(event, rect));

        if (touchesRef.current.size >= 2) {
          const sample = sampleGesture();
          const prev = gestureRef.current;
          if (prev) {
            if (prev.spread > 0 && sample.spread > 0) {
              viewportRef.current = zoomAbout(
                viewportRef.current,
                sample.centroid,
                sample.spread / prev.spread,
              );
            }
            viewportRef.current = panBy(
              viewportRef.current,
              sample.centroid.x - prev.centroid.x,
              sample.centroid.y - prev.centroid.y,
            );
            clampView();
            redrawInk();
            applyAnnotation(annotationRef.current);
          }
          gestureRef.current = sample;
          return;
        }

        // Single finger: only the one that began the stroke keeps drawing.
        if (touchDrawIdRef.current === event.pointerId) {
          extendStroke(event, rect);
        }
        return;
      }

      if (event.pointerType === 'mouse' && mousePanRef.current) {
        const rect = rectRef.current ?? ink.getBoundingClientRect();
        const cur = localOf(event, rect);
        viewportRef.current = panBy(
          viewportRef.current,
          cur.x - mousePanRef.current.x,
          cur.y - mousePanRef.current.y,
        );
        clampView();
        mousePanRef.current = cur;
        redrawInk();
        applyAnnotation(annotationRef.current);
        return;
      }

      const rect = rectRef.current;
      if (!rect) return;
      extendStroke(event, rect);
    };

    const onUp = (event: PointerEvent) => {
      if (event.pointerType === 'pen') penActiveRef.current = false;

      if (event.pointerType === 'touch') {
        const wasDrawing = touchDrawIdRef.current === event.pointerId;
        touchesRef.current.delete(event.pointerId);
        if (wasDrawing) {
          touchDrawIdRef.current = null;
          commitStroke();
        }
        // Re-baseline the gesture for whatever fingers remain. A lone leftover
        // finger does not resume drawing: it never became the drawing finger.
        gestureRef.current = touchesRef.current.size >= 2 ? sampleGesture() : null;
        return;
      }

      if (event.pointerType === 'mouse' && mousePanRef.current) {
        mousePanRef.current = null;
        ink.style.cursor = '';
        return;
      }

      commitStroke();
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = ink.getBoundingClientRect();
      const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      if (event.ctrlKey) {
        // A trackpad pinch (browsers report it as Ctrl + wheel) zooms about the
        // cursor. Hold Ctrl with a mouse wheel to zoom the same way.
        viewportRef.current = zoomAbout(viewportRef.current, point, Math.exp(-event.deltaY * 0.01));
      } else {
        // Any other wheel input -- a two finger trackpad swipe in any direction,
        // or a plain mouse wheel -- pans the board instead of zooming.
        viewportRef.current = panBy(viewportRef.current, -event.deltaX, -event.deltaY);
      }
      clampView();
      redrawInk();
      applyAnnotation(annotationRef.current);
    };

    // Stop the middle button auto scroll so the middle drag can pan instead.
    const onMouseDownGuard = (event: MouseEvent) => {
      if (event.button === 1) event.preventDefault();
    };

    ink.addEventListener('pointerdown', onDown);
    ink.addEventListener('pointermove', onMove);
    ink.addEventListener('pointerup', onUp);
    ink.addEventListener('pointercancel', onUp);
    ink.addEventListener('wheel', onWheel, { passive: false });
    ink.addEventListener('mousedown', onMouseDownGuard);
    return () => {
      ink.removeEventListener('pointerdown', onDown);
      ink.removeEventListener('pointermove', onMove);
      ink.removeEventListener('pointerup', onUp);
      ink.removeEventListener('pointercancel', onUp);
      ink.removeEventListener('wheel', onWheel);
      ink.removeEventListener('mousedown', onMouseDownGuard);
    };
  }, [eraseAt, paintDot, paintSegment, redrawInk, applyAnnotation, applyViewTransform, clampView, notifyStrokes]);

  useImperativeHandle(
    ref,
    () => ({
      getStrokeLines: () => segmentStrokesIntoLines(strokesRef.current),
      toPngBase64: () => {
        const ink = inkRef.current;
        if (!ink) {
          throw new Error('Cannot export the ink canvas before it is mounted.');
        }
        // View independent raster. Strokes are drawn in world space at a fixed
        // world to pixel scale (devicePixelRatio, identity view), so the bytes
        // depend only on the strokes, never on the current pan or zoom, and the
        // PNG stays in the same space as the world stroke bounding boxes.
        const dpr = window.devicePixelRatio || 1;
        const { w, h } = sizeRef.current;
        const out = document.createElement('canvas');
        out.width = Math.max(1, Math.round(w * dpr));
        out.height = Math.max(1, Math.round(h * dpr));
        const exportCtx = context2d(out);
        exportCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        for (const stroke of strokesRef.current) {
          paintStroke(exportCtx, stroke);
        }
        const base64 = out.toDataURL('image/png').split(',')[1];
        if (!base64) {
          throw new Error('Failed to encode the ink canvas as a PNG.');
        }
        return base64;
      },
      annotate: (lineId: string | null) => {
        annotationRef.current = lineId;
        applyAnnotation(lineId);
      },
      clear: () => clearAll(),
      resetView: () => resetView(),
      undo: () => undo(),
      redo: () => redo(),
      getStrokes: () => strokesRef.current.slice(),
      setStrokes: (strokes: Stroke[]) => {
        strokesRef.current = strokes.slice();
        redoRef.current = [];
        annotationRef.current = null;
        redrawInk();
        applyAnnotation(null);
        notifyStrokes();
      },
      getViewport: () => ({ ...viewportRef.current }),
      setViewport: (viewport: Viewport) => {
        viewportRef.current = { ...viewport };
        clampView();
        redrawInk();
        applyAnnotation(annotationRef.current);
      },
    }),
    [applyAnnotation, clearAll, resetView, paintStroke, undo, redo, redrawInk, clampView, notifyStrokes],
  );

  return (
    <div
      className={className ? `ink-canvas ${className}` : 'ink-canvas'}
      style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}
    >
      <div
        className="ink-stage"
        ref={containerRef}
        style={{
          position: 'relative',
          flex: '1 1 auto',
          minHeight: 0,
          padding: 0,
          overflow: 'hidden',
          touchAction: 'none',
        }}
      >
        <canvas
          ref={inkRef}
          className="ink-layer ink-layer--base"
          style={{ position: 'absolute', top: 0, left: 0, display: 'block', touchAction: 'none' }}
        />
        <canvas
          ref={overlayRef}
          className="ink-layer ink-layer--overlay"
          aria-hidden="true"
          style={{ position: 'absolute', top: 0, left: 0, display: 'block', pointerEvents: 'none' }}
        />
      </div>
    </div>
  );
});
