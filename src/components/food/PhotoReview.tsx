import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Field, RemoveButton, SubHead, fmtNum, parseNum } from '@/components/food/ui';
import { PhotoError, analyzePhoto, preparePhoto, type PhotoErrorCode } from '@/lib/foodApi';
import { sumTotals, type Confidence, type FoodInput } from '@/lib/nutrition';
import { themed, useTheme } from '@/state/Theme';
import { DT, F, T, type Palette } from '@/theme';

export interface PickedPhoto {
  uri: string;
  width: number;
  height: number;
}

type NumKey = 'grams' | 'kcal' | 'carbs' | 'protein' | 'fat';
interface Item {
  key: string;
  name: string;
  confidence: Confidence;
  /** What's typed in each number field. */
  text: Record<NumKey, string>;
  /** The model's estimate per gram, so changing the portion rescales kcal and macros. */
  perGram: Record<Exclude<NumKey, 'grams'>, number> | null;
}

type State =
  | { phase: 'loading'; step: 'prepare' | 'estimate' }
  | { phase: 'review'; items: Item[]; notes: string }
  | { phase: 'error'; code: PhotoErrorCode; message: string };

const MACROS = ['kcal', 'carbs', 'protein', 'fat'] as const;
/** Same per-entry limits as manual entry, so a slip of the keypad can't log 20,000 kcal. */
const LIMIT: Record<NumKey, number> = { grams: 5000, kcal: 5000, carbs: 1000, protein: 1000, fat: 1000 };
const invalid = (i: Item, k: NumKey) => {
  const n = parseNum(i.text[k]) ?? 0;
  return Number.isNaN(n) || n > LIMIT[k];
};
const CONF_LABEL: Record<Confidence, string> = { high: 'High', medium: 'Med', low: 'Low' };

/** Item fields → a loggable food, or null if any number is invalid. */
function toFood(i: Item): FoodInput | null {
  if ((['grams', ...MACROS] as NumKey[]).some((k) => invalid(i, k))) return null;
  const n = MACROS.map((k) => parseNum(i.text[k]) ?? 0);
  const [kcal, carbs, protein, fat] = n;
  return { name: i.name.trim() || 'Food', kcal: Math.round(kcal), carbs, protein, fat };
}

/** Downscale, upload and turn the estimate into editable items (or an error state). */
async function estimate(photo: PickedPhoto, onUpload: () => void): Promise<State> {
  try {
    const { base64 } = await preparePhoto(photo.uri, photo.width, photo.height);
    onUpload();
    const res = await analyzePhoto(base64);
    return {
      phase: 'review',
      notes: res.notes,
      items: res.items.map((it, idx) => ({
        key: `${idx}-${it.name}`,
        name: it.name,
        confidence: it.confidence,
        text: { grams: fmtNum(it.grams), kcal: fmtNum(it.kcal), carbs: fmtNum(it.carbs), protein: fmtNum(it.protein), fat: fmtNum(it.fat) },
        perGram: it.grams > 0
          ? { kcal: it.kcal / it.grams, carbs: it.carbs / it.grams, protein: it.protein / it.grams, fat: it.fat / it.grams }
          : null,
      })),
    };
  } catch (e) {
    const err = e instanceof PhotoError ? e : new PhotoError('upstream', 'Something went wrong estimating that photo.');
    return { phase: 'error', code: err.code, message: err.message };
  }
}

/**
 * The camera flow after a photo is picked: downscale → POST to /api/food/analyze → an editable
 * review list. Nothing is logged until the user confirms.
 */
