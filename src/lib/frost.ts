/**
 * The Today screen is driven by one number: the frost "edge" (design px from the top).
 *   770 = pulled down — the sun and its power rays are fully revealed
 *   430 = rest       — the frost line sits on the horizon
 *     0 = swiped up  — the frost covers everything and the macro rings are drawn
 *
 * `progress` maps the edge onto the 0…1 scroll progress the prototype used,
 * so the animation ranges from the design carry over unchanged.
 */
export const EDGE_DOWN = 770;
export const EDGE_REST = 430;
export const EDGE_UP = 0;
export const SNAP = [EDGE_UP, EDGE_REST, EDGE_DOWN];

/** Centre of the sun / water / rings in design px. */
export const CX = 195;
export const CY = 430;

export function progress(edge: number) {
  'worklet';
  return edge >= EDGE_REST
    ? 0.5 * (EDGE_DOWN - edge) / (EDGE_DOWN - EDGE_REST)
    : 0.5 + 0.5 * (EDGE_REST - edge) / EDGE_REST;
}

/** 0 → 1 as progress moves from `a` to `b` (either direction), clamped. */
export function ramp(p: number, a: number, b: number) {
  'worklet';
  const t = (p - a) / (b - a);
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

/** Point on a circle, angle in degrees clockwise from 12 o'clock. */
export function polar(r: number, deg: number, cx = CX, cy = CY) {
  'worklet';
  const a = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

/** Sun radius: area-true, 1,300 kJ fills a 175px radius. */
export const sunRadius = (kj: number) => (kj > 0 ? 175 * Math.sqrt(kj / 1300) : 0);
/** Water radius mirrors the day's kJ target (rest days use a fixed 110px pool). */
export const waterRadius = (tgt: number) => (tgt > 0 ? 175 * Math.sqrt(tgt / 1300) : 110);

export function snapEdge(edge: number, velocity: number) {
  'worklet';
  const projected = edge + velocity * 0.12;
  let best = SNAP[0];
  for (const s of SNAP) if (Math.abs(s - projected) < Math.abs(best - projected)) best = s;
  // Never skip the rest position in one flick.
  if (Math.abs(best - edge) > EDGE_DOWN - EDGE_REST + 10 && edge > EDGE_UP && edge < EDGE_DOWN) best = EDGE_REST;
  return best;
}
