import * as Haptics from 'expo-haptics';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Appearance } from 'react-native';

import { PALETTES, PHASES, SKIES, capsBase, phaseAt, type Palette, type Phase, type Scheme } from '@/theme';

interface Theme {
  /** The palette for the current phase (the scheme's tokens, the phase's overrides and frost tint). */
  C: Palette;
  scheme: Scheme;
  phase: Phase;
  sky: (typeof SKIES)[Phase];
  /** Mono caps label style in the scheme's ink. */
  caps: typeof capsBase & { color: string };
  /** A phase forced for preview, or null when following the clock. */
  override: Phase | null;
  /** Preview: clock → dawn → day → dusk → night → clock. */
  cyclePhase: () => void;
}

const Ctx = createContext<Theme | null>(null);

/**
 * Picks the palette from the local time of day and re-checks every minute. Long-pressing the
 * Ride headline (Today) or the Training title steps through the phases for preview.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [clockPhase, setClockPhase] = useState<Phase>(() => phaseAt(new Date()));
  const [override, setOverride] = useState<Phase | null>(null);

  useEffect(() => {
    const id = setInterval(() => setClockPhase(phaseAt(new Date())), 60_000);
    return () => clearInterval(id);
  }, []);

  const phase = override ?? clockPhase;
  const sky = SKIES[phase];
  const scheme = sky.scheme;

  // The system chrome (Liquid Glass tab bar, status bar, keyboard) follows the app's scheme.
  useEffect(() => {
    Appearance.setColorScheme(scheme);
  }, [scheme]);

  const cyclePhase = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setOverride((o) => {
      if (o === null) return PHASES[0];
      const i = PHASES.indexOf(o);
      return i === PHASES.length - 1 ? null : PHASES[i + 1];
    });
  }, []);

  const value = useMemo<Theme>(() => {
    const C = { ...PALETTES[scheme], ...sky.tokens, frost: sky.frost };
    return { C, scheme, phase, sky, caps: { ...capsBase, color: C.ink }, override, cyclePhase };
  }, [scheme, sky, phase, override, cyclePhase]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const t = useContext(Ctx);
  if (!t) throw new Error('useTheme outside ThemeProvider');
  return t;
}

/**
 * Turns a style factory into a hook: `const useStyles = themed((C) => StyleSheet.create({...}))`.
 * Each palette's sheet is built once and cached.
 */
export function themed<T>(factory: (C: Palette) => T) {
  const cache = new WeakMap<Palette, T>();
  return function useThemedStyles(): T {
    const { C } = useTheme();
    let s = cache.get(C);
    if (!s) {
      s = factory(C);
      cache.set(C, s);
    }
    return s;
  };
}
