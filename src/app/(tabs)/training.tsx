import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';

import { AddPanel } from '@/components/AddPanel';
import { WeeklyBars } from '@/components/training/WeeklyBars';
import { ZoneGraph } from '@/components/training/ZoneGraph';
import { ACTIVITY_LOG, CONSISTENCY, TRAINING_STATS } from '@/data/sample';
import { fmt, useCountUp } from '@/lib/useTween';
import { C, DT, F, caps, useLayout, T } from '@/theme';

export default function TrainingScreen() {
  const { width, stackTiles, headerTop, navH } = useLayout();
  const inner = width - 40;

  // One clock drives every entrance animation; it restarts each time the tab gains focus.
  const clock = useSharedValue(0);
  const [visit, setVisit] = useState(0);

  // The time-in-zone graph sits below the fold, so it has its own clock that starts when a third
  // of the graph has scrolled into view (above the floating tab bar), once per visit.
  const zoneClock = useSharedValue(0);
  const zoneShown = useRef(false);
  const zoneBox = useRef({ y: 0, h: 0 });
  const viewH = useRef(0);
  const scrollY = useRef(0);
  const revealZones = useCallback(() => {
    const { y, h } = zoneBox.current;
    if (zoneShown.current || !h || !viewH.current) return;
    if (scrollY.current + viewH.current - navH < y + h / 3) return;
    zoneShown.current = true;
    // Start at 350 so the first ticks begin almost at once (they are staggered from 450).
    zoneClock.set(350);
    zoneClock.set(withTiming(3000, { duration: 2650, easing: Easing.linear }));
  }, [navH, zoneClock]);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollY.current = e.nativeEvent.contentOffset.y;
    revealZones();
  };

  useFocusEffect(
    useCallback(() => {
      clock.set(0);
      clock.set(withTiming(3000, { duration: 3000, easing: Easing.linear }));
      zoneClock.set(0);
      zoneShown.current = false;
      revealZones();
      setVisit((v) => v + 1);
    }, [clock, zoneClock, revealZones]),
  );

  const kjWeek = useCountUp(TRAINING_STATS.thisWeek, visit);
  const kjAvg = useCountUp(TRAINING_STATS.avgWeek, visit);

  return (
    // The wrapper keeps the ScrollView first in the screen, so the glass bar still tracks its scroll edge.
    <View style={{ flex: 1, backgroundColor: C.bg }} collapsable={false}>
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      // Content scrolls under the floating tab bar; the last row stops clear of it.
      contentContainerStyle={[styles.page, { paddingTop: headerTop, paddingBottom: navH + 24 }]}
      scrollIndicatorInsets={{ bottom: navH }}
      showsVerticalScrollIndicator={false}
      onScroll={onScroll}
      scrollEventThrottle={32}
      onLayout={(e: LayoutChangeEvent) => {
        viewH.current = e.nativeEvent.layout.height;
        revealZones();
      }}
    >
      <View style={{ gap: 6, paddingBottom: 24 }}>
        <Text maxFontSizeMultiplier={DT.list} style={[caps, { fontSize: T.label, color: C.grey }]}>Thu · Oct 22</Text>
        <Text maxFontSizeMultiplier={DT.fixed} style={styles.h1}>Training</Text>
      </View>

      <Section title="Consistency" right="12 weeks">
        <Consistency clock={clock} width={inner} />
      </Section>

      <Section title="Weekly kJ" right="— target" rightColor={C.orangeText}>
        <View style={styles.baseline}>
          <Text maxFontSizeMultiplier={DT.fixed} style={styles.big}>{fmt(kjWeek)}</Text>
          <Text maxFontSizeMultiplier={DT.list} style={[styles.note, { flexShrink: 1 }]}>/ {fmt(TRAINING_STATS.weekTarget)} kJ this week</Text>
        </View>
        <WeeklyBars width={width} clock={clock} />
        <View style={[styles.row3, stackTiles && styles.stacked, { marginTop: 14 }]}>
          <Stat label="Variability" value={String(TRAINING_STATS.variability)} unit="%" />
          <Stat label="Avg / week" value={fmt(kjAvg)} unit="kJ" />
          <Stat label="To go" value={fmt(Math.max(0, TRAINING_STATS.weekTarget - kjWeek))} unit="kJ" hot />
        </View>
      </Section>

      <Section
        title="Time in zone"
        right="Last 8 weeks · 41h"
        onLayout={(e) => {
          zoneBox.current = { y: e.nativeEvent.layout.y, h: e.nativeEvent.layout.height };
          revealZones();
        }}
      >
        <ZoneGraph width={inner} clock={zoneClock} />
      </Section>

      <View style={[styles.logHead]}>
        <Text maxFontSizeMultiplier={DT.list} style={caps}>Activity</Text>
        <Text maxFontSizeMultiplier={DT.list} style={[caps, { color: C.grey }]}>This week</Text>
      </View>
      {ACTIVITY_LOG.map((a) => (
        <View key={a.date} style={styles.logRow}>
          <ActivityIcon kind={a.kind} />
          <View style={{ flex: 1, gap: 3 }}>
            <Text maxFontSizeMultiplier={DT.list} style={[caps, { color: C.grey }]}>{a.date}</Text>
            <Text maxFontSizeMultiplier={DT.list} style={[styles.logName, a.kind === 'skipped' && { color: C.grey }]}>{a.name}</Text>
            <Text maxFontSizeMultiplier={DT.list} style={styles.note}>{a.sub}</Text>
          </View>
          {'kj' in a && (
            <Text maxFontSizeMultiplier={DT.list} style={styles.logKj}>
              {fmt(a.kj)}
              <Text maxFontSizeMultiplier={DT.list} style={styles.note}> kJ</Text>
            </Text>
          )}
        </View>
      ))}
    </ScrollView>
    <AddPanel />
    </View>
  );
}

