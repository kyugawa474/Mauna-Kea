import { PixelRatio, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Colour tokens. Both schemes share the same names; `useTheme()` (src/state/Theme.tsx) picks one
 * from the time of day and applies the phase's overrides (SKIES[phase].tokens). The ratios noted
 * here are for the scheme's plain background; on the skies, the phase overrides keep AA.
 */
const LIGHT = {
  bg: '#E5E4E0', // solid fallback; screens draw the sky gradient over it
  ink: '#111111',
  grey: '#5E5D57', // ≥4.5:1 on bg, frost and tiles
  grey2: '#807E79', // outlines only (dashed/planned), ≥3:1 on bg; never text
  line: '#CFCEC9',
  tile: 'rgba(17,17,17,0.05)', // translucent so the sky shows through
  orange: '#FF4F1A', // fills only
  orangeText: '#AD3712', // orange for text: ≥4.5:1 on bg and frost
  peach: '#D06C49', // fat; ≥3:1 on the water pool where the rings sit
  tickOff: '#8D8B85', // empty ring ticks; ≥3:1 on the water pool
  frost: 'rgba(172,214,224,0.42)', // the film's tint over the sky (each phase sets its own)
  frostInk: '#4E5E63',
  white: '#FFFFFF',
  /** What sits on an ink fill (selected meal, + buttons). */
  paper: '#FFFFFF',
  /** Text and marks on the orange sun or an orange tile: dark in both schemes. */
  onOrange: '#111111',
  /** The water pool once it clears of the sun's reflection (the rings draw on it). */
  pool: '#FFFFFF',
  /** Waterline glint and its strength. */
  glint: '#FFFFFF',
  glintK: 1,
  /** Zero-time power ticks (the data marks them with a grey sentinel). */
  tickZero: '#C4C2BC',
  /** Z5 as drawn on the background (the data's dark rust disappears on a night sky). */
  zone5: '#7E260A',
  /** The third ride metric's rule (intensity). */
  metricBar: '#A9A8A3',
  /** Rest-day dot in the consistency grid. */
  dotRest: '#B8B6B0',
  /** Weekly bars: stripes on a past (ink) bar, the current week's wash, future weeks' wash. */
  barStripe: '#3B3A37',
  orangeWash: 'rgba(255,79,26,0.18)',
  inkWash: 'rgba(17,17,17,0.10)',
};

export type Palette = typeof LIGHT;

const DARK: Palette = {
  bg: '#0F131B',
  ink: '#EEEBE4',
  grey: '#A9ADB4', // ≥4.5:1 on the night sky, frost and tiles
  grey2: '#767B84',
  line: '#2A303A',
  tile: 'rgba(238,235,228,0.06)',
  orange: '#FF4F1A', // the sun stays the same orange
  orangeText: '#FF8A63', // lighter for text on dark
  peach: '#E58A66',
  tickOff: '#8A94A2', // ≥3:1 on the night pool
  frost: 'rgba(120,160,200,0.12)',
  frostInk: '#AEBDC6',
  white: '#FFFFFF',
  paper: '#111111',
  onOrange: '#111111',
  pool: '#34485E', // moonlit water: lighter than the frost, dark enough for light rings
  glint: '#BFD4E8',
  glintK: 0.55,
  tickZero: '#4A505A',
  zone5: '#E0532A',
  metricBar: '#5D626B',
  dotRest: '#4A505A',
  barStripe: '#C9C6BF',
  orangeWash: 'rgba(255,79,26,0.30)',
  inkWash: 'rgba(238,235,228,0.12)',
};

export const PALETTES = { light: LIGHT, dark: DARK } as const;
export type Scheme = keyof typeof PALETTES;

/**
 * Time-of-day skies, from the Dawn / Day / Dusk / Evening reference gradients (three stops each:
 * top, middle, the warm low light). Each runs top to bottom over the whole screen.
 *
 * - `colors`: the full gradient. The frost (Today's water half) and Training use it, so the warm
 *   low light shows through the film like a reflection.
 * - `open`: Today's open sky above the waterline, where dawn and dusk hold their middle colour to
 *   the bottom instead of the bright orange/peach, so the pulled-down ride stats stay ≥4.5:1.
 * - `frost`: the film tint over the sky (dark phases darken it, day lightens it).
 * - `veil`: a wash over Training's sky so text reads at every scroll position.
 * - `tokens`: per-phase overrides on the scheme's palette (the blended middles).
 *
 * The reference stops were deepened where small text needed it (dawn's #008ED9 → #0277BA). The
 * contrast check (every text token against the sky at the y-ranges where text sits) is in the PR.
 */
export type Phase = 'dawn' | 'day' | 'dusk' | 'night';
export const PHASES: Phase[] = ['dawn', 'day', 'dusk', 'night'];
type Gradient = { colors: string[]; positions: number[] };
export type Sky = Gradient & {
  scheme: Scheme;
  open?: Gradient;
  frost: string;
  veil: string;
  tokens: Partial<Palette>;
  /** Opacity of the orange halo round the sun after dark. */
  sunGlow: number;
  /** Opacity of the star field in the upper sky. */
  stars: number;
};
export const SKIES: Record<Phase, Sky> = {
  dawn: {
    scheme: 'dark',
    colors: ['#163241', '#0277BA', '#F2B98A'],
    positions: [0, 0.55, 1],
    open: { colors: ['#163241', '#0277BA', '#0A3F62'], positions: [0, 0.55, 1] },
    frost: 'rgba(6,22,34,0.55)',
    veil: 'rgba(10,30,44,0.68)',
    tokens: { grey: '#D3DEE6', grey2: '#9AB0BF', orangeText: '#FFC4A6', frostInk: '#C4D6E0', tickOff: '#9AAAB8', zone5: '#FF9E70' },
    sunGlow: 0.3,
    stars: 0.2,
  },
  day: {
    scheme: 'light',
    colors: ['#79C1E5', '#C8D3EF', '#FFD990'],
    positions: [0, 0.5, 1],
    frost: 'rgba(255,255,255,0.35)',
    veil: 'rgba(255,255,255,0.25)',
    tokens: { grey: '#3D4650', grey2: '#5F6872', orangeText: '#7F2508', frostInk: '#36464D' },
    sunGlow: 0,
    stars: 0,
  },
  dusk: {
    scheme: 'dark',
    colors: ['#271F2F', '#865AB4', '#E4631D'],
    positions: [0, 0.5, 1],
    open: { colors: ['#271F2F', '#865AB4', '#3E2C55'], positions: [0, 0.5, 1] },
    frost: 'rgba(24,16,34,0.5)',
    veil: 'rgba(30,22,40,0.55)',
    tokens: { ink: '#FFFFFF', grey: '#D5CCE0', grey2: '#A796BB', orangeText: '#FFB896', frostInk: '#D8CCE4', zone5: '#FF9E70' },
    sunGlow: 0.35,
    stars: 0.35,
  },
  night: {
    scheme: 'dark',
    colors: ['#111111', '#271F2F', '#452E30'],
    positions: [0, 0.5, 1],
    frost: 'rgba(120,160,200,0.10)',
    veil: 'rgba(0,0,0,0)',
    tokens: { grey2: '#7C818A' },
    sunGlow: 0.5,
    stars: 1,
  },
};

/** Local hour → phase: dawn 5–8, day 8–17, dusk 17–20, night 20–5. */
export function phaseAt(date: Date): Phase {
  const h = date.getHours() + date.getMinutes() / 60;
  if (h >= 5 && h < 8) return 'dawn';
  if (h >= 8 && h < 17) return 'day';
  if (h >= 17 && h < 20) return 'dusk';
  return 'night';
}

/** `#RRGGBB` plus an alpha 0–1 → `#RRGGBBAA` (for Skia gradients). */
export const withAlpha = (hex: string, a: number) =>
  hex + Math.round(Math.max(0, Math.min(1, a)) * 255).toString(16).padStart(2, '0').toUpperCase();

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
/** Height of the floating Liquid Glass tab bar capsule (iOS 26+), above the bottom inset. */
const BAR_H = 62;

/** Positions in the design are in "design px"; multiply by `s` to get points on this device. */
export function useLayout() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const s = width / DESIGN_W;
  // The system tab bar floats over the content and can't be measured (Expo Router native tabs),
  // so `navH` is how much of the screen's foot it covers: its 62pt capsule plus the gap below it
  // (the home-indicator inset less 12pt; 84pt on an iPhone 18 Pro, measured in the Simulator).
  // Screens draw under it to the bottom edge (`height`) and keep content above `contentH`.
  const navH = BAR_H + Math.max(insets.bottom - 12, 12);
  // Past ~1.35× text, rows of three tiles stack vertically instead of squeezing.
  const { fontScale } = useWindowDimensions();
  // Screen headers start a comfortable gap below the status bar (the design's 56 was tighter than
  // the Dynamic Island's inset on current iPhones).
  const headerTop = Math.round(Math.max(56 * s, insets.top + 14));
  return { s, width, height, navH, contentH: height - navH, insets, headerTop, stackTiles: fontScale > 1.35 };
}

/** Round a size to whole device pixels so circles and rings stay centred on 2× and 3× screens. */
export const px = (n: number) => PixelRatio.roundToNearestPixel(n);

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

/** Mono caps labels. Colourless here; `useTheme().caps` adds the scheme's ink. */
export const capsBase = { fontFamily: F.mono, fontSize: T.label, letterSpacing: 1.2, textTransform: 'uppercase' } as const;
