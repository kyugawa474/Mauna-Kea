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
}

/**
 * Base layer: the sun. Its area is the kJ burned today; pulling the frost down
 * draws 100 power rays clockwise (4 W each, 0–400 W), ray length = time spent at that power.
 */
export function SunCanvas({ day, edge, s, width, height }: Props) {
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

  const groups = useMemo(() => groupRays(day.rays ?? []), [day.rays]);
  const separators = useMemo(() => zoneSeparators(day.zoneLabels), [day.zoneLabels]);

  if (r === 0) return null;

  return (
    <Canvas style={{ position: 'absolute', left: 0, top: 0, width, height }} pointerEvents="none">
      <Group transform={[{ scale: s }]}>
        <Group clip={clip}>
          <Circle cx={CX} cy={CY} r={r} color={C.orange}>
            <DisplacementMap channelX="r" channelY="g" scale={4}>
              <FractalNoise freqX={fx} freqY={fy} octaves={2} seed={4} />
            </DisplacementMap>
            <Blur blur={0.8} />
          </Circle>
          {groups.map((g) => (
            <RayGroup key={g.color} color={g.color} ticks={g.ticks} r={r} edge={edge} />
          ))}
          {font && day.zoneLabels?.map((z) => <ZoneText key={z[0]} z={z} font={font} edge={edge} />)}
          {separators.marks.map((m) => (
            <ZoneSeparator key={m.index} index={m.index} deg={m.deg} lo={separators.lo} hi={separators.hi} edge={edge} />
          ))}
        </Group>
      </Group>
    </Canvas>
  );
}

type Tick = { i: number; L: number };

function groupRays(rays: [number, string][]) {
  const map = new Map<string, Tick[]>();
  // Colour encodes the power zone; zero-time ticks arrive pre-coloured grey (#C4C2BC).
  rays.forEach(([L, color], i) => {
    if (!map.has(color)) map.set(color, []);
    map.get(color)!.push({ i, L });
  });
  return [...map].map(([color, ticks]) => ({ color, ticks }));
}

function RayGroup({ color, ticks, r, edge }: { color: string; ticks: Tick[]; r: number; edge: SharedValue<number> }) {
  const path = useDerivedValue(() => {
    const p = progress(edge.value);
    const path = Skia.PathBuilder.Make();
    for (const { i, L } of ticks) {
      // Tick i draws while progress falls through [end - 3.5%, end].
      const end = 0.47 - 0.004 * i;
      const f = ramp(p, end, end - 0.035);
      if (f <= 0) continue;
      const a = polar(r + 9, i * 3.6);
      const b = polar(r + 9 + L * f, i * 3.6);
      path.moveTo(a.x, a.y);
      path.lineTo(b.x, b.y);
    }
    return path.detach();
  });
  return <Path path={path} color={color} style="stroke" strokeWidth={2} />;
}

/**
 * Where to draw a separator for each zone threshold (between ray `index - 1` and `index`), and the
 * radial band the labels occupy. A separator sits at the true threshold unless that would cut into
 * a label; then it moves to the middle of the gap between the two labels.
 */
function zoneSeparators(labels: ZoneLabel[] | undefined) {
  if (!labels?.length) return { marks: [] as { index: number; deg: number }[], lo: 0, hi: 0 };
  const arcs = labels.map(([, , a1, a2]) => [Math.min(a1, a2), Math.max(a1, a2)]).sort((a, b) => a[0] - b[0]);
  const gaps = arcs.slice(1).map((arc, k) => [arcs[k][1], arc[0]]);
  const marks = ZONE_STARTS.map((index) => {
    const deg = (index - 0.5) * 3.6;
    const gap = gaps.reduce((best, g) => {
      const d = (x: number[]) => (deg < x[0] ? x[0] - deg : deg > x[1] ? deg - x[1] : 0);
      return d(g) < d(best) ? g : best;
    }, gaps[0]);
    const inside = deg >= gap[0] + 1 && deg <= gap[1] - 1;
    return { index, deg: inside ? deg : (gap[0] + gap[1]) / 2 };
  });
  // Labels read along their baseline at radius R, glyphs reaching ~7px inward or outward.
  const radii = labels.map(([, R]) => R);
  return { marks, lo: Math.min(...radii) - 3, hi: Math.max(...radii) + 2 };
}

/** A short radial tick across the label band. It fades in with the labels, after the rays under it draw. */
function ZoneSeparator({ index, deg, lo, hi, edge }: { index: number; deg: number; lo: number; hi: number; edge: SharedValue<number> }) {
  const path = useMemo(() => {
    const a = polar(lo, deg);
    const b = polar(hi, deg);
    const p = Skia.PathBuilder.Make();
    p.moveTo(a.x, a.y);
    p.lineTo(b.x, b.y);
    return p.detach();
  }, [deg, lo, hi]);
  const opacity = useDerivedValue(() => {
    const end = 0.47 - 0.004 * index - 0.035;
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
