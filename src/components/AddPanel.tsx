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
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { DAYS, RECENT_FOODS } from '@/data/sample';
import { MEALS, useApp } from '@/state/AppState';
import { C, DT, F, caps, useLayout, T } from '@/theme';

/** "Bloom" food log: a circle grows out of the + button, then rows stagger in. */
export function AddPanel() {
  const { width, contentH, headerTop } = useLayout();
  const { addOpen, setAddOpen, meal, setMeal, picked, togglePick, variant } = useApp();
  const open = useSharedValue(0);

  // Swipe down to dismiss, like an iOS sheet. Closing commits what was ticked (same as tapping ✕).
  const drag = useSharedValue(0);
  const close = () => setAddOpen(false);
  const dismiss = usePanGesture({
    activeOffsetY: [-1000, 12],
    failOffsetX: [-24, 24],
    onUpdate: (e) => {
      'worklet';
      drag.set(Math.max(0, e.translationY));
    },
    onDeactivate: (e) => {
      'worklet';
      if (e.translationY > 120 || e.velocityY > 900) {
        scheduleOnRN(close);
        drag.set(withTiming(0, { duration: 450 }));
      } else {
        drag.set(withSpring(0, { damping: 20, stiffness: 220 }));
      }
    },
  });
  const sheet = useAnimatedStyle(() => ({ transform: [{ translateY: drag.value }] }));

  useEffect(() => {
    open.value = withTiming(addOpen ? 1 : 0, {
      duration: addOpen ? 600 : 450,
      easing: addOpen ? Easing.bezier(0.7, 0, 0.15, 1) : Easing.bezier(0.6, 0, 0.3, 1),
    });
  }, [addOpen, open]);

  const R = Math.hypot(width / 2, contentH) + 40;
  const circle = useAnimatedStyle(() => ({ transform: [{ scale: open.value }] }));

  const addedKcal = RECENT_FOODS.reduce((n, f, i) => n + (picked[i] ? f.kcal : 0), 0);

  return (
    <View pointerEvents={addOpen ? 'auto' : 'none'} style={[StyleSheet.absoluteFill, { bottom: undefined, height: contentH, overflow: 'hidden', zIndex: 45 }]}>
      <Animated.View
        style={[
          { position: 'absolute', width: R * 2, height: R * 2, borderRadius: R, backgroundColor: C.bg, left: width / 2 - R, top: contentH - R },
          circle,
        ]}
      />
      <GestureDetector gesture={dismiss}>
      <Animated.View style={[styles.inner, { paddingTop: headerTop }, sheet]}>
        <Stagger i={0} addOpen={addOpen} open={open}>
          <View style={styles.grabber} accessibilityElementsHidden importantForAccessibility="no" />
          <View style={styles.titleRow}>
            <Text maxFontSizeMultiplier={DT.fixed} style={styles.title} accessibilityRole="header">Log food</Text>
            <Text maxFontSizeMultiplier={DT.list} style={[caps, { fontSize: T.label, color: C.grey }]}>{DAYS[variant].label} · 3:10 PM</Text>
          </View>
        </Stagger>

        <Stagger i={1} addOpen={addOpen} open={open}>
          <View style={styles.meals} accessibilityRole="radiogroup">
            {MEALS.map((m, i) => {
              const on = m === meal;
              return (
                <Pressable
                  key={m}
                  onPress={() => setMeal(m)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  style={[styles.meal, i > 0 && styles.mealDivider, on && { backgroundColor: C.ink }]}
                >
                  <Text maxFontSizeMultiplier={DT.strip} numberOfLines={1} adjustsFontSizeToFit style={[caps, { letterSpacing: 0.8, color: on ? C.white : C.ink }]}>{m}</Text>
                </Pressable>
              );
            })}
          </View>
        </Stagger>

        <Stagger i={2} addOpen={addOpen} open={open}>
          <View style={styles.recentHead}>
            <Text maxFontSizeMultiplier={DT.list} style={[caps, { fontSize: T.label }]}>Recent</Text>
            <Text maxFontSizeMultiplier={DT.list} style={[caps, { fontSize: T.label, color: C.grey, flexShrink: 1, textAlign: 'right' }]}>
              {addedKcal ? `+${addedKcal} kcal to ${meal.toLowerCase()}` : ''}
            </Text>
          </View>
        </Stagger>

        {RECENT_FOODS.map((f, i) => {
          const on = !!picked[i];
          return (
            <Stagger key={f.name} i={i + 3} addOpen={addOpen} open={open}>
              <View style={styles.row}>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text maxFontSizeMultiplier={DT.list} numberOfLines={2} style={styles.food}>{f.name}</Text>
                  <Text maxFontSizeMultiplier={DT.list} style={styles.macros}>
                    {f.kcal} kcal · C {f.c} · P {f.p} · F {f.f}
                  </Text>
                </View>
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync();
                    togglePick(i);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={(on ? 'Remove ' : 'Add ') + f.name}
                  hitSlop={4}
                  style={[styles.addBtn, on && { backgroundColor: C.orange }]}
                >
                  {on ? <Check /> : <Plus />}
                </Pressable>
              </View>
            </Stagger>
          );
        })}
      </Animated.View>
      </GestureDetector>
    </View>
  );
}

function Stagger({ i, addOpen, open, children }: { i: number; addOpen: boolean; open: SharedValue<number>; children: React.ReactNode }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = addOpen
      ? withDelay(180 + i * 45, withTiming(1, { duration: 500, easing: Easing.bezier(0.2, 0.8, 0.2, 1) }))
      : withTiming(0, { duration: 220 });
  }, [addOpen, i, p]);
  const st = useAnimatedStyle(() => ({ opacity: p.value * Math.min(1, open.value * 2), transform: [{ translateY: (1 - p.value) * 14 }] }));
  return <Animated.View style={st}>{children}</Animated.View>;
}

const Plus = () => (
  <View style={styles.icon}>
    <View style={{ position: 'absolute', width: 14, height: 1.6, backgroundColor: C.white }} />
    <View style={{ position: 'absolute', width: 1.6, height: 14, backgroundColor: C.white }} />
  </View>
);
const Check = () => (
  <View style={[styles.icon, { transform: [{ rotate: '-45deg' }, { translateY: -2 }] }]}>
    <View style={{ width: 13, height: 6.5, borderLeftWidth: 1.8, borderBottomWidth: 1.8, borderColor: C.white }} />
  </View>
);

const styles = StyleSheet.create({
  inner: { flex: 1, paddingTop: 56, paddingHorizontal: 20 },
  grabber: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, backgroundColor: C.grey2, marginTop: -4, marginBottom: 14 },
  titleRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, justifyContent: 'space-between', alignItems: 'baseline' },
  title: { fontFamily: F.light, fontSize: T.mid, letterSpacing: -0.5, color: C.ink },
  meals: { marginTop: 20, flexDirection: 'row', borderWidth: 1, borderColor: C.ink },
  meal: { flex: 1, height: 40, alignItems: 'center', justifyContent: 'center' },
  mealDivider: { borderLeftWidth: 1, borderLeftColor: C.ink },
  recentHead: {
    marginTop: 32, marginHorizontal: -20, paddingHorizontal: 20, paddingBottom: 8,
    borderBottomWidth: 1, borderBottomColor: C.ink, flexDirection: 'row', justifyContent: 'space-between',
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: -20, paddingHorizontal: 20,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line,
  },
  food: { fontFamily: F.medium, fontSize: T.body, color: C.ink },
  macros: { fontFamily: F.mono, fontSize: T.label, color: C.grey },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' },
  icon: { width: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
});
