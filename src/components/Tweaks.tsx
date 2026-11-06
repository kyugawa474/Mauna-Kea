import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { themed, useTheme } from '@/state/Theme';
import { DT, F, PALETTES, PHASES, SKIES, T, type Palette, type Phase } from '@/theme';

const LABEL: Record<Phase, string> = { dawn: 'Dawn', day: 'Day', dusk: 'Dusk', night: 'Night' };
const HOURS: Record<Phase, string> = { dawn: '5–8', day: '8–17', dusk: '17–20', night: '20–5' };
/** A phase's own palette (its scheme plus overrides), for drawing its swatch. */
const paletteOf = (p: Phase) => ({ ...PALETTES[SKIES[p].scheme], ...SKIES[p].tokens });

/**
 * Design preview controls, like a tweak menu: a frosted card over the app with a segmented
 * control for the time of day. Changes apply live and the card stays open, so phases can be
 * compared in place. Long-press the Ride headline or the Training title to open it; tap outside
 * or Done to close. Rendered once in the root layout, above both tabs.
 */
export function Tweaks() {
  const { tweaksOpen, closeTweaks, override, setOverride, clockPhase, scheme, caps, C } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  if (!tweaksOpen) return null;

  const options: (Phase | null)[] = [null, ...PHASES];
  const shown = override ?? clockPhase;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Pressable style={StyleSheet.absoluteFill} onPress={closeTweaks} accessibilityLabel="Close tweaks" />
      <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(140)} style={[styles.card, { top: insets.top + 6 }]}>
        <BlurView intensity={80} tint={scheme === 'dark' ? 'systemThickMaterialDark' : 'systemThickMaterialLight'} style={StyleSheet.absoluteFill} />
        {/* A wash of the scheme's background so the screen's text doesn't show through the frost. */}
        <View style={[StyleSheet.absoluteFill, styles.wash]} />
        <View style={styles.head}>
          <Text maxFontSizeMultiplier={DT.fixed} style={caps} accessibilityRole="header">Tweaks</Text>
          <Pressable onPress={closeTweaks} hitSlop={10} accessibilityRole="button">
            <Text maxFontSizeMultiplier={DT.fixed} style={[caps, { color: C.accentText }]}>Done</Text>
          </Pressable>
        </View>

        <View style={styles.head}>
          <Text maxFontSizeMultiplier={DT.fixed} style={[caps, { color: C.grey }]}>Time of day</Text>
          <Text maxFontSizeMultiplier={DT.fixed} style={[caps, { color: C.grey }]}>Clock · {LABEL[clockPhase]}</Text>
        </View>

        <View style={styles.segments} accessibilityRole="radiogroup">
          {options.map((p) => {
            const on = p === override;
            const sky = SKIES[p ?? clockPhase];
            return (
              <Pressable
                key={p ?? 'auto'}
                onPress={() => setOverride(p)}
                style={styles.segment}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={p ? LABEL[p] : `Auto, follows the clock (${LABEL[clockPhase]} now)`}
              >
                <View style={[styles.ring, on && { borderColor: C.ink }]}>
                  <LinearGradient colors={sky.colors as [string, string, ...string[]]} locations={sky.positions as [number, number, ...number[]]} style={styles.swatch}>
                    {/* The swatch's sun, in that phase's sun colour: orange by day, white after dark. */}
                    <View style={[styles.sun, { backgroundColor: p === null ? 'transparent' : paletteOf(p).sun }]} />
                    {p === null && <Text maxFontSizeMultiplier={1} style={[styles.auto, { color: paletteOf(clockPhase).ink }]}>A</Text>}
                  </LinearGradient>
                </View>
                <Text maxFontSizeMultiplier={DT.strip} numberOfLines={1} style={[caps, styles.segLabel, { color: on ? C.ink : C.grey }]}>
                  {p ? LABEL[p] : 'Auto'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text maxFontSizeMultiplier={DT.fixed} style={styles.note}>
          {LABEL[shown]} · {HOURS[shown]}h · {SKIES[shown].scheme === 'light' ? 'light tokens, orange accent' : 'dark tokens, white accent'}
          {override ? '' : ' · following the clock'}
        </Text>
      </Animated.View>
    </View>
  );
}

const SW = 44;

const useStyles = themed((C: Palette) =>
  StyleSheet.create({
    card: {
      position: 'absolute', left: 12, right: 12, borderRadius: 26, overflow: 'hidden',
      paddingHorizontal: 18, paddingTop: 16, paddingBottom: 16, gap: 14,
      borderWidth: StyleSheet.hairlineWidth, borderColor: C.line,
      shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 24, shadowOffset: { width: 0, height: 8 },
    },
    head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
    segments: { flexDirection: 'row', justifyContent: 'space-between' },
    segment: { alignItems: 'center', gap: 8, minWidth: SW + 8 },
    ring: { padding: 3, borderRadius: (SW + 8) / 2, borderWidth: 1.5, borderColor: 'transparent' },
    swatch: { width: SW, height: SW, borderRadius: SW / 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
    sun: { width: 14, height: 14, borderRadius: 7, marginTop: 6 },
    auto: { position: 'absolute', fontFamily: F.monoMedium, fontSize: T.label },
    segLabel: { fontSize: 10, letterSpacing: 0.8 },
    note: { fontFamily: F.mono, fontSize: T.label, color: C.grey },
    wash: { backgroundColor: C.bg, opacity: 0.72 },
  }),
);
