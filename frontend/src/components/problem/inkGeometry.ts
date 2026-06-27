// Pure, framework free geometry for the ink canvas. It is split out from the
// React component so it can be unit tested without a real raster canvas (jsdom
// has none). Everything here is deterministic: the same strokes always produce
// the same lines and the same hit test result.

export type InkPoint = { x: number; y: number; p: number; t: number };
export type Stroke = { id: string; points: InkPoint[] };
export type BBox = { x: number; y: number; w: number; h: number };
export type InkLine = { id: string; bbox: BBox; strokeIds: string[] };

// How forgiving the line clustering is for the gap between two strokes that do
// not actually overlap. Expressed as a fraction of the taller stroke's height,
// so it scales with the handwriting size instead of being a fixed pixel guess.
const PROXIMITY_FRACTION = 0.5;

/** Axis aligned bounding box of a stroke. Throws on an empty stroke. */
export function strokeBBox(stroke: Stroke): BBox {
  if (stroke.points.length === 0) {
    throw new Error(`Cannot compute a bounding box for stroke "${stroke.id}" with no points.`);
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const point of stroke.points) {
    if (point.x < minX) minX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.x > maxX) maxX = point.x;
    if (point.y > maxY) maxY = point.y;
  }

  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function centerY(box: BBox): number {
  return box.y + box.h / 2;
}

/** Signed vertical overlap of two boxes. Positive means they share rows. */
function verticalOverlap(a: BBox, b: BBox): number {
  return Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
}

/** Union of two boxes. */
function unionBBox(a: BBox, b: BBox): BBox {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const right = Math.max(a.x + a.w, b.x + b.w);
  const bottom = Math.max(a.y + a.h, b.y + b.h);
  return { x, y, w: right - x, h: bottom - y };
}

type Cluster = { bbox: BBox; members: Array<{ id: string; bbox: BBox }> };

function sameLine(clusterBox: BBox, strokeBox: BBox): boolean {
  if (verticalOverlap(clusterBox, strokeBox) > 0) return true;
  const gap = Math.abs(centerY(clusterBox) - centerY(strokeBox));
  const proximity = PROXIMITY_FRACTION * Math.max(clusterBox.h, strokeBox.h);
  return gap <= proximity;
}

/**
 * Cluster strokes into ordered handwriting lines, top to bottom. Two strokes
 * join the same line when their boxes overlap vertically or their box y centers
 * sit close together (relative to the line height). Ids are "line-1", "line-2",
 * and so on in top to bottom order; each line bbox is the union of its strokes.
 */
export function segmentStrokesIntoLines(strokes: Stroke[]): InkLine[] {
  if (strokes.length === 0) return [];

  const measured = strokes.map((stroke) => ({ id: stroke.id, bbox: strokeBBox(stroke) }));

  // Sort top to bottom by box y center, then left to right, then by id so the
  // result never depends on the input order.
  measured.sort((a, b) => {
    const byCenter = centerY(a.bbox) - centerY(b.bbox);
    if (byCenter !== 0) return byCenter;
    const byX = a.bbox.x - b.bbox.x;
    if (byX !== 0) return byX;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  const clusters: Cluster[] = [];
  for (const item of measured) {
    const current = clusters[clusters.length - 1];
    if (current && sameLine(current.bbox, item.bbox)) {
      current.bbox = unionBBox(current.bbox, item.bbox);
      current.members.push(item);
    } else {
      clusters.push({ bbox: item.bbox, members: [item] });
    }
  }

  return clusters.map((cluster, index) => {
    // Within a line, order strokes left to right for a natural reading order.
    const ordered = [...cluster.members].sort((a, b) => {
      const byX = a.bbox.x - b.bbox.x;
      if (byX !== 0) return byX;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
    return {
      id: `line-${index + 1}`,
      bbox: cluster.bbox,
      strokeIds: ordered.map((member) => member.id),
    };
  });
}

function pointToSegmentDistance(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  if (dx === 0 && dy === 0) {
    return Math.hypot(px - ax, py - ay);
  }
  const t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy);
  const clamped = Math.max(0, Math.min(1, t));
  const cx = ax + clamped * dx;
  const cy = ay + clamped * dy;
  return Math.hypot(px - cx, py - cy);
}

function strokeWithinRadius(stroke: Stroke, point: { x: number; y: number }, radius: number): boolean {
  const pts = stroke.points;
  if (pts.length === 0) return false;
  if (pts.length === 1) {
    return Math.hypot(point.x - pts[0].x, point.y - pts[0].y) <= radius;
  }
  for (let i = 1; i < pts.length; i += 1) {
    const distance = pointToSegmentDistance(point.x, point.y, pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y);
    if (distance <= radius) return true;
  }
  return false;
}

/**
 * Id of the topmost stroke within `radius` of `point`, or null if none qualify.
 * Strokes are stored in draw order, so the last drawn stroke is on top; we walk
 * the list from the end to honor that stacking. Distance is measured to the
 * nearest point on each segment, not only to the stored vertices.
 */
export function eraseHitTest(
  strokes: Stroke[],
  point: { x: number; y: number },
  radius: number,
): string | null {
  for (let i = strokes.length - 1; i >= 0; i -= 1) {
    if (strokeWithinRadius(strokes[i], point, radius)) {
      return strokes[i].id;
    }
  }
  return null;
}
