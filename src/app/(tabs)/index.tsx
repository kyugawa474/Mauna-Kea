import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { scheduleOnRN } from 'react-native-worklets';

import { FrostCanvas } from '@/components/today/FrostCanvas';
import { SunCanvas } from '@/components/today/SunCanvas';
import { WeekStrip } from '@/components/today/WeekStrip';
import { DAYS, TODAY_INDEX, WEEK, type DayVariant } from '@/data/sample';
import { CX, CY, EDGE_DOWN, EDGE_REST, EDGE_UP, progress, ramp, snapEdge, sunRadius, waterRadius } from '@/lib/frost';
import { fmt, useTween } from '@/lib/useTween';
import { useApp } from '@/state/AppState';
import { C, DT, F, caps, useLayout, T } from '@/theme';

/** The tap region sits between the ride/eat headline and the bottom metrics (design px). */
const TAP_TOP = 250;
const TAP_BOTTOM = 640;

/** At rest the fuel headline sits at the foot of the frost, mirroring the ride headline at the top (design px). */
const FUEL_REST = 590;
/** The ride headline's spot; swiping up carries the fuel headline here. */
const HEAD_Y = 133;
/** Where the macro (and ride metric) row sits once revealed. */
const ROW_Y = 654;

/** The gesture hint shows until the first vertical drag (per app session; nothing is persisted yet). */
let hintDismissed = false;

