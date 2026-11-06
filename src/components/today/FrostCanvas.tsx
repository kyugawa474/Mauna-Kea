import {
  Blur,
  Canvas,
  Circle,
  DisplacementMap,
  FractalNoise,
  Group,
  LinearGradient,
  Path,
  Rect,
  Skia,
  Text,
  useFont,
  vec,
  type SkFont,
} from '@shopify/react-native-skia';
import { useEffect } from 'react';
import {
  Easing,
  interpolateColor,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { CX, CY, polar, progress, ramp } from '@/lib/frost';
import { SkyFill } from '@/components/Sky';
import { useTheme } from '@/state/Theme';
import { withAlpha } from '@/theme';

interface Props {
  edge: SharedValue<number>;
  waterR: number;
  /** Animated grams eaten / goal, per macro. */
  carbs: SharedValue<number>;
  protein: SharedValue<number>;
  fat: SharedValue<number>;
  goals: { C: number; P: number; F: number };
  /** Horizontal day-swipe offset (pt). The water and rings travel with it; the frost film stays put. */
  dx: SharedValue<number>;
  s: number;
  width: number;
  height: number;
}

/**
 * The frosted film. Underneath it the water — a white, refracting pool the size of the kJ
 * target — stands for refuelling. Swiping up draws three macro goal rings over it.
 */
export function FrostCanvas({ edge, waterR, carbs, protein, fat, goals, dx, s, width, height }: Props) {
  const { C, sky } = useTheme();
  const { orange, pool, glint, glintK } = C;
  const line = [0, 0.95, 0.5, 1, 0.45, 0.9, 0].map((a) => withAlpha(glint, a * glintK));
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(withRepeat(withTiming(1, { duration: 8000, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [t]);
  const fx = useDerivedValue(() => 0.005 + 0.002 * t.value);
  const fy = useDerivedValue(() => 0.06 + 0.015 * t.value);

  const waterOpacity = useDerivedValue(() => 0.62 + 0.16 * ramp(progress(edge.value), 0.5, 0.62));
  // The pool reflects the sun in orange at rest and when pulled down, and clears to white as the
  // frost rises, finishing just before the macro rings start drawing (they need the white to read).
  const waterColor = useDerivedValue(() =>
    interpolateColor(ramp(progress(edge.value), 0.5, 0.56), [0, 1], [orange, pool]),
  );
  const hl = useDerivedValue(() => Skia.XYWHRect(0, edge.value - 1, 390, 2));
  const glow = useDerivedValue(() => Skia.XYWHRect(0, edge.value + 1, 390, 26));
  const glowFrom = useDerivedValue(() => vec(0, edge.value + 1));
  const glowTo = useDerivedValue(() => vec(0, edge.value + 27));

  const h = height / s;
  const shift = useDerivedValue(() => [{ translateX: dx.value / s }]);
  const font = useFont(require('@expo-google-fonts/ibm-plex-mono/500Medium/IBMPlexMono_500Medium.ttf'), 11);

  return (
    <Canvas style={{ position: 'absolute', left: 0, top: 0, width, height }} pointerEvents="none">
      {/* The same sky as the backdrop, seen through the frost tint. */}
      <SkyFill sky={sky} width={width} height={height} stars={false} />
      <Group transform={[{ scale: s }]}>
        <Rect x={0} y={0} width={390} height={h} color={C.frost} />
        {/* film grain */}
        <Rect x={0} y={0} width={390} height={h} opacity={0.07}>
          <FractalNoise freqX={1.15} freqY={1.15} octaves={3} seed={1} />
        </Rect>

        <Group transform={shift}>
          <Circle cx={CX} cy={CY} r={waterR} color={waterColor} opacity={waterOpacity}>
            <DisplacementMap channelX="r" channelY="g" scale={22}>
              <FractalNoise freqX={fx} freqY={fy} octaves={2} seed={3} />
            </DisplacementMap>
            <Blur blur={vec(13, 12)} />
          </Circle>
        </Group>

        {/* waterline */}
        <Rect rect={hl} opacity={0.85}>
          <LinearGradient
            start={vec(0, 0)}
            end={vec(390, 0)}
            colors={line}
            positions={[0, 0.18, 0.38, 0.55, 0.74, 0.88, 1]}
          />
        </Rect>
        <Rect rect={glow}>
          <LinearGradient start={glowFrom} end={glowTo} colors={[withAlpha(glint, 0.28 * glintK), withAlpha(glint, 0)]} />
        </Rect>

        <Group transform={shift}>
          <Ring label="Carbs" value={carbs} goal={goals.C} r={RING_R[0]} color={C.ink} edge={edge} font={font} ink={C.ink} off={C.tickOff} />
          <Ring label="Protein" value={protein} goal={goals.P} r={RING_R[1]} color={C.orange} edge={edge} font={font} ink={C.ink} off={C.tickOff} />
          <Ring label="Fat" value={fat} goal={goals.F} r={RING_R[2]} color={C.peach} edge={edge} font={font} ink={C.ink} off={C.tickOff} />
        </Group>
      </Group>
    </Canvas>
  );
}

const N = 60;
/** Outer radius of each ring (design px), outside in: carbs, protein, fat. */
const RING_R = [142, 114, 86];
/** Rings sweep three quarters of a turn, 12 o'clock clockwise to 9; the open quarter holds the labels. */
const SWEEP = 270;
const TICK = { eaten: 19, left: 6 };

/**
 * 60 ticks = 100% of the day's goal, clockwise from 12 o'clock over a 3/4 turn, pointing inward.
 * The label sits in the open quarter, right-aligned just left of 12 o'clock on the ring's track.
 */
function Ring({
  label,
  value,
  goal,
  r,
  color,
  edge,
  font,
  ink,
  off,
}: {
  label: string;
  value: SharedValue<number>;
  goal: number;
  r: number;
  color: string;
  edge: SharedValue<number>;
  font: SkFont | null;
  ink: string;
  off: string;
}) {
  // `edge.value` and `value.value` must be read in the useDerivedValue worklets themselves:
  // Reanimated only subscribes to shared values referenced there, not inside helpers they call.
  const build = (p: number, grams: number, eaten: boolean) => {
    'worklet';
    const on = Math.round(N * Math.min(1, goal > 0 ? grams / goal : 0));
    const path = Skia.PathBuilder.Make();
    for (let i = 0; i < N; i++) {
      if (eaten !== i < on) continue;
      const a0 = 0.53 + (0.3 * i) / N;
      const f = ramp(p, a0, a0 + 0.1);
      if (f <= 0) continue;
      const L = (eaten ? TICK.eaten : TICK.left) * f;
      const deg = ((i + 0.5) * SWEEP) / N;
      const a = polar(r, deg);
      const b = polar(r - L, deg);
      path.moveTo(a.x, a.y);
      path.lineTo(b.x, b.y);
    }
    return path.detach();
  };
  const eaten = useDerivedValue(() => build(progress(edge.value), value.value, true));
  const left = useDerivedValue(() => build(progress(edge.value), value.value, false));
  // The label fades in as its ring starts to draw.
  const labelOpacity = useDerivedValue(() => ramp(progress(edge.value), 0.53, 0.6));
  const text = label.toUpperCase();
  const textW = font ? font.measureText(text).width : 0;
  return (
    <Group>
      <Path path={left} color={off} style="stroke" strokeWidth={1.2} />
      <Path path={eaten} color={color} style="stroke" strokeWidth={2.2} />
      {font && (
        <Group opacity={labelOpacity}>
          <Text x={CX - 8 - textW} y={CY - r + TICK.eaten / 2 + 4} text={text} font={font} color={ink} />
        </Group>
      )}
    </Group>
  );
}
