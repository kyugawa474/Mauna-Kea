/**
 * The Today screen is driven by one number: the frost "edge" (design px from the top).
 *   900 = pulled down — the frost leaves the screen and the sun and its power rays are fully
 *         revealed (below the foot of every iPhone, glow included: the tallest is ~850 design px)
 *   430 = rest       — the frost line sits on the horizon
 *     0 = swiped up  — the frost covers everything and the macro rings are drawn
 *
 * `progress` maps the edge onto the 0…1 scroll progress the prototype used,
 * so the animation ranges from the design carry over unchanged.
 */
export const EDGE_DOWN = 900;
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

/**
 * Point on a circle around (CX, CY), angle in degrees clockwise from 12 o'clock.
 * CX/CY must be referenced in the body, not as parameter defaults: the worklets
 * compiler doesn't capture identifiers in default values, so on the UI thread
 * they'd be undefined and the throw aborts the app.
 */
export function polar(r: number, deg: number) {
  'worklet';
  const a = ((deg - 90) * Math.PI) / 180;
  return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) };
}

/** Sun radius: area-true, 1,300 kJ fills a 175px radius. */
export const sunRadius = (kj: number) => (kj > 0 ? 175 * Math.sqrt(kj / 1300) : 0);
/** Water radius mirrors the day's kJ target (rest days use a fixed 110px pool). */
export const waterRadius = (tgt: number) => (tgt > 0 ? 175 * Math.sqrt(tgt / 1300) : 110);

/** Where a pull down is decided: the old resting spot of the pulled-down frost, so it takes the same
 * drag to commit to the power rays now that the frost carries on off screen. */
const DOWN_PICK = 770;

export function snapEdge(edge: number, velocity: number) {
  'worklet';
  const projected = edge + velocity * 0.12;
  const picks = [EDGE_UP, EDGE_REST, DOWN_PICK];
  let best = picks[0];
  for (const s of picks) if (Math.abs(s - projected) < Math.abs(best - projected)) best = s;
  if (best === DOWN_PICK) best = EDGE_DOWN;
  // Never skip the rest position in one flick.
  if (Math.abs(best - edge) > EDGE_DOWN - EDGE_REST + 10 && edge > EDGE_UP && edge < EDGE_DOWN) best = EDGE_REST;
  return best;
}