function Section({
  title,
  right,
  rightColor = C.grey,
  onLayout,
  children,
}: {
  title: string;
  right: string;
  rightColor?: string;
  onLayout?: (e: LayoutChangeEvent) => void;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section} onLayout={onLayout}>
      <View style={styles.sectionHead}>
        <Text maxFontSizeMultiplier={DT.list} style={caps}>{title}</Text>
        <Text maxFontSizeMultiplier={DT.list} style={[caps, { color: rightColor }]}>{right}</Text>
      </View>
      {children}
    </View>
  );
}

function Stat({ label, value, unit, hot }: { label: string; value: string; unit: string; hot?: boolean }) {
  return (
    <View style={[styles.stat, { backgroundColor: hot ? C.orange : C.tile }]}>
      <Text maxFontSizeMultiplier={DT.list} style={[caps, { color: hot ? C.ink : C.grey }]}>{label}</Text>
      <View style={[styles.baseline, { gap: 3 }]}>
        <Text maxFontSizeMultiplier={DT.fixed} style={styles.statNum}>{value}</Text>
        <Text maxFontSizeMultiplier={DT.list} style={[styles.note, { color: hot ? C.ink : C.grey }]}>{unit}</Text>
      </View>
    </View>
  );
}

const ROW_LABELS = ['M', '', 'W', '', 'F', '', 'S'];

function Consistency({ clock, width }: { clock: SharedValue<number>; width: number }) {
  return (
    <View style={{ gap: 16 }}>
      <View style={{ flexDirection: 'row', gap: 4 }} accessibilityLabel="Rides and other sessions over the last 12 weeks; this week in orange">
        <View style={{ width: 14, gap: 4 }}>
          {ROW_LABELS.map((l, i) => (
            <Text key={i} maxFontSizeMultiplier={DT.strip} style={styles.rowLabel}>{l}</Text>
          ))}
        </View>
        <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between' }}>
          {CONSISTENCY.map((col, c) => (
            <View key={c} style={{ gap: 4 }}>
              {col.map((cell, r) => (
                <View key={r} style={styles.cellBox}>
                  <Dot kind={cell} now={c === CONSISTENCY.length - 1} delay={c * 50 + r * 18 + 450} clock={clock} />
                </View>
              ))}
            </View>
          ))}
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 8 }}>
        <View style={styles.legend}>
          <View style={{ width: 15, height: 15, borderRadius: 7.5, backgroundColor: C.ink }} />
          <Text maxFontSizeMultiplier={DT.list} style={styles.note}>Ride</Text>
        </View>
        <View style={styles.legend}>
          <View style={{ width: 13, height: 13, borderRadius: 6.5, borderWidth: 1.6, borderColor: C.ink }} />
          <Text maxFontSizeMultiplier={DT.list} style={styles.note}>Other activity</Text>
        </View>
        <View style={styles.legend}>
          <View style={{ width: 15, height: 15, borderRadius: 7.5, backgroundColor: C.orange }} />
          <Text maxFontSizeMultiplier={DT.list} style={styles.note}>This week</Text>
        </View>
      </View>
    </View>
  );
}

