import { useEffect, useRef, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

type PdfViewerProps = {
  src: string;
  initialPage?: number;
};

// Backing-store width (device pixels) each page is rasterized at. CSS then sizes
// the canvas for display, so text stays crisp when scaled down and reasonably
// crisp when zoomed in (up to roughly this width on screen).
const RENDER_WIDTH = 1500;

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 4;
const ZOOM_STEP = 0.25;

function clampZoom(value: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(value * 100) / 100));
}

// Renders every page of a PDF as a vertical stack of canvases inside a
// scrollable box. Unlike an <iframe>, this works on mobile browsers (iOS Safari
// only renders the first page of an embedded PDF and ignores "#page=N"). Pages
// are sized in pixels from the window's width times the zoom level, so zooming
// in makes the sheet bigger and pans with horizontal scroll instead of just
// refitting the window.
export default function PdfViewer({ src, initialPage = 1 }: PdfViewerProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pagesRef = useRef<HTMLDivElement | null>(null);
  // The width (px) a page occupies at zoom 1, i.e. the scroller's usable width.
  const baseWidthRef = useRef(0);
  const [zoom, setZoom] = useState(1);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    let loadingTask: import('pdfjs-dist').PDFDocumentLoadingTask | null = null;
    const pages = pagesRef.current;
    const scroller = scrollRef.current;
    if (!pages || !scroller) return;

    setStatus('loading');
    pages.replaceChildren();

    void (async () => {
      try {
        // pdf.js is heavy, so it is loaded on demand: only opening the sheet
        // pulls it in, keeping it out of the initial app bundle.
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
        loadingTask = pdfjsLib.getDocument({ url: src });
        const pdf = await loadingTask.promise;
        if (cancelled) return;

        const canvases: HTMLCanvasElement[] = [];
        for (let n = 1; n <= pdf.numPages; n += 1) {
          const page = await pdf.getPage(n);
          if (cancelled) return;
          const base = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: RENDER_WIDTH / base.width });
          const canvas = document.createElement('canvas');
          canvas.className = 'pdf-viewer-page';
          canvas.width = Math.round(viewport.width);
          canvas.height = Math.round(viewport.height);
          pages.appendChild(canvas);
          canvases.push(canvas);
          await page.render({ canvas, viewport }).promise;
          if (cancelled) return;
          if (n === 1) setStatus('ready');
        }

        const idx = Math.min(Math.max(initialPage, 1), canvases.length) - 1;
        const target = canvases[idx];
        if (target) {
          // Wait one frame so layout reflects the freshly added canvases before
          // jumping to the requested starting page.
          requestAnimationFrame(() => {
            if (!cancelled) scroller.scrollTop = target.offsetTop;
          });
        }
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
      loadingTask?.destroy();
    };
  }, [src, initialPage]);

  // Size the pages from the scroller's usable width times the zoom. Re-measured
  // on resize and whenever the zoom changes.
  useEffect(() => {
    const scroller = scrollRef.current;
    const pages = pagesRef.current;
    if (!scroller || !pages) return;

    const apply = () => {
      const style = getComputedStyle(pages);
      const padX = parseFloat(style.paddingLeft || '0') + parseFloat(style.paddingRight || '0');
      const usable = scroller.clientWidth - padX;
      if (usable > 0) baseWidthRef.current = usable;
      pages.style.setProperty('--pdf-page-width', `${Math.round(baseWidthRef.current * zoom)}px`);
    };

    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(scroller);
    return () => observer.disconnect();
  }, [zoom]);

  // Trackpad pinch (reported as Ctrl + wheel) and Ctrl/Cmd + wheel zoom the sheet
  // about its current position instead of scrolling.
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const onWheel = (event: WheelEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      setZoom((z) => clampZoom(z - Math.sign(event.deltaY) * ZOOM_STEP));
    };
    scroller.addEventListener('wheel', onWheel, { passive: false });
    return () => scroller.removeEventListener('wheel', onWheel);
  }, []);

  return (
    <div className="pdf-viewer" data-status={status}>
      <div className="pdf-viewer-scroll" ref={scrollRef}>
        <div className="pdf-viewer-pages" ref={pagesRef} />
      </div>

      {status !== 'ready' ? (
        <p className="pdf-viewer-note" role="status">
          {status === 'error' ? (
            <>
              Couldn&rsquo;t display the sheet.{' '}
              <a href={src} target="_blank" rel="noreferrer">
                Open it in a new tab
              </a>
              .
            </>
          ) : (
            'Loading\u2026'
          )}
        </p>
      ) : null}

      {status === 'ready' ? (
        <div className="pdf-viewer-zoom" role="group" aria-label="Zoom">
          <button
            type="button"
            onClick={() => setZoom((z) => clampZoom(z - ZOOM_STEP))}
            disabled={zoom <= ZOOM_MIN}
            aria-label="Zoom out"
          >
            <Minus size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="pdf-viewer-zoom-label"
            onClick={() => setZoom(1)}
            aria-label="Reset zoom"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => clampZoom(z + ZOOM_STEP))}
            disabled={zoom >= ZOOM_MAX}
            aria-label="Zoom in"
          >
            <Plus size={16} aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
