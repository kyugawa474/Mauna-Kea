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
  vec,
} from '@shopify/react-native-skia';
import { useEffect } from 'react';
import {
  Easing,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { CX, CY, polar, progress, ramp } from '@/lib/frost';
import { C } from '@/theme';

interface Props {
  edge: SharedValue<number>;
  waterR: number;
  /** Animated grams eaten / goal, per macro. */
  carbs: SharedValue<number>;
  protein: SharedValue<number>;
  fat: SharedValue<number>;
  goals: { C: number; P: number; F: number };
  s: number;
  width: number;
  height: number;
}

/**
 * The frosted film. Underneath it the water — a white, refracting pool the size of the kJ
 * target — stands for refuelling. Swiping up draws three macro goal rings over it.
 */
export function FrostCanvas({ edge, waterR, carbs, protein, fat, goals, s, width, height }: Props) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(withRepeat(withTiming(1, { duration: 8000, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [t]);
  const fx = useDerivedValue(() => 0.005 + 0.002 * t.value);
  const fy = useDerivedValue(() => 0.06 + 0.015 * t.value);

  const waterOpacity = useDerivedValue(() => 0.62 + 0.16 * ramp(progress(edge.value), 0.5, 0.62));
  const hl = useDerivedValue(() => Skia.XYWHRect(0, edge.value - 1, 390, 2));
  const glow = useDerivedValue(() => Skia.XYWHRect(0, edge.value + 1, 390, 26));
  const glowFrom = useDerivedValue(() => vec(0, edge.value + 1));
  const glowTo = useDerivedValue(() => vec(0, edge.value + 27));

  const h = height / s;

  return (
    <Canvas style={{ position: 'absolute', left: 0, top: 0, width, height }} pointerEvents="none">
      <Group transform={[{ scale: s }]}>
        <Rect x={0} y={0} width={390} height={h} color={C.frost} />
        {/* film grain */}
        <Rect x={0} y={0} width={390} height={h} opacity={0.07}>
          <FractalNoise freqX={1.15} freqY={1.15} octaves={3} seed={1} />
        </Rect>

        <Circle cx={CX} cy={CY} r={waterR} color="#FFFFFF" opacity={waterOpacity}>
          <DisplacementMap channelX="r" channelY="g" scale={22}>
            <FractalNoise freqX={fx} freqY={fy} octaves={2} seed={3} />
          </DisplacementMap>
          <Blur blur={vec(13, 12)} />
        </Circle>

        {/* waterline */}
        <Rect rect={hl} opacity={0.85}>
          <LinearGradient
            start={vec(0, 0)}
            end={vec(390, 0)}
            colors={['#FFFFFF00', '#FFFFFFF2', '#FFFFFF80', '#FFFFFF', '#FFFFFF73', '#FFFFFFE6', '#FFFFFF00']}
            positions={[0, 0.18, 0.38, 0.55, 0.74, 0.88, 1]}
          />
        </Rect>
        <Rect rect={glow}>
          <LinearGradient start={glowFrom} end={glowTo} colors={['#FFFFFF47', '#FFFFFF00']} />
        </Rect>

        <Ring value={carbs} goal={goals.C} r={104} color={C.ink} edge={edge} />
        <Ring value={protein} goal={goals.P} r={82} color={C.orange} edge={edge} />
        <Ring value={fat} goal={goals.F} r={60} color={C.peach} edge={edge} />
      </Group>
    </Canvas>
  );
}

const N = 60;

/** 60 ticks = 100% of the day's goal, clockwise from 12 o'clock, pointing inward. */
function Ring({ value, goal, r, color, edge }: { value: SharedValue<number>; goal: number; r: number; color: string; edge: SharedValue<number> }) {
  const build = (eaten: boolean) => {
    'worklet';
    const p = progress(edge.value);
    const on = Math.round(N * Math.min(1, goal > 0 ? value.value / goal : 0));
    const path = Skia.PathBuilder.Make();
    for (let i = 0; i < N; i++) {
      if (eaten !== i < on) continue;
      const a0 = 0.53 + (0.3 * i) / N;
      const f = ramp(p, a0, a0 + 0.1);
      if (f <= 0) continue;
      const L = (eaten ? 15 : 5) * f;
      const deg = (i + 0.5) * 6;
      const a = polar(r, deg);
      const b = polar(r - L, deg);
      path.moveTo(a.x, a.y);
      path.lineTo(b.x, b.y);
    }
    return path.detach();
  };
  const eaten = useDerivedValue(() => build(true));
  const left = useDerivedValue(() => build(false));
  return (
    <Group>
      <Path path={left} color={C.tickOff} style="stroke" strokeWidth={1} />
      <Path path={eaten} color={color} style="stroke" strokeWidth={1.7} />
    </Group>
  );
}
