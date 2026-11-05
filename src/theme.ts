import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const C = {
  bg: '#E5E4E0',
  ink: '#111111',
  grey: '#66655F',
  grey2: '#9A9893',
  line: '#CFCEC9',
  tile: '#DAD9D4',
  orange: '#FF4F1A',
  peach: '#FFB59D',
  tickOff: '#A3A19B',
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
  return { s, width, height, navH, contentH: height - navH, insets };
}

export const caps = { fontFamily: F.mono, fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase' } as const;
