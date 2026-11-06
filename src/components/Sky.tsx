import { Canvas, Group, LinearGradient, Rect, vec } from '@shopify/react-native-skia';
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
  open = false,
  veil = false,
}: {
  sky: Sky;
  width: number;
  height: number;
  /** Today's open sky (dawn and dusk hold their middle colour low down). */
  open?: boolean;
  /** Training's readability wash. */
  veil?: boolean;
}) {
  const g = open && sky.open ? sky.open : sky;
  return (
    <Group>
      <Rect x={0} y={0} width={width} height={height}>
        <LinearGradient start={vec(0, 0)} end={vec(0, height)} colors={g.colors} positions={g.positions} />
      </Rect>
      {veil && <Rect x={0} y={0} width={width} height={height} color={sky.veil} />}
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
