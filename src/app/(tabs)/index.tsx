import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { scheduleOnRN } from 'react-native-worklets';

import { FrostCanvas } from '@/components/today/FrostCanvas';
import { SunCanvas } from '@/components/today/SunCanvas';
import { WeekStrip } from '@/components/today/WeekStrip';
import { DAYS, TODAY_INDEX } from '@/data/sample';
import { EDGE_DOWN, EDGE_REST, EDGE_UP, progress, ramp, snapEdge, waterRadius } from '@/lib/frost';
import { fmt, useTween } from '@/lib/useTween';
import { useApp } from '@/state/AppState';
import { C, F, caps, useLayout } from '@/theme';

export default function TodayScreen() {
  const { s, width, contentH } = useLayout();
  const { dayIndex, setDayIndex, variant, cycleThuPhase, totals } = useApp();
  const day = DAYS[variant];

  // ── the frost edge (design px) and the horizontal day-swipe offset (pt) ──
  const edge = useSharedValue(EDGE_REST);
  const start = useSharedValue(EDGE_REST);
  const dx = useSharedValue(0);
  const axis = useSharedValue<0 | 1 | 2>(0); // 0 undecided, 1 vertical, 2 horizontal

  const changeDay = (dir: number) => {
    setDayIndex(dayIndex + dir);
    Haptics.selectionAsync();
  };

  const pan = usePanGesture({
    minDistance: 8,
    onActivate: (e) => {
      'worklet';
      axis.value = Math.abs(e.translationX) > Math.abs(e.translationY) ? 2 : 1;
      start.value = edge.value;
    },
    onUpdate: (e) => {
      'worklet';
      if (axis.value === 1) {
        edge.value = Math.max(EDGE_UP, Math.min(EDGE_DOWN, start.value + e.translationY / s));
      } else if (axis.value === 2) {
        const atEnd = (e.translationX > 0 && dayIndex === 0) || (e.translationX < 0 && dayIndex === 6);
        dx.value = atEnd ? e.translationX * 0.25 : e.translationX;
      }
    },
    onDeactivate: (e) => {
      'worklet';
      if (axis.value === 1) {
        edge.value = withSpring(snapEdge(edge.value, e.velocityY / s), { damping: 22, stiffness: 180, mass: 0.9 });
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

  const at = (y: number) => ({ position: 'absolute' as const, left: 20 * s, right: 20 * s, top: y * s });

  return (
    <GestureDetector gesture={pan}>
      <View style={[styles.screen, { height: contentH }]} collapsable={false}>
        {/* ───────────── base layer: the ride ───────────── */}
        <Animated.View style={[StyleSheet.absoluteFill, page]} pointerEvents="none">
          <SunCanvas day={day} edge={edge} s={s} width={width} height={contentH} />
        </Animated.View>

        <Animated.View style={[at(56), hdrOut]}>
          <Header label={day.label} selected={dayIndex} onSelect={setDayIndex} onLongPress={dayIndex === 3 ? cycleThuPhase : undefined} />
        </Animated.View>

        <Animated.View style={[at(133), styles.block, page, rideOut]}>
          <Text style={caps}>Ride</Text>
          <BigNumber value={fmt(day.kj)} note={day.note} />
        </Animated.View>

        {day.ride && (
          <Animated.View style={[at(654), styles.grid, page, metricsOut]}>
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

            <View style={at(56)}>
              <Header label={day.label} selected={dayIndex} onSelect={setDayIndex} onLongPress={dayIndex === 3 ? cycleThuPhase : undefined} />
            </View>

            <Animated.View style={[at(133), styles.block, page]}>
              <Text style={caps}>Eat</Text>
              <View style={styles.baseline}>
                <Text style={[styles.big, { color: live ? C.orange : C.ink }]}>{fmt(left)}</Text>
                <Text style={[styles.note, { color: C.frostInk }]}>kcal left of {fmt(day.of)}</Text>
                {totals.addedKcal > 0 && <Text style={[styles.note, { color: C.orange, opacity: live ? 1 : 0 }]}>−{totals.addedKcal}</Text>}
              </View>
            </Animated.View>

            <Animated.View style={[at(654), styles.grid, page]}>
              <Macro label="Fat" value={sF} goal={day.TF} bar={C.peach} live={live} />
              <Macro label="Protein" value={sP} goal={day.TP} bar={C.orange} live={live} />
              <Macro label="Carbs" value={sC} goal={day.TC} bar={C.ink} live={live} />
            </Animated.View>
          </Animated.View>
        </Animated.View>

        {/* fixed separator under the week strip */}
        <View pointerEvents="none" style={[styles.sep, { top: 133 * s, left: 20 * s, right: 20 * s }]} />

        {dayIndex !== TODAY_INDEX && (
          <Pressable onPress={() => setDayIndex(TODAY_INDEX)} style={[styles.todayBtn, { top: 44 * s }]} hitSlop={8}>
            <Text style={[caps, { fontSize: 11, color: C.orange }]}>Today</Text>
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
        <Text style={[caps, { fontSize: 11, color: C.grey }]}>{label}</Text>
      </Pressable>
      <WeekStrip selected={selected} onSelect={onSelect} />
    </View>
  );
}

function BigNumber({ value, note }: { value: string; note: string }) {
  return (
    <View style={styles.baseline}>
      <Text style={styles.big}>{value}</Text>
      <Text style={styles.note}>{note}</Text>
    </View>
  );
}

function Metric({ label, value, unit, sub, bar }: { label: string; value: number; unit: string; sub: string; bar: string }) {
  return (
    <View style={[styles.cell, { borderTopColor: bar }]}>
      <Text style={caps}>{label}</Text>
      <Text style={styles.mid}>
        {value}
        <Text style={styles.unit}>{unit}</Text>
      </Text>
      <Text style={styles.unit}>{sub}</Text>
    </View>
  );
}

function Macro({ label, value, goal, bar, live }: { label: string; value: number; goal: number; bar: string; live: boolean }) {
  return (
    <View style={[styles.cell, { borderTopColor: bar }]}>
      <Text style={caps}>{label}</Text>
      <Text style={[styles.mid, { color: live ? C.orange : C.ink }]}>
        {Math.round(value)}
        <Text style={[styles.unit, { color: C.frostInk }]}>/{goal}g</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: C.bg, overflow: 'hidden' },
  filmBox: { position: 'absolute', left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  block: { gap: 8, paddingTop: 12 },
  baseline: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  big: { fontFamily: F.thin, fontSize: 56, letterSpacing: -2.2, lineHeight: 56, color: C.ink },
  note: { fontFamily: F.mono, fontSize: 11, color: C.grey },
  grid: { flexDirection: 'row', gap: 16 },
  cell: { flex: 1, gap: 6, borderTopWidth: 3, paddingTop: 10 },
  mid: { fontFamily: F.light, fontSize: 26, letterSpacing: -0.5, color: C.ink },
  unit: { fontFamily: F.mono, fontSize: 10, color: C.grey },
  sep: { position: 'absolute', height: 1, backgroundColor: C.ink, zIndex: 6 },
  todayBtn: { position: 'absolute', right: 8, padding: 12, zIndex: 40 },
});
