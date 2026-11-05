import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const C = {
  bg: '#E5E4E0',
  ink: '#111111',
  grey: '#5E5D57', // ≥4.5:1 on bg, frost and tiles
  grey2: '#807E79', // outlines only (dashed/planned), ≥3:1 on bg; never text
  line: '#CFCEC9',
  tile: '#DAD9D4',
  orange: '#FF4F1A', // fills only
  orangeText: '#AD3712', // orange for text: ≥4.5:1 on bg and frost
  peach: '#D06C49', // fat; ≥3:1 on the water pool where the rings sit
  tickOff: '#8D8B85', // empty ring ticks; ≥3:1 on the water pool
  frost: '#CDDEE0', // rgba(172,214,224,.42) over bg
  frostInk: '#4E5E63',
  white: '#FFFFFF',
} as const;

export const F = {
  thin: 'InterTight_200ExtraLight',
  light: 'InterTight_300Light',
  medium: 'InterTight_500Medium',
  semibold: 'InterTight_600SemiBold',
  mono: 'IBMPlexMono_400Regular',
  monoMedium: 'IBMPlexMono_500Medium',
} as const;

/** The design was drawn on a 390 × 844 frame with an 84px nav bar. */
export const DESIGN_W = 390;
export const NAV_H = 84;

/** Positions in the design are in "design px"; multiply by `s` to get points on this device. */
export function useLayout() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const s = width / DESIGN_W;
  const navH = 60 + Math.max(insets.bottom, 12);
  // Past ~1.35× text, rows of three tiles stack vertically instead of squeezing.
  const { fontScale } = useWindowDimensions();
  return { s, width, height, navH, contentH: height - navH, insets, stackTiles: fontScale > 1.35 };
}

/** The type scale. Every font size in the app is one of these. */
export const T = {
  label: 11, // mono caps labels, units, notes
  body: 16, // names and short text
  mid: 26, // secondary numbers, panel titles
  head: 40, // screen titles, the fuel number at rest
  display: 56, // the day's hero number
} as const;

/**
 * Dynamic Type caps (maxFontSizeMultiplier). Text always scales with the user's setting;
 * fixed compositions (Today's sun and frost, the week strip, the tab bar) cap it so the
 * layout holds, while lists (Training, the food log) scale much further.
 */
export const DT = { fixed: 1.3, strip: 1.2, list: 2 } as const;

export const caps = { fontFamily: F.mono, fontSize: T.label, letterSpacing: 1.2, textTransform: 'uppercase' } as const;
