import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { ActionSheetIOS, Alert, Keyboard, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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

import { ManualEntry } from '@/components/food/ManualEntry';
import { PhotoReview, type PickedPhoto } from '@/components/food/PhotoReview';
import { RemoveButton } from '@/components/food/ui';
import { DAYS } from '@/data/sample';
import { MEALS, useApp } from '@/state/AppState';
import { themed, useTheme } from '@/state/Theme';
import { DT, F, useLayout, T, type Palette } from '@/theme';

/**
 * "Bloom" food log: a circle grows out of the + button, then rows stagger in. Each tab screen
 * renders one, so it covers the screen under the floating tab bar and the + (now ✕) stays on top.
 *
 * Three views share the header and meal selector: the list (Manual / Camera, Recent, Logged),
 * manual entry, and the photo review. Logged foods persist on device (src/lib/foodLog.ts).
 */
export function AddPanel() {
  const { width, height, headerTop } = useLayout();
  const { addOpen, setAddOpen, meal, setMeal, picked, togglePick, variant, recents, entries, logFoods, removeEntry } = useApp();
  const { C, caps } = useTheme();
  const styles = useStyles();
  const open = useSharedValue(0);
  const [mode, setMode] = useState<Mode>({ kind: 'list' });
  const [flash, setFlash] = useState('');

  // Swipe down on the header to dismiss, like an iOS sheet. Closing logs what was ticked (same as ✕).
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
    // Each opening starts on the list; a half-finished form or review is dropped on close.
    if (!addOpen) {
      Keyboard.dismiss();
      const t = setTimeout(() => {
        setMode({ kind: 'list' });
        setFlash('');
      }, 450);
      return () => clearTimeout(t);
    }
  }, [addOpen, open]);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(''), 4000);
    return () => clearTimeout(t);
  }, [flash]);

  // The + is the prominent tab at the bar's trailing end; the bloom grows from its centre.
  const ox = width - FAB_INSET;
  const oy = height - FAB_INSET;
  const R = Math.hypot(ox, oy) + 40;
  const circle = useAnimatedStyle(() => ({ transform: [{ scale: open.value }] }));

  const addedKcal = recents.reduce((n, f) => n + (picked[f.name] ? f.kcal : 0), 0);
  const loggedKcal = Math.round(entries.reduce((n, e) => n + e.kcal, 0));

  const done = (what: string) => {
    setMode({ kind: 'list' });
    setFlash(`Logged ${what} to ${meal.toLowerCase()}`);
  };

  const pickPhoto = async (source: 'camera' | 'library') => {
    try {
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Camera access is off', 'Allow camera access in Settings, or choose a photo from your library.');
          return;
        }
      }
      const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1, allowsEditing: false, exif: false };
      const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      if (res.canceled || !res.assets?.[0]) return;
      const a = res.assets[0];
      setMode({ kind: 'photo', photo: { uri: a.uri, width: a.width, height: a.height }, n: Date.now() });
    } catch {
      Alert.alert(
        source === 'camera' ? 'Camera unavailable' : 'Couldn’t open photos',
        source === 'camera' ? 'This device has no camera available. Choose a photo from your library instead.' : 'Try again.',
      );
    }
  };

  const chooseCamera = () => {
    Haptics.selectionAsync();
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Take photo', 'Choose from library', 'Cancel'], cancelButtonIndex: 2, title: `Photo of your ${meal.toLowerCase()}` },
        (i) => {
          if (i === 0) pickPhoto('camera');
          else if (i === 1) pickPhoto('library');
        },
      );
    } else {
      Alert.alert('Add a photo', undefined, [
        { text: 'Take photo', onPress: () => pickPhoto('camera') },
        { text: 'Choose from library', onPress: () => pickPhoto('library') },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  return (
    <View pointerEvents={addOpen ? 'auto' : 'none'} style={[StyleSheet.absoluteFill, { overflow: 'hidden', zIndex: 45 }]}>
      <Animated.View
        style={[
          { position: 'absolute', width: R * 2, height: R * 2, borderRadius: R, backgroundColor: C.bg, left: ox - R, top: oy - R },
          circle,
        ]}
      />
      <Animated.View style={[styles.inner, { paddingTop: headerTop }, sheet]}>
        <GestureDetector gesture={dismiss}>
          <View collapsable={false}>
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
                      <Text maxFontSizeMultiplier={DT.strip} numberOfLines={1} adjustsFontSizeToFit style={[caps, { letterSpacing: 0.8, color: on ? C.paper : C.ink }]}>{m}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </Stagger>
          </View>
        </GestureDetector>

        {mode.kind === 'manual' && (
          <ManualEntry
            meal={meal}
            onBack={() => setMode({ kind: 'list' })}
            onSave={async (food) => {
              await logFoods([food], 'manual');
              done(food.name);
            }}
          />
        )}

        {mode.kind === 'photo' && (
          <PhotoReview
            key={mode.n}
            photo={mode.photo}
            meal={meal}
            onBack={() => setMode({ kind: 'list' })}
            onRetake={chooseCamera}
            onManual={() => setMode({ kind: 'manual' })}
            onLog={async (foods) => {
              await logFoods(foods, 'photo');
              done(foods.length === 1 ? foods[0].name : `${foods.length} items`);
            }}
          />
        )}

        {mode.kind === 'list' && (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
            <Stagger i={2} addOpen={addOpen} open={open}>
              <View style={styles.entry}>
                <EntryButton label="Manual" hint="Type a food's kcal and macros" onPress={() => setMode({ kind: 'manual' })} />
                <EntryButton label="Camera" hint="Estimate from a photo of your meal" accent onPress={chooseCamera} />
              </View>
              {flash ? (
                <Text maxFontSizeMultiplier={DT.list} style={[caps, styles.flash]} accessibilityLiveRegion="polite" accessibilityRole="alert">
                  {flash}
                </Text>
              ) : null}
            </Stagger>

            <Stagger i={3} addOpen={addOpen} open={open}>
              <View style={styles.recentHead}>
                <Text maxFontSizeMultiplier={DT.list} style={[caps, { fontSize: T.label }]}>Recent</Text>
                <Text maxFontSizeMultiplier={DT.list} style={[caps, { fontSize: T.label, color: C.grey, flexShrink: 1, textAlign: 'right' }]}>
                  {addedKcal ? `+${Math.round(addedKcal)} kcal to ${meal.toLowerCase()}` : ''}
                </Text>
              </View>
            </Stagger>

            {recents.map((f, i) => {
              const on = !!picked[f.name];
              return (
                <Stagger key={f.name} i={Math.min(i + 4, 12)} addOpen={addOpen} open={open}>
                  <View style={styles.row}>
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text maxFontSizeMultiplier={DT.list} numberOfLines={2} style={styles.food}>{f.name}</Text>
                      <Text maxFontSizeMultiplier={DT.list} style={styles.macros}>
                        {Math.round(f.kcal)} kcal · C {f.carbs} · P {f.protein} · F {f.fat}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => {
                        Haptics.selectionAsync();
                        togglePick(f.name);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={(on ? 'Remove ' : 'Add ') + f.name}
                      hitSlop={4}
                      style={[styles.addBtn, on && { backgroundColor: C.accent }]}
                    >
                      {on ? <Check /> : <Plus />}
                    </Pressable>
                  </View>
                </Stagger>
              );
            })}

            {entries.length > 0 && (
              <Stagger i={Math.min(recents.length + 4, 13)} addOpen={addOpen} open={open}>
                <View style={[styles.recentHead, { marginTop: 36 }]}>
                  <Text maxFontSizeMultiplier={DT.list} style={[caps, { fontSize: T.label }]}>Logged</Text>
                  <Text maxFontSizeMultiplier={DT.list} style={[caps, { fontSize: T.label, color: C.grey }]}>{loggedKcal} kcal</Text>
                </View>
                {entries.map((e) => (
                  <View key={e.id} style={styles.row}>
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text maxFontSizeMultiplier={DT.list} numberOfLines={2} style={styles.food}>{e.name}</Text>
                      <Text maxFontSizeMultiplier={DT.list} style={styles.macros}>
                        {e.meal} · {Math.round(e.kcal)} kcal · C {e.carbs} · P {e.protein} · F {e.fat}{e.source === 'photo' ? ' · est.' : ''}
                      </Text>
                    </View>
                    <RemoveButton
                      label={`Delete ${e.name} from ${e.meal}`}
                      onPress={() =>
                        Alert.alert(`Delete ${e.name}?`, `${Math.round(e.kcal)} kcal from ${e.meal.toLowerCase()}.`, [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Delete', style: 'destructive', onPress: () => removeEntry(e.id) },
                        ])
                      }
                    />
                  </View>
                ))}
              </Stagger>
            )}
          </ScrollView>
        )}
      </Animated.View>
    </View>
  );
}

type Mode = { kind: 'list' } | { kind: 'manual' } | { kind: 'photo'; photo: PickedPhoto; n: number };

/** One of the two ways in: Manual (outlined ink) and Camera (the accent). */
function EntryButton({ label, hint, accent, onPress }: { label: string; hint: string; accent?: boolean; onPress: () => void }) {
  const { C, caps } = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityHint={hint}
      style={({ pressed }) => [styles.entryBtn, accent && { backgroundColor: C.accent }, pressed && { opacity: 0.7 }]}
    >
      {accent ? <CameraGlyph /> : <PenGlyph />}
      <Text maxFontSizeMultiplier={DT.strip} numberOfLines={1} style={[caps, { letterSpacing: 1, color: accent ? C.onAccent : C.ink }]}>{label}</Text>
    </Pressable>
  );
}

/** A line-drawn camera body and lens, in the panel's 1.6pt stroke. */
function CameraGlyph() {
  const { C } = useTheme();
  return (
    <View style={{ width: 18, height: 14, alignItems: 'center', justifyContent: 'flex-end' }} accessibilityElementsHidden importantForAccessibility="no">
      <View style={{ position: 'absolute', top: 0, width: 7, height: 3, borderTopLeftRadius: 1, borderTopRightRadius: 1, backgroundColor: C.onAccent }} />
      <View style={{ width: 18, height: 12, borderRadius: 2, borderWidth: 1.6, borderColor: C.onAccent, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 6, height: 6, borderRadius: 3, borderWidth: 1.6, borderColor: C.onAccent }} />
      </View>
    </View>
  );
}

/** Three short rules, like lines on a form. */
function PenGlyph() {
  const { C } = useTheme();
  return (
    <View style={{ width: 16, gap: 3 }} accessibilityElementsHidden importantForAccessibility="no">
      <View style={{ height: 1.6, backgroundColor: C.ink }} />
      <View style={{ height: 1.6, width: 11, backgroundColor: C.ink }} />
      <View style={{ height: 1.6, backgroundColor: C.ink }} />
    </View>
  );
}

/** Distance from the screen's trailing and bottom edges to the + button's centre (pt, measured on an iPhone 18 Pro). */
const FAB_INSET = 53;

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

function Plus() {
  const { C } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.icon}>
      <View style={{ position: 'absolute', width: 14, height: 1.6, backgroundColor: C.paper }} />
      <View style={{ position: 'absolute', width: 1.6, height: 14, backgroundColor: C.paper }} />
    </View>
  );
}
function Check() {
  const { C } = useTheme();
  const styles = useStyles();
  // On the orange (picked) button: dark in both schemes.
  return (
    <View style={[styles.icon, { transform: [{ rotate: '-45deg' }, { translateY: -2 }] }]}>
      <View style={{ width: 13, height: 6.5, borderLeftWidth: 1.8, borderBottomWidth: 1.8, borderColor: C.onAccent }} />
    </View>
  );
}

const useStyles = themed((C: Palette) => StyleSheet.create({
  inner: { flex: 1, paddingTop: 56, paddingHorizontal: 20 },
  grabber: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, backgroundColor: C.grey2, marginTop: -4, marginBottom: 14 },
  titleRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, justifyContent: 'space-between', alignItems: 'baseline' },
  title: { fontFamily: F.light, fontSize: T.mid, letterSpacing: -0.5, color: C.ink },
  meals: { marginTop: 20, flexDirection: 'row', borderWidth: 1, borderColor: C.ink },
  meal: { flex: 1, height: 40, alignItems: 'center', justifyContent: 'center' },
  mealDivider: { borderLeftWidth: 1, borderLeftColor: C.ink },
  entry: { marginTop: 14, flexDirection: 'row', gap: 10 },
  entryBtn: {
    flex: 1, height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    borderWidth: 1, borderColor: C.ink,
  },
  flash: { marginTop: 12, color: C.accentText },
  recentHead: {
    marginTop: 28, marginHorizontal: -20, paddingHorizontal: 20, paddingBottom: 8,
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
}));
