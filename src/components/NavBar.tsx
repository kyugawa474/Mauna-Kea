import * as Haptics from 'expo-haptics';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { TODAY_INDEX } from '@/data/sample';
import { useApp } from '@/state/AppState';
import { C, caps, useLayout } from '@/theme';

export function NavBar({ state, navigateToTab }: BottomTabBarProps) {
  const { navH, insets } = useLayout();
  const { addOpen, setAddOpen, setDayIndex } = useApp();
  const current = state.routes[state.index]?.name;
  const onToday = current === 'index';

  const rot = useSharedValue(0);
  useEffect(() => {
    rot.set(withSpring(addOpen ? 135 : 0, { damping: 11, stiffness: 160 }));
  }, [addOpen, rot]);
  const fabStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot.value}deg` }] }));

  const go = (name: 'index' | 'training') => {
    if (addOpen) setAddOpen(false);
    if (name === 'index' && onToday) setDayIndex(TODAY_INDEX);
    else {
      const key = state.routes.find((r) => r.name === name)?.key;
      if (key) navigateToTab(key);
    }
  };

  return (
    <View style={[styles.bar, { height: navH, paddingBottom: insets.bottom }]}>
      <Pressable style={styles.tab} onPress={() => go('index')} accessibilityRole="button" accessibilityLabel="Today">
        <View style={[styles.todayIcon, { backgroundColor: onToday ? C.ink : 'transparent', borderColor: onToday ? C.ink : C.grey }]} />
        <Text style={[caps, { color: onToday ? C.ink : C.grey }]}>Today</Text>
      </Pressable>

      <Pressable
        style={styles.fabWrap}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setAddOpen(!addOpen);
        }}
        accessibilityRole="button"
        accessibilityLabel={addOpen ? 'Close food log' : 'Log food'}
      >
        <Animated.View style={[styles.fab, fabStyle]}>
          <View style={styles.plusH} />
          <View style={styles.plusV} />
        </Animated.View>
      </Pressable>

      <Pressable style={styles.tab} onPress={() => go('training')} accessibilityRole="button" accessibilityLabel="Training">
        <DotGrid filled={!onToday} />
        <Text style={[caps, { color: !onToday ? C.ink : C.grey }]}>Training</Text>
      </Pressable>
    </View>
  );
}

function DotGrid({ filled }: { filled: boolean }) {
  const col = filled ? C.ink : C.grey;
  return (
    <View style={styles.grid}>
      {[0, 1].map((r) => (
        <View key={r} style={styles.gridRow}>
          {[0, 1, 2].map((c) => (
            <View key={c} style={[styles.dot, { borderColor: col, backgroundColor: filled ? col : 'transparent' }]} />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: C.ink,
    backgroundColor: C.bg,
    paddingTop: 10,
    zIndex: 50,
  },
  tab: { flex: 1, alignItems: 'center', gap: 5, minHeight: 44 },
  todayIcon: { width: 17, height: 17, borderRadius: 9, borderWidth: 1.5, marginTop: 2.5, marginBottom: 2.5 },
  fabWrap: { flex: 1, alignItems: 'center', marginTop: -36 },
  fab: { width: 58, height: 58, borderRadius: 29, backgroundColor: C.orange, alignItems: 'center', justifyContent: 'center' },
  plusH: { position: 'absolute', width: 16, height: 2, backgroundColor: C.white },
  plusV: { position: 'absolute', width: 2, height: 16, backgroundColor: C.white },
  grid: { width: 20, height: 22, justifyContent: 'center', gap: 4 },
  gridRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dot: { width: 4.5, height: 4.5, borderRadius: 3, borderWidth: 1.2 },
});