export function PhotoReview({
  photo, meal, onBack, onRetake, onManual, onLog,
}: {
  photo: PickedPhoto;
  meal: string;
  onBack: () => void;
  onRetake: () => void;
  onManual: () => void;
  onLog: (foods: FoodInput[]) => Promise<void>;
}) {
  const { C, caps } = useTheme();
  const s = useStyles();
  const [state, setState] = useState<State>({ phase: 'loading', step: 'prepare' });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    estimate(photo, () => live && setState({ phase: 'loading', step: 'estimate' })).then((st) => live && setState(st));
    return () => {
      live = false;
    };
  }, [photo, attempt]);

  const retry = () => {
    setState({ phase: 'loading', step: 'prepare' });
    setAttempt((n) => n + 1);
  };

  const update = (key: string, fn: (i: Item) => Item) =>
    setState((st) => (st.phase === 'review' ? { ...st, items: st.items.map((i) => (i.key === key ? fn(i) : i)) } : st));

  const setNum = (key: string, field: NumKey, t: string) =>
    update(key, (i) => {
      const text = { ...i.text, [field]: t };
      // A new portion rescales the macros from the model's per-gram estimate.
      const g = parseNum(t);
      if (field === 'grams' && i.perGram && g !== null && !Number.isNaN(g)) {
        for (const k of MACROS) {
          const v = i.perGram[k] * g;
          text[k] = fmtNum(k === 'kcal' ? Math.round(v) : Math.round(v * 10) / 10);
        }
      }
      return { ...i, text };
    });

  const remove = (key: string) =>
    setState((st) => (st.phase === 'review' ? { ...st, items: st.items.filter((i) => i.key !== key) } : st));

  const review = state.phase === 'review' ? state : null;
  const foods = review ? review.items.map(toFood) : [];
  const valid = foods.every((f): f is FoodInput => f !== null);
  const totals = sumTotals(valid ? (foods as FoodInput[]) : []);

  const confirm = async () => {
    if (!review || !valid || !foods.length) return;
    setSaving(true);
    setSaveError('');
    try {
      await onLog(foods as FoodInput[]);
    } catch {
      setSaveError('Couldn’t save. Try again.');
      setSaving(false);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: 160 }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      automaticallyAdjustKeyboardInsets
    >
      <SubHead title={`Photo · ${meal}`} onBack={onBack} />

      <View style={s.photoRow}>
        <Image source={{ uri: photo.uri }} style={s.thumb} accessibilityIgnoresInvertColors accessibilityLabel="Your meal photo" />
        <View style={{ flex: 1, gap: 6 }}>
          {state.phase === 'loading' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }} accessibilityLiveRegion="polite">
              <ActivityIndicator color={C.ink} />
              <Text maxFontSizeMultiplier={DT.list} style={[caps]}>{state.step === 'prepare' ? 'Preparing photo…' : 'Estimating…'}</Text>
            </View>
          )}
          {review && (
            <>
              <Text maxFontSizeMultiplier={DT.list} style={s.total} accessibilityLabel={`Total ${totals.kcal} kilocalories`}>
                {valid ? totals.kcal : '—'}<Text style={s.totalUnit}> kcal</Text>
              </Text>
              <Text maxFontSizeMultiplier={DT.list} style={s.mono}>
                {valid ? `C ${fmtNum(totals.carbs)} · P ${fmtNum(totals.protein)} · F ${fmtNum(totals.fat)}` : 'Fix the highlighted numbers'}
              </Text>
            </>
          )}
          {state.phase === 'error' && (
            <Text maxFontSizeMultiplier={DT.list} style={[caps, { color: C.accentText }]} accessibilityRole="alert">
              {state.code === 'not_configured' ? 'Not set up' : state.code === 'no_food' ? 'No food found' : 'Couldn’t estimate'}
            </Text>
          )}
        </View>
      </View>

      {state.phase === 'error' && (
        <View style={{ gap: 12, marginTop: 8 }}>
          <Text maxFontSizeMultiplier={DT.list} style={s.body}>{state.message}</Text>
          {(['network', 'timeout', 'upstream', 'rate_limited'] as PhotoErrorCode[]).includes(state.code) && (
            <Button label="Try again" onPress={retry} />
          )}
          <Button label="Choose another photo" kind="secondary" onPress={onRetake} />
          <Button label="Log manually" kind="secondary" onPress={onManual} />
        </View>
      )}

      {review && (
        <>
          <View style={s.caveat}>
            <Text maxFontSizeMultiplier={DT.list} style={[s.mono, { color: C.ink }]}>
              Estimates. Mixed dishes are often off by 20–30%, so check each portion before logging.
            </Text>
            {review.notes ? <Text maxFontSizeMultiplier={DT.list} style={[s.mono, { marginTop: 6 }]}>{review.notes}</Text> : null}
          </View>

          <View style={s.listHead}>
            <Text maxFontSizeMultiplier={DT.list} style={caps}>{review.items.length} {review.items.length === 1 ? 'item' : 'items'}</Text>
            <Text maxFontSizeMultiplier={DT.list} style={[caps, { color: C.grey }]}>Confidence</Text>
          </View>

          {review.items.map((i) => {
            const bad = (k: NumKey) => (invalid(i, k) ? 'Check' : undefined);
            return (
              <View key={i.key} style={s.item}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12 }}>
                  <Field label="Item" value={i.name} onChangeText={(t) => update(i.key, (x) => ({ ...x, name: t }))} maxLength={80} />
                  <Text
                    maxFontSizeMultiplier={DT.list}
                    style={[caps, s.conf, i.confidence === 'low' && { color: C.accentText, borderColor: C.accentText }]}
                    accessibilityLabel={`${i.confidence} confidence`}
                  >
                    {CONF_LABEL[i.confidence]}
                  </Text>
                  <RemoveButton label={`Remove ${i.name}`} onPress={() => remove(i.key)} />
                </View>
                <View style={s.nums}>
                  <Field label="Portion" unit="g" numeric value={i.text.grams} onChangeText={(t) => setNum(i.key, 'grams', t)} error={bad('grams')} inputStyle={s.small} />
                  <Field label="kcal" numeric value={i.text.kcal} onChangeText={(t) => setNum(i.key, 'kcal', t)} error={bad('kcal')} inputStyle={s.small} />
                  <Field label="C" unit="g" numeric value={i.text.carbs} onChangeText={(t) => setNum(i.key, 'carbs', t)} error={bad('carbs')} inputStyle={s.small} />
                  <Field label="P" unit="g" numeric value={i.text.protein} onChangeText={(t) => setNum(i.key, 'protein', t)} error={bad('protein')} inputStyle={s.small} />
                  <Field label="F" unit="g" numeric value={i.text.fat} onChangeText={(t) => setNum(i.key, 'fat', t)} error={bad('fat')} inputStyle={s.small} />
                </View>
              </View>
            );
          })}

          <View style={{ gap: 12, marginTop: 20 }}>
            {saveError ? <Text style={[caps, { color: C.accentText }]}>{saveError}</Text> : null}
            {review.items.length ? (
              <Button
                label={saving ? 'Saving…' : `Log ${review.items.length} to ${meal} · ${valid ? totals.kcal : '—'} kcal`}
                onPress={confirm}
                disabled={saving || !valid}
              />
            ) : (
              <Text maxFontSizeMultiplier={DT.list} style={s.body}>Everything was removed. Retake the photo or log it manually.</Text>
            )}
            <Button label="Retake" kind="secondary" onPress={onRetake} />
          </View>
        </>
      )}
    </ScrollView>
  );
}

