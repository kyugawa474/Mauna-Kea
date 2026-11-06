import {
  Blur,
  Canvas,
  Circle,
  DisplacementMap,
  FractalNoise,
  Group,
  Path,
  Skia,
  TextPath,
  useFont,
  vec,
  type SkFont,
} from '@shopify/react-native-skia';
import { useEffect, useMemo } from 'react';
import {
  Easing,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { ZONE_STARTS, type Day, type ZoneLabel } from '@/data/sample';
import { CX, CY, polar, progress, ramp, sunRadius } from '@/lib/frost';
import { C } from '@/theme';

interface Props {
  day: Day;
  edge: SharedValue<number>;
  s: number;
  width: number;
  height: number;
  /** Bottom of the Ride headline (design px), measured on screen; the pulled-down sun stays below it. */
  headBottom: number;
}

/**
 * Base layer: the sun. Its area is the kJ burned today; pulling the frost down
 * draws power rays clockwise (2 W each, 0–400 W; Z5 at 6 W), ray length = time spent at that power.
 */
export function SunCanvas({ day, edge, s, width, height, headBottom }: Props) {
  const r = sunRadius(day.kj);
  const font = useFont(require('@expo-google-fonts/ibm-plex-mono/400Regular/IBMPlexMono_400Regular.ttf'), 10.5);

  // Slow heat-haze on the disc.
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(withRepeat(withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [t]);
  const fx = useDerivedValue(() => 0.018 + 0.006 * t.value);
  const fy = useDerivedValue(() => 0.06 + 0.02 * t.value);

  // The sun is cut where the frost begins.
  const clip = useDerivedValue(() => Skia.XYWHRect(0, 0, 390, Math.max(0, edge.value)));

  const scale = useMemo(() => buildScale(day.rays ?? []), [day.rays]);
  const groups = useMemo(() => groupTicks(scale.ticks), [scale]);
  const labels = useMemo(() => (font ? zoneLabels(scale.n, day.zoneLabels, font) : []), [scale, day.zoneLabels, font]);
  const separators = useMemo(() => zoneSeparators(scale.n, labels), [scale, labels]);

  // A long ride's sun is big (1,300 kJ fills 350 of the 390 px frame), so once its rays are out they
  // would run off the sides and up into the headline. Pulling down zooms the drawing just enough to
  // fit; at rest the sun stays area-true. Ordinary days already fit, so they don't zoom.
  const fit = useMemo(() => fitScale(scale.ticks, r, headBottom + 8), [scale, r, headBottom]);
  const zoom = useDerivedValue(() => [{ scale: 1 + (fit - 1) * ramp(progress(edge.value), 0.5, 0.15) }]);

  // A day with a goal but no riding yet (a planned day, or today before the ride) shows the goal as
  // a white outline the size the sun will reach at that many kJ.
  const goalR = day.kj === 0 ? sunRadius(day.tgt) : 0;
  if (r === 0 && goalR === 0) return null;

  return (
    <Canvas style={{ position: 'absolute', left: 0, top: 0, width, height }} pointerEvents="none">
      <Group transform={[{ scale: s }]}>
        <Group clip={clip}>
          {goalR > 0 && <Circle cx={CX} cy={CY} r={goalR} color={C.white} style="stroke" strokeWidth={2} />}
          {r > 0 && (
            <Group origin={vec(CX, CY)} transform={zoom}>
              <Circle cx={CX} cy={CY} r={r} color={C.orange}>
                <DisplacementMap channelX="r" channelY="g" scale={4}>
                  <FractalNoise freqX={fx} freqY={fy} octaves={2} seed={4} />
                </DisplacementMap>
                <Blur blur={0.8} />
              </Circle>
              {groups.map((g) => (
                <RayGroup key={g.color} color={g.color} ticks={g.ticks} r={r} edge={edge} />
              ))}
              {font && labels.map((z) => <ZoneText key={z[0]} z={z} font={font} edge={edge} />)}
              {separators.marks.map((m) => (
                <ZoneSeparator key={m.deg} deg={m.deg} lo={separators.lo} hi={separators.hi} edge={edge} />
              ))}
            </Group>
          )}
        </Group>
      </Group>
    </Canvas>
  );
}

type Tick = { deg: number; L: number; color: string };

const GREY = '#C4C2BC'; // zero-time ticks arrive pre-coloured grey at a floor length
/** Each 4 W data step is drawn as this many rays (2 W each). */
const SPLIT = 2;
/** Zone thresholds on the 2 W scale. */
const STARTS = ZONE_STARTS.map((i) => i * SPLIT);
const Z5 = STARTS[STARTS.length - 1];
/** Z5 rays are merged three at a time (6 W each) so its thin tail doesn't take a third of the sun. */
const Z5_MERGE = 3;
const ZONE_NAMES = ['RECOVERY', 'ENDURANCE', 'TEMPO', 'THRESHOLD', 'VO2+'];
/** Length of the longest ray (design px). */
const RAY_MAX = 40;
/** Where the pulled-down sun must fit (design px): side margins and the top of the ride metrics row. */
const FIT_LEFT = 8;
const FIT_RIGHT = 382;
const FIT_BOTTOM = 644;

/**
 * The largest zoom (≤ 1, about the sun's centre) that keeps every ray tip inside the frame: clear of
 * the screen sides, below `top` and above the ride metrics. Zone labels sit inside the disc, so the
 * ray tips are the outermost marks.
 */
function fitScale(ticks: Tick[], r: number, top: number) {
  let z = 1;
  for (const { deg, L } of ticks) {
    const { x, y } = polar(r + 9 + L, deg);
    if (x < CX) z = Math.min(z, (CX - FIT_LEFT) / (CX - x));
    if (x > CX) z = Math.min(z, (FIT_RIGHT - CX) / (x - CX));
    if (y < CY) z = Math.min(z, (CY - top) / (CY - y));
    if (y > CY) z = Math.min(z, (FIT_BOTTOM - CY) / (y - CY));
  }
  return Math.max(0.5, z);
}

/**
 * Split each 4 W step into two 2 W rays. Each half leans a quarter of the way toward its neighbour
 * (linear interpolation), so the outline gets smoother rather than just doubled. Zero-time (grey)
 * steps stay grey and never pull a neighbour down; colour stays with the step, so zone edges hold.
 */
function upsample(rays: [number, string][]) {
  const out: [number, string][] = [];
  const lenAt = (j: number, own: number) => (j >= 0 && j < rays.length && rays[j][1] !== GREY ? rays[j][0] : own);
  rays.forEach(([L, color], i) => {
    if (color === GREY) {
      out.push([L, color], [L, color]);
      return;
    }
    out.push([0.75 * L + 0.25 * lenAt(i - 1, L), color], [0.75 * L + 0.25 * lenAt(i + 1, L), color]);
  });
  return out;
}

/**
 * The sun's power scale. Z1–Z4 get one ray per 2 W; Z5 merges every three 2 W rays into one 6 W
 * ray whose length is their average time per step, so ray length means the same thing everywhere and
 * only the angle is compressed. Rays are spread evenly round the full circle.
 */
function buildScale(data: [number, string][]) {
  const rays = upsample(data);
  const merged: [number, string][] = rays.slice(0, Z5);
  for (let i = Z5; i < rays.length; i += Z5_MERGE) {
    const group = rays.slice(i, i + Z5_MERGE);
    const live = group.filter(([, c]) => c !== GREY);
    const avg = live.reduce((t, [L]) => t + L, 0) / group.length;
    // Grey (no-time) steps count as zero; keep the data's 2.5px floor so a sliver of time stays visible.
    merged.push(live.length ? [Math.max(avg, 2.5), live[0][1]] : [group[0][0], GREY]);
  }
  // Ray length is share of ride time: the most-used power step is always RAY_MAX long, so a four-hour
  // ride and a one-hour one draw at the same size and differ only in shape.
  const longest = Math.max(0, ...merged.filter(([, c]) => c !== GREY).map(([L]) => L));
  const k = longest > 0 ? RAY_MAX / longest : 1;
  const n = merged.length;
  const ticks: Tick[] = merged.map(([L, color], i) => ({
    deg: (i * 360) / n,
    L: color === GREY ? L : Math.max(2.5, L * k),
    color,
  }));
  return { n, ticks };
}

/** Index of the first ray of each zone (Z1..Z5) on the merged scale. */
const zoneStartsOn = () => [0, ...STARTS];

function groupTicks(ticks: Tick[]) {
  const map = new Map<string, Tick[]>();
  for (const t of ticks) {
    if (!map.has(t.color)) map.set(t.color, []);
    map.get(t.color)!.push(t);
  }
  return [...map].map(([color, list]) => ({ color, ticks: list }));
}

/**
 * Zone labels laid out from the zone thresholds on the merged scale. Labels on the lower half run
 * anticlockwise so they read upright. Radii come from the day's data (one for each half); a label
 * gets its full name when it fits the arc, otherwise just its zone number.
 */
function zoneLabels(n: number, dayLabels: ZoneLabel[] | undefined, font: SkFont): ZoneLabel[] {
  if (!dayLabels?.length) return [];
  const rTop = dayLabels.find((z) => z[4] === 1)?.[1] ?? dayLabels[0][1];
  const rBottom = dayLabels.find((z) => z[4] === 0)?.[1] ?? rTop;
  const step = 360 / n;
  const starts = zoneStartsOn();
  return starts.map((start, z) => {
    const end = z + 1 < starts.length ? starts[z + 1] : n;
    const a = start * step + 1.5;
    const b = end * step - 1.5;
    const mid = (a + b) / 2;
    const bottom = mid > 90 && mid < 270;
    const R = bottom ? rBottom : rTop;
    const full = `Z${z + 1} ${ZONE_NAMES[z]}`;
    // Same width ZoneText lays out (glyphs plus its letter spacing), with a little air at each end.
    const fits = font.measureText(full).width + full.length * 0.8 + 6 <= ((b - a) * Math.PI * R) / 180;
    const text = fits ? full : `Z${z + 1}`;
    return bottom ? [text, R, b, a, 0] : [text, R, a, b, 1];
  });
}

function RayGroup({ color, ticks, r, edge }: { color: string; ticks: Tick[]; r: number; edge: SharedValue<number> }) {
  const path = useDerivedValue(() => {
    const p = progress(edge.value);
    const path = Skia.PathBuilder.Make();
    for (const { deg, L } of ticks) {
      // Rays draw clockwise: each one while progress falls through [end - 3.5%, end].
      const end = 0.47 - 0.004 * (deg / 3.6);
      const f = ramp(p, end, end - 0.035);
      if (f <= 0) continue;
      const a = polar(r + 9, deg);
      const b = polar(r + 9 + L * f, deg);
      path.moveTo(a.x, a.y);
      path.lineTo(b.x, b.y);
    }
    return path.detach();
  });
  return <Path path={path} color={color} style="stroke" strokeWidth={2} />;
}

/**
 * Where to draw a separator for each zone threshold, and the radial band the labels occupy.
 * The labels leave a gap at each threshold, so the separator sits exactly on it.
 */
function zoneSeparators(n: number, labels: ZoneLabel[]) {
  if (!labels.length) return { marks: [] as { deg: number }[], lo: 0, hi: 0 };
  const marks = STARTS.map((index) => ({ deg: (index * 360) / n }));
  // Labels read along their baseline at radius R, glyphs reaching ~7px inward or outward.
  const radii = labels.map(([, R]) => R);
  return { marks, lo: Math.min(...radii) - 3, hi: Math.max(...radii) + 2 };
}

/** A short radial tick across the label band. It fades in with the labels, after the rays under it draw. */
function ZoneSeparator({ deg, lo, hi, edge }: { deg: number; lo: number; hi: number; edge: SharedValue<number> }) {
  const path = useMemo(() => {
    const a = polar(lo, deg);
    const b = polar(hi, deg);
    const p = Skia.PathBuilder.Make();
    p.moveTo(a.x, a.y);
    p.lineTo(b.x, b.y);
    return p.detach();
  }, [deg, lo, hi]);
  const opacity = useDerivedValue(() => {
    const end = 0.47 - 0.004 * (deg / 3.6) - 0.035;
    return ramp(progress(edge.value), end, end - 0.035) * 0.55;
  });
  return <Path path={path} color={C.ink} style="stroke" strokeWidth={1.2} strokeCap="round" opacity={opacity} />;
}

function ZoneText({ z, font, edge }: { z: ZoneLabel; font: SkFont; edge: SharedValue<number> }) {
  const [text, R, a1, a2, sweep] = z;
  const { path, offset, mid } = useMemo(() => {
    const p = Skia.PathBuilder.Make();
    const start = polar(R, a1);
    const span = sweep ? (a2 - a1 + 360) % 360 : (a1 - a2 + 360) % 360;
    // Arc in the same direction the prototype used so text reads upright.
    const rect = Skia.XYWHRect(CX - R, CY - R, R * 2, R * 2);
    p.moveTo(start.x, start.y);
    p.arcToOval(rect, a1 - 90, sweep ? span : -span, false);
    const len = (span * Math.PI * R) / 180;
    const w = font.measureText(text).width + text.length * 0.8;
    const midDeg = sweep ? a1 + span / 2 : a1 - span / 2;
    return { path: p.detach(), offset: Math.max(0, (len - w) / 2), mid: ((midDeg % 360) + 360) % 360 };
  }, [R, a1, a2, sweep, font, text]);

  // Fade in just after the rays under it have drawn.
  const opacity = useDerivedValue(() => {
    const end = 0.47 - 0.004 * (mid / 3.6) - 0.035;
    return ramp(progress(edge.value), end, end - 0.035) * 0.9;
  });
  return <TextPath path={path} text={text} font={font} initialOffset={offset} color={C.ink} opacity={opacity} />;
}
