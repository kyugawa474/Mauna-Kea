import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';

import { WeeklyBars } from '@/components/training/WeeklyBars';
import { ZoneGraph } from '@/components/training/ZoneGraph';
import { ACTIVITY_LOG, CONSISTENCY, TRAINING_STATS } from '@/data/sample';
import { fmt, useCountUp } from '@/lib/useTween';
import { C, F, caps, useLayout } from '@/theme';

export default function TrainingScreen() {
  const { width } = useLayout();
  const inner = width - 40;

  // One clock drives every entrance animation; it restarts each time the tab gains focus.
  const clock = useSharedValue(0);
  const [visit, setVisit] = useState(0);
  useFocusEffect(
    useCallback(() => {
      clock.set(0);
      clock.set(withTiming(3000, { duration: 3000, easing: Easing.linear }));
      setVisit((v) => v + 1);
    }, [clock]),
  );

  const kjWeek = useCountUp(TRAINING_STATS.thisWeek, visit);
  const kjAvg = useCountUp(TRAINING_STATS.avgWeek, visit);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
      <View style={{ gap: 6, paddingBottom: 24 }}>
        <Text style={[caps, { fontSize: 11, color: C.grey }]}>Thu · Oct 22</Text>
        <Text style={styles.h1}>Training</Text>
      </View>

      <Section title="Weekly kJ" right="— target" rightColor={C.orangeText}>
        <View style={styles.baseline}>
          <Text style={styles.big}>{fmt(kjWeek)}</Text>
          <Text style={styles.note}>/ {fmt(TRAINING_STATS.weekTarget)} kJ this week</Text>
        </View>
        <WeeklyBars width={width} clock={clock} />
        <View style={[styles.row3, { marginTop: 14 }]}>
          <Stat label="Variability" value={String(TRAINING_STATS.variability)} unit="%" />
          <Stat label="Avg / week" value={fmt(kjAvg)} unit="kJ" />
          <Stat label="This week" value={fmt(kjWeek)} unit="kJ" hot />
        </View>
      </Section>

      <Section title="Time in zone" right="Last 8 weeks · 41h">
        <ZoneGraph width={inner} clock={clock} />
      </Section>

      <Section title="Consistency" right="12 weeks">
        <Consistency clock={clock} width={inner} />
      </Section>

      <View style={[styles.logHead]}>
        <Text style={caps}>Activity</Text>
        <Text style={[caps, { color: C.grey }]}>This week</Text>
      </View>
      {ACTIVITY_LOG.map((a) => (
        <View key={a.date} style={styles.logRow}>
          <ActivityIcon kind={a.kind} />
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={[caps, { color: C.grey }]}>{a.date}</Text>
            <Text style={[styles.logName, a.kind === 'skipped' && { color: C.grey }]}>{a.name}</Text>
            <Text style={styles.note}>{a.sub}</Text>
          </View>
          {'kj' in a && (
            <Text style={styles.logKj}>
              {fmt(a.kj)}
              <Text style={styles.note}> kJ</Text>
            </Text>
          )}
        </View>
      ))}
    </ScrollView>
  );
}

function Section({ title, right, rightColor = C.grey, children }: { title: string; right: string; rightColor?: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={caps}>{title}</Text>
        <Text style={[caps, { color: rightColor }]}>{right}</Text>
      </View>
      {children}
    </View>
  );
}

function Stat({ label, value, unit, hot }: { label: string; value: string; unit: string; hot?: boolean }) {
  return (
    <View style={[styles.stat, { backgroundColor: hot ? C.orange : C.tile }]}>
      <Text style={[caps, { color: hot ? C.ink : C.grey }]}>{label}</Text>
      <View style={[styles.baseline, { gap: 3 }]}>
        <Text style={styles.statNum}>{value}</Text>
        <Text style={[styles.note, { color: hot ? C.ink : C.grey }]}>{unit}</Text>
      </View>
    </View>
  );
}

const ROW_LABELS = ['M', '', 'W', '', 'F', '', 'S'];

function Consistency({ clock, width }: { clock: SharedValue<number>; width: number }) {
  return (
    <View style={{ gap: 16 }}>
      <View style={{ flexDirection: 'row', marginLeft: -18, marginRight: -4 }} accessibilityLabel="Rides and other sessions over the last 12 weeks">
        <View style={{ width: 14, gap: 4 }}>
          {ROW_LABELS.map((l, i) => (
            <Text key={i} style={styles.rowLabel}>{l}</Text>
          ))}
        </View>
        <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between', maxWidth: width + 4 }}>
          {CONSISTENCY.map((col, c) => (
            <View key={c} style={{ gap: 4 }}>
              {col.map((cell, r) => (
                <View key={r} style={styles.cellBox}>
                  <Dot kind={cell} delay={c * 50 + r * 18 + 450} clock={clock} />
                </View>
              ))}
            </View>
          ))}
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 16 }}>
        <View style={styles.legend}>
          <View style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: C.orange }} />
          <Text style={[styles.note, { fontSize: 11 }]}>Ride</Text>
        </View>
        <View style={styles.legend}>
          <View style={{ width: 11, height: 11, borderRadius: 6, borderWidth: 1.5, borderColor: C.orange }} />
          <Text style={[styles.note, { fontSize: 11 }]}>Other activity</Text>
        </View>
      </View>
    </View>
  );
}

function Dot({ kind, delay, clock }: { kind: string; delay: number; clock: SharedValue<number> }) {
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
      {today && <View style={[styles.ring, { width: 14.6, height: 14.6, borderRadius: 7.3, borderColor: C.ink, borderWidth: 1.1 }]} />}
      {k === 'ride' && <View style={{ width: 11, height: 11, borderRadius: 5.5, backgroundColor: C.orange }} />}
      {k === 'other' && <View style={[styles.ring, { width: 9.5, height: 9.5, borderRadius: 4.75, borderColor: C.orange, borderWidth: 1.5 }]} />}
      {k === 'both' && (
        <>
          <View style={[styles.ring, { width: 13.6, height: 13.6, borderRadius: 6.8, borderColor: C.orange, borderWidth: 1.5 }]} />
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.orange }} />
        </>
      )}
      {(k === 'rest' || k === 'future') && (
        <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: k === 'rest' ? '#B8B6B0' : C.line }} />
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
  h1: { fontFamily: F.semibold, fontSize: 40, letterSpacing: -1.2, lineHeight: 40, color: C.ink },
  section: {
    marginHorizontal: -20, paddingHorizontal: 20, borderTopWidth: 1, borderTopColor: C.ink,
    paddingTop: 14, paddingBottom: 26, gap: 12,
  },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  baseline: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  big: { fontFamily: F.thin, fontSize: 56, letterSpacing: -2.2, lineHeight: 56, color: C.ink },
  note: { fontFamily: F.mono, fontSize: 11, color: C.grey },
  row3: { flexDirection: 'row', gap: 3 },
  stat: { flex: 1, paddingVertical: 12, paddingHorizontal: 10, gap: 14 },
  statNum: { fontFamily: F.light, fontSize: 26, letterSpacing: -0.8, color: C.ink },
  rowLabel: { height: 27, lineHeight: 27, fontFamily: F.mono, fontSize: 11, color: C.grey },
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
  logName: { fontFamily: F.medium, fontSize: 16, color: C.ink },
  logKj: { fontFamily: F.light, fontSize: 22, letterSpacing: -0.4, color: C.ink },
});