export default function TodayScreen() {
  const { s, width, contentH, headerTop } = useLayout();
  const { dayIndex, setDayIndex, variant, cycleThuPhase, totals } = useApp();
  const day = DAYS[variant];

  // ── the frost edge (design px) and the horizontal day-swipe offset (pt) ──
  const edge = useSharedValue(EDGE_REST);
  const start = useSharedValue(EDGE_REST);
  const dx = useSharedValue(0);
  const axis = useSharedValue<0 | 1 | 2>(0); // 0 undecided, 1 vertical, 2 horizontal

  // ── gesture hint: a caption on the waterline, plus one small dip of the frost on first view ──
  const [showHint, setShowHint] = useState(!hintDismissed);
  const dismissHint = () => {
    hintDismissed = true;
    setShowHint(false);
  };
  useEffect(() => {
    if (hintDismissed) return;
    edge.set(
      withDelay(
        900,
        withSequence(
          withTiming(EDGE_REST + 34, { duration: 420, easing: Easing.out(Easing.cubic) }),
          withSpring(EDGE_REST, { damping: 14, stiffness: 160 }),
        ),
      ),
    );
  }, [edge]);

  const changeDay = (dir: number) => {
    setDayIndex(dayIndex + dir);
    Haptics.selectionAsync();
  };

  // Where the frost last settled (rest, pulled down or swiped up); VoiceOver reads it as the value.
  // Declared before the gesture: its worklets capture these when they are created.
  const [mode, setMode] = useState<number>(EDGE_REST);
  const modeRef = useRef<number>(EDGE_REST);
  const onSnap = (to: number) => {
    // A light tap when the frost settles into a new position.
    if (to !== modeRef.current) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    modeRef.current = to;
    setMode(to);
  };

  const pan = usePanGesture({
    minDistance: 8,
    onActivate: (e) => {
      'worklet';
      axis.value = Math.abs(e.translationX) > Math.abs(e.translationY) ? 2 : 1;
      start.value = edge.value;
      if (axis.value === 1) scheduleOnRN(dismissHint);
    },
    onUpdate: (e) => {
      'worklet';
      if (axis.value === 1) {
        edge.set(Math.max(EDGE_UP, Math.min(EDGE_DOWN, start.value + e.translationY / s)));
      } else if (axis.value === 2) {
        const atEnd = (e.translationX > 0 && dayIndex === 0) || (e.translationX < 0 && dayIndex === 6);
        dx.value = atEnd ? e.translationX * 0.25 : e.translationX;
      }
    },
    onDeactivate: (e) => {
      'worklet';
      if (axis.value === 1) {
        const to = snapEdge(edge.value, e.velocityY / s);
        edge.set(withSpring(to, { damping: 22, stiffness: 180, mass: 0.9 }));
        scheduleOnRN(onSnap, to);
      } else if (axis.value === 2) {
        const dir = e.translationX + e.velocityX * 0.15 < -width * 0.25 ? 1 : e.translationX + e.velocityX * 0.15 > width * 0.25 ? -1 : 0;
        const ok = dir !== 0 && dayIndex + dir >= 0 && dayIndex + dir <= 6;
        if (ok) {
          dx.value = withTiming(-dir * width, { duration: 180, easing: Easing.in(Easing.quad) }, (done) => {
            'worklet';
            if (!done) return;
            scheduleOnRN(changeDay, dir);
            dx.value = dir * width;
            dx.value = withTiming(0, { duration: 320, easing: Easing.out(Easing.cubic) });
          });
        } else {
          dx.value = withSpring(0, { damping: 20, stiffness: 200 });
        }
      }
      axis.value = 0;
    },
  });

  // ── VoiceOver: the frost is one adjustable element; swipe up shows fuel, swipe down shows power ──
  const goTo = (to: number) => {
    onSnap(to);
    if (to !== EDGE_REST) dismissHint();
    edge.set(withSpring(to, { damping: 22, stiffness: 180, mass: 0.9 }));
  };
  const modeLabel = mode === EDGE_DOWN ? 'power rays shown' : mode === EDGE_UP ? 'macro rings shown' : 'at rest';
  const a11ySummary =
    `Ride ${fmt(day.kj)} kilojoules` +
    (day.tgt > 0 ? ` of a ${fmt(day.tgt)} target` : ', rest day') +
    `. Fuel ${fmt(totals.left)} kcal left of ${fmt(day.of)}.`;

  // ── macro grams animate when food is committed from the + panel ──
  const gC = useSharedValue(totals.gC);
  const gP = useSharedValue(totals.gP);
  const gF = useSharedValue(totals.gF);
  useEffect(() => {
    const t = { duration: 1100, easing: Easing.out(Easing.cubic) };
    gC.set(withDelay(350, withTiming(totals.gC, t)));
    gP.set(withDelay(350, withTiming(totals.gP, t)));
    gF.set(withDelay(350, withTiming(totals.gF, t)));
  }, [totals.gC, totals.gP, totals.gF, gC, gP, gF]);
  useEffect(() => {
    gC.set(totals.gC);
    gP.set(totals.gP);
    gF.set(totals.gF);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant]);

  const left = useTween(totals.left, variant);
  const sP = useTween(totals.gP, variant);
  const sC = useTween(totals.gC, variant);
  const sF = useTween(totals.gF, variant);
  const live = Math.round(left) !== totals.left;

  // ── animated styles ──
  const page = useAnimatedStyle(() => ({ transform: [{ translateX: dx.value }] }));
  const filmBox = useAnimatedStyle(() => ({ top: edge.value * s }));
  const filmInner = useAnimatedStyle(() => ({ top: -edge.value * s }));
  const rideOut = useAnimatedStyle(() => ({ opacity: 1 - ramp(progress(edge.value), 0.5, 0.85) }));
  const hdrOut = useAnimatedStyle(() => ({ opacity: 1 - ramp(progress(edge.value), 0.8, 0.96) }));
  const metricsOut = useAnimatedStyle(() => ({ opacity: 1 - ramp(progress(edge.value), 0, 0.3) }));
  // The hint rides the waterline and fades as soon as the frost leaves rest.
  const hintStyle = useAnimatedStyle(() => ({
    top: (edge.value + 14) * s,
    opacity: 1 - Math.min(1, Math.abs(edge.value - EDGE_REST) / 60),
  }));

  const restDay = day.kj === 0 && day.tgt === 0;
  const tomorrow = restDay && dayIndex < 6 ? DAYS[(dayIndex + 1 === 3 ? 'thu_start' : WEEK[dayIndex + 1]) as DayVariant] : null;

  const at = (y: number) => ({ position: 'absolute' as const, left: 20 * s, right: 20 * s, top: y * s });
  // The header block moves down as one piece so it clears the status bar; the sun and frost stay put.
  const dy = headerTop - 56 * s;
  const atHead = (y: number) => ({ ...at(y), top: y * s + dy });

  // The fuel headline mirrors the ride one: it rests at the foot of the frost and swiping up carries
  // it to the ride headline's spot. Pulled down, it leaves with the frost. The macro row follows it
  // up from below the screen and stops where the ride metrics sit.
  const headTop = HEAD_Y * s + dy;
  const restTop = FUEL_REST * s;
  const fuelTopAt = (e: number) => {
    'worklet';
    return e >= EDGE_REST ? restTop + (e - EDGE_REST) * s : headTop + (restTop - headTop) * (e / EDGE_REST);
  };
  const fuelMove = useAnimatedStyle(() => ({ top: fuelTopAt(edge.value) }));
  const macrosMove = useAnimatedStyle(() => ({ top: Math.max(ROW_Y * s, fuelTopAt(edge.value) + (contentH + 8 - restTop)) }));

  return (
    <GestureDetector gesture={pan}>
      <View style={[styles.screen, { height: contentH }]} collapsable={false}>
        {/* ───────────── base layer: the ride ───────────── */}
        <Animated.View
          style={[StyleSheet.absoluteFill, page]}
          pointerEvents="none"
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={a11ySummary}
          accessibilityValue={{ text: modeLabel }}
          accessibilityHint="Swipe up to show the macro rings, down to show the power rays."
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(ev) => {
            const up = ev.nativeEvent.actionName === 'increment';
            goTo(up ? (mode === EDGE_DOWN ? EDGE_REST : EDGE_UP) : mode === EDGE_UP ? EDGE_REST : EDGE_DOWN);
          }}
        >
          <SunCanvas day={day} edge={edge} s={s} width={width} height={contentH} />
        </Animated.View>

        {tomorrow && tomorrow.tgt > 0 && <Tomorrow day={tomorrow} s={s} page={page} />}

        <Animated.View style={[atHead(56), hdrOut]}>
          <Header label={day.label} selected={dayIndex} onSelect={setDayIndex} onLongPress={dayIndex === 3 ? cycleThuPhase : undefined} />
        </Animated.View>

        <Animated.View style={[atHead(HEAD_Y), styles.block, page, rideOut]}>
          <Text maxFontSizeMultiplier={DT.fixed} style={caps}>Ride</Text>
          <Text maxFontSizeMultiplier={DT.fixed} style={styles.big}>{fmt(day.kj)}</Text>
          <Text maxFontSizeMultiplier={DT.fixed} numberOfLines={1} adjustsFontSizeToFit style={styles.note}>{day.note}</Text>
        </Animated.View>

        {day.ride && (
          <Animated.View style={[at(ROW_Y), styles.grid, page, metricsOut]}>
            <Metric label="Time" value={day.ride.min} unit=" min" sub="moving" bar={C.ink} />
            <Metric label="Avg power" value={day.ride.w} unit=" W" sub={`${day.ride.wkg} W/kg`} bar={C.orange} />
            <Metric label="Intensity" value={day.ride.pct} unit=" % FTP" sub={day.ride.zone} bar="#A9A8A3" />
          </Animated.View>
        )}

        {/* ───────────── frosted film: the fuel ───────────── */}
        <Animated.View style={[styles.filmBox, filmBox]} pointerEvents="box-none">
          <Animated.View style={[{ position: 'absolute', left: 0, right: 0, height: contentH }, filmInner]} pointerEvents="box-none">
            <Animated.View style={[StyleSheet.absoluteFill, page]} pointerEvents="none">
              <FrostCanvas
                edge={edge}
                waterR={waterRadius(day.tgt)}
                carbs={gC}
                protein={gP}
                fat={gF}
                goals={{ C: day.TC, P: day.TP, F: day.TF }}
                s={s}
                width={width}
                height={contentH}
              />
            </Animated.View>

            <View style={atHead(56)}>
              <Header label={day.label} selected={dayIndex} onSelect={setDayIndex} onLongPress={dayIndex === 3 ? cycleThuPhase : undefined} />
            </View>

            <Animated.View style={[at(FUEL_REST), styles.block, page, fuelMove]}>
              <Text maxFontSizeMultiplier={DT.fixed} style={caps}>Eat</Text>
              <Text maxFontSizeMultiplier={DT.fixed} style={[styles.big, { color: live ? C.orangeText : C.ink }]}>{fmt(left)}</Text>
              <View style={styles.baseline}>
                <Text maxFontSizeMultiplier={DT.fixed} numberOfLines={1} adjustsFontSizeToFit style={[styles.note, styles.shrink, { color: C.frostInk }]}>kcal left of {fmt(day.of)}</Text>
                {totals.addedKcal > 0 && <Text maxFontSizeMultiplier={DT.fixed} style={[styles.note, { color: C.orangeText, opacity: live ? 1 : 0 }]}>−{totals.addedKcal}</Text>}
              </View>
            </Animated.View>

            <Animated.View style={[at(ROW_Y), styles.grid, page, macrosMove]}>
              <Macro label="Carbs" value={sC} goal={day.TC} bar={C.ink} live={live} />
              <Macro label="Protein" value={sP} goal={day.TP} bar={C.orange} live={live} />
              <Macro label="Fat" value={sF} goal={day.TF} bar={C.peach} live={live} />
            </Animated.View>
          </Animated.View>
        </Animated.View>

        {/* Tap alternative to the drag (HIG: never gesture-only). At rest, tap above the waterline for
            the power rays and below it for the macro rings; tap again to return. VoiceOver uses the
            adjustable element on the sun instead, so this region is hidden from it. */}
        <Pressable
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          style={{ position: 'absolute', left: 0, right: 0, top: TAP_TOP * s, height: (TAP_BOTTOM - TAP_TOP) * s, zIndex: 5 }}
          onPress={(ev) => {
            const y = TAP_TOP + ev.nativeEvent.locationY / s;
            if (mode !== EDGE_REST) goTo(EDGE_REST);
            else goTo(y < EDGE_REST ? EDGE_DOWN : EDGE_UP);
          }}
        />

        {showHint && (
          <Animated.View pointerEvents="none" style={[styles.hint, hintStyle]}>
            <Text maxFontSizeMultiplier={DT.fixed} numberOfLines={1} adjustsFontSizeToFit style={styles.hintText}>↓ Pull for power · Swipe for fuel ↑</Text>
          </Animated.View>
        )}

        {/* fixed separator under the week strip */}
        <View pointerEvents="none" style={[styles.sep, { top: 133 * s + dy, left: 20 * s, right: 20 * s }]} />

        {dayIndex !== TODAY_INDEX && (
          <Pressable onPress={() => setDayIndex(TODAY_INDEX)} style={[styles.todayBtn, { top: 44 * s + dy }]} hitSlop={8}>
            <Text maxFontSizeMultiplier={DT.fixed} style={[caps, { color: C.orangeText }]}>Today</Text>
          </Pressable>
        )}
      </View>
    </GestureDetector>
  );
}