const useStyles = themed((C: Palette) => StyleSheet.create({
  photoRow: { flexDirection: 'row', gap: 16, alignItems: 'center', marginTop: 20, marginBottom: 12 },
  thumb: { width: 88, height: 88, backgroundColor: C.tile },
  total: { fontFamily: F.light, fontSize: T.head, letterSpacing: -1, color: C.ink },
  totalUnit: { fontFamily: F.mono, fontSize: T.label, color: C.grey, letterSpacing: 1 },
  mono: { fontFamily: F.mono, fontSize: T.label, color: C.grey, lineHeight: 16 },
  body: { fontFamily: F.medium, fontSize: T.body, color: C.ink, lineHeight: 22 },
  caveat: { borderLeftWidth: 2, borderLeftColor: C.accent, paddingLeft: 12, paddingVertical: 4, marginTop: 4 },
  listHead: {
    marginTop: 24, marginHorizontal: -20, paddingHorizontal: 20, paddingBottom: 8,
    borderBottomWidth: 1, borderBottomColor: C.ink, flexDirection: 'row', justifyContent: 'space-between',
  },
  item: { marginHorizontal: -20, paddingHorizontal: 20, paddingVertical: 14, gap: 14, borderBottomWidth: 1, borderBottomColor: C.line },
  conf: { borderWidth: 1, borderColor: C.ink, paddingHorizontal: 6, paddingVertical: 3, marginBottom: 6, overflow: 'hidden' },
  nums: { flexDirection: 'row', gap: 10 },
  small: { fontSize: T.body, fontFamily: F.mono, letterSpacing: 0 },
}));
