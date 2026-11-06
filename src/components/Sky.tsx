import { Canvas, Circle, Group, LinearGradient, Rect, vec } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { StyleSheet } from 'react-native';

import { useTheme } from '@/state/Theme';
import { type Sky } from '@/theme';

/**
 * The time-of-day sky as Skia nodes, in screen points. Used on its own as a backdrop and inside
 * the frost canvas, which draws the same sky under its tint so the film reads as frosted glass.
 * It renders inside a Skia Canvas (its own React tree, out of reach of context), so `sky` is a prop.
 */
export function SkyFill({
  sky,
  width,
  height,
  stars = true,
  open = false,
  veil = false,
}: {
  sky: Sky;
  width: number;
  height: number;
  stars?: boolean;
  /** Today's open sky (dawn and dusk hold their middle colour low down). */
  open?: boolean;
  /** Training's readability wash. */
  veil?: boolean;
}) {
  const g = open && sky.open ? sky.open : sky;
  const field = useMemo(() => starField(width, height), [width, height]);
  return (
    <Group>
      <Rect x={0} y={0} width={width} height={height}>
        <LinearGradient start={vec(0, 0)} end={vec(0, height)} colors={g.colors} positions={g.positions} />
      </Rect>
      {veil && <Rect x={0} y={0} width={width} height={height} color={sky.veil} />}
      {stars && sky.stars > 0 && (
        <Group opacity={sky.stars}>
          {field.map((st, i) => (
            <Circle key={i} cx={st.x} cy={st.y} r={st.r} color="#FFFFFF" opacity={st.a} />
          ))}
        </Group>
      )}
    </Group>
  );
}

/** Full-screen sky behind a screen's content. */
export function SkyBackdrop({ width, height, open, veil }: { width: number; height: number; open?: boolean; veil?: boolean }) {
  const { sky } = useTheme();
  return (
    <Canvas style={[StyleSheet.absoluteFill, { width, height }]} pointerEvents="none">
      <SkyFill sky={sky} width={width} height={height} open={open} veil={veil} />
    </Canvas>
  );
}

/** A fixed scatter of faint stars in the upper sky (seeded, so it never jumps between renders). */
function starField(w: number, h: number) {
  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  return Array.from({ length: 46 }, () => {
    const y = Math.pow(rnd(), 1.6) * h * 0.46;
    return { x: rnd() * w, y, r: 0.5 + rnd() * 0.8, a: (0.25 + rnd() * 0.55) * (1 - y / (h * 0.5)) };
  });
}