function Header({ label, selected, onSelect, onLongPress }: { label: string; selected: number; onSelect: (i: number) => void; onLongPress?: () => void }) {
  return (
    <View style={{ gap: 6 }}>
      <Pressable onLongPress={onLongPress} delayLongPress={500} style={{ alignSelf: 'flex-start' }}>
        <Text maxFontSizeMultiplier={DT.fixed} style={[caps, { fontSize: T.label, color: C.grey }]}>{label}</Text>
      </Pressable>
      <WeekStrip selected={selected} onSelect={onSelect} />
    </View>
  );
}

function Metric({ label, value, unit, sub, bar }: { label: string; value: number; unit: string; sub: string; bar: string }) {
  return (
    <View style={[styles.cell, { borderTopColor: bar }]}>
      <Text maxFontSizeMultiplier={DT.fixed} style={caps}>{label}</Text>
      <Text maxFontSizeMultiplier={DT.fixed} style={styles.mid}>
        {value}
        <Text maxFontSizeMultiplier={DT.fixed} style={styles.unit}>{unit}</Text>
      </Text>
      <Text maxFontSizeMultiplier={DT.fixed} style={styles.unit}>{sub}</Text>
    </View>
  );
}

function Macro({ label, value, goal, bar, live }: { label: string; value: number; goal: number; bar: string; live: boolean }) {
  const g = Math.round(value);
  const over = goal > 0 && g > goal ? g - goal : 0;
  return (
    <View style={[styles.cell, { borderTopColor: bar }]} accessibilityLabel={`${label} ${g} of ${goal} grams${over ? `, ${over} over` : ''}`}>
      <Text maxFontSizeMultiplier={DT.fixed} style={caps}>{label}</Text>
      <Text maxFontSizeMultiplier={DT.fixed} style={[styles.mid, { color: live || over ? C.orangeText : C.ink }]}>
        {g}
        <Text maxFontSizeMultiplier={DT.fixed} style={[styles.unit, { color: C.frostInk }]}>/{goal}g</Text>
        {over > 0 && <Text maxFontSizeMultiplier={DT.fixed} style={[styles.unit, { color: C.orangeText }]}> +{over}</Text>}
      </Text>
    </View>
  );
}