function Dot({ kind, now, delay, clock }: { kind: string; now: boolean; delay: number; clock: SharedValue<number> }) {
  // Orange means "now": this week's sessions are orange, earlier weeks ink.
  const col = now ? C.orange : C.ink;
  const today = kind.endsWith('!');
  const k = kind.replace('!', '');
  const st = useAnimatedStyle(() => {
    const t = Math.max(0, Math.min(1, (clock.value - delay) / 500));
    // back-out ease: a small overshoot, like the prototype's cubic-bezier(.3,1.6,.5,1)
    const u = t - 1;
    const scale = t === 0 ? 0 : 1 + 2.70158 * u * u * u + 1.70158 * u * u;
    return { opacity: t > 0 ? 1 : 0, transform: [{ scale }] };
  });
  return (
    <Animated.View style={[styles.cellBox, st]}>
      {today && <View style={[styles.ring, { width: 21, height: 21, borderRadius: 10.5, borderColor: C.ink, borderWidth: 1.2 }]} />}
      {k === 'ride' && <View style={{ width: 15, height: 15, borderRadius: 7.5, backgroundColor: col }} />}
      {k === 'other' && <View style={[styles.ring, { width: 13, height: 13, borderRadius: 6.5, borderColor: col, borderWidth: 1.6 }]} />}
      {k === 'both' && (
        <>
          <View style={[styles.ring, { width: 18, height: 18, borderRadius: 9, borderColor: col, borderWidth: 1.6 }]} />
          <View style={{ width: 10.5, height: 10.5, borderRadius: 5.25, backgroundColor: col }} />
        </>
      )}
      {(k === 'rest' || k === 'future') && (
        <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: k === 'rest' ? '#B8B6B0' : C.line }} />
      )}
    </Animated.View>
  );
}

function ActivityIcon({ kind }: { kind: string }) {
  return (
    <View style={{ width: 22, height: 22, alignItems: 'center', justifyContent: 'center' }}>
      {kind === 'ride' && <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: C.orange }} />}
      {kind === 'other' && <View style={{ width: 13, height: 13, borderRadius: 6.5, borderWidth: 1.5, borderColor: C.orange }} />}
      {kind === 'skipped' && <View style={{ width: 13, height: 13, borderRadius: 6.5, borderWidth: 1.2, borderColor: C.grey2, borderStyle: 'dashed' }} />}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { paddingTop: 56, paddingHorizontal: 20, paddingBottom: 40 },
  h1: { fontFamily: F.semibold, fontSize: T.head, letterSpacing: -1.2, lineHeight: 40, color: C.ink },
  section: {
    marginHorizontal: -20, paddingHorizontal: 20, borderTopWidth: 1, borderTopColor: C.ink,
    paddingTop: 14, paddingBottom: 26, gap: 12,
  },
  sectionHead: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, justifyContent: 'space-between', alignItems: 'baseline' },
  baseline: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: 8 },
  big: { fontFamily: F.thin, fontSize: T.display, letterSpacing: -2.2, lineHeight: 56, color: C.ink },
  note: { fontFamily: F.mono, fontSize: T.label, color: C.grey },
  row3: { flexDirection: 'row', gap: 3 },
  stacked: { flexDirection: 'column' },
  stat: { flex: 1, paddingVertical: 12, paddingHorizontal: 10, gap: 14 },
  statNum: { fontFamily: F.light, fontSize: T.mid, letterSpacing: -0.8, color: C.ink },
  rowLabel: { height: 27, lineHeight: 27, fontFamily: F.mono, fontSize: T.label, color: C.grey },
  cellBox: { width: 27, height: 27, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute' },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  logHead: {
    marginHorizontal: -20, paddingHorizontal: 20, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.ink,
    paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between',
  },
  logRow: {
    marginHorizontal: -20, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.line,
  },
  logName: { fontFamily: F.medium, fontSize: T.body, color: C.ink },
  logKj: { fontFamily: F.light, fontSize: T.mid, letterSpacing: -0.4, color: C.ink },
});