/** Rest day: a dashed ghost of tomorrow's sun, sized to tomorrow's kJ target. */
function Tomorrow({ day, s, page }: { day: (typeof DAYS)[DayVariant]; s: number; page: ReturnType<typeof useAnimatedStyle> }) {
  const r = sunRadius(day.tgt);
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, page]}>
      <View
        style={{
          position: 'absolute',
          left: (CX - r) * s,
          top: (CY - r) * s,
          width: r * 2 * s,
          height: r * 2 * s,
          borderRadius: r * s,
          borderWidth: 1.2,
          borderStyle: 'dashed',
          borderColor: C.grey2,
        }}
      />
      <View style={{ position: 'absolute', left: 0, right: 0, top: (CY - r * 0.62) * s, alignItems: 'center', gap: 6 }}>
        <Text maxFontSizeMultiplier={DT.fixed} style={[caps, { color: C.grey }]}>Tomorrow · {day.label.split(' · ')[0]}</Text>
        <Text maxFontSizeMultiplier={DT.fixed} style={styles.mid}>
          {fmt(day.tgt)}
          <Text maxFontSizeMultiplier={DT.fixed} style={styles.unit}> kJ planned</Text>
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: C.bg, overflow: 'hidden' },
  filmBox: { position: 'absolute', left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  block: { gap: 6, paddingTop: 12, alignItems: 'center' },
  baseline: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  big: { fontFamily: F.thin, fontSize: T.display, letterSpacing: -2.2, lineHeight: 56, color: C.ink },
  note: { fontFamily: F.mono, fontSize: T.label, color: C.grey },
  grid: { flexDirection: 'row', gap: 16 },
  cell: { flex: 1, gap: 6, borderTopWidth: 3, paddingTop: 10 },
  mid: { fontFamily: F.light, fontSize: T.mid, letterSpacing: -0.5, color: C.ink },
  unit: { fontFamily: F.mono, fontSize: T.label, color: C.grey },
  sep: { position: 'absolute', height: 1, backgroundColor: C.ink, zIndex: 6 },
  todayBtn: { position: 'absolute', right: 8, padding: 12, zIndex: 40 },
  shrink: { flexShrink: 1 },
  hint: { position: 'absolute', paddingHorizontal: 20, left: 0, right: 0, alignItems: 'center', zIndex: 7 },
  hintText: { fontFamily: F.mono, fontSize: T.label, letterSpacing: 1, textTransform: 'uppercase', color: C.frostInk },
});
