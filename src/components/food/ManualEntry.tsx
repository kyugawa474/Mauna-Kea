import { useRef, useState, type ComponentRef } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';

import { Button, Field, NumpadDone, SubHead, parseNum } from '@/components/food/ui';
import type { FoodInput } from '@/lib/nutrition';
import { useTheme } from '@/state/Theme';
import { DT, F, T } from '@/theme';

type Key = 'name' | 'kcal' | 'carbs' | 'protein' | 'fat';
type Errors = Partial<Record<Key | 'form', string>>;

const MAX_KCAL = 5000;
const MAX_G = 1000;

/** Validate the form. Blank kcal is worked out from the macros (4 · 4 · 9 kcal per gram). */
export function validateManual(v: Record<Key, string>): { food?: FoodInput; errors: Errors } {
  const errors: Errors = {};
  const name = v.name.trim();
  if (!name) errors.name = 'Name the food';
  else if (name.length > 80) errors.name = 'Keep it under 80 characters';

  const grams: Partial<Record<'carbs' | 'protein' | 'fat', number>> = {};
  for (const k of ['carbs', 'protein', 'fat'] as const) {
    const n = parseNum(v[k]);
    if (n === null) continue;
    if (Number.isNaN(n)) errors[k] = 'Not a number';
    else if (n > MAX_G) errors[k] = `Max ${MAX_G} g`;
    else grams[k] = n;
  }
  const carbs = grams.carbs ?? 0, protein = grams.protein ?? 0, fat = grams.fat ?? 0;

  let kcal = parseNum(v.kcal);
  if (kcal === null) {
    if (carbs + protein + fat > 0) kcal = Math.round(carbs * 4 + protein * 4 + fat * 9);
    else errors.kcal = 'Enter kcal or macros';
  } else if (Number.isNaN(kcal)) errors.kcal = 'Not a number';
  else if (kcal <= 0) errors.kcal = 'Must be more than 0';
  else if (kcal > MAX_KCAL) errors.kcal = `Max ${MAX_KCAL} per entry`;

  if (Object.keys(errors).length || kcal === null) return { errors };
  return { errors, food: { name, kcal: Math.round(kcal), carbs, protein, fat } };
}

export function ManualEntry({ meal, onBack, onSave }: { meal: string; onBack: () => void; onSave: (food: FoodInput) => Promise<void> }) {
  const { C, caps } = useTheme();
  const [v, setV] = useState<Record<Key, string>>({ name: '', kcal: '', carbs: '', protein: '', fat: '' });
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const kcalRef = useRef<ComponentRef<typeof TextInput>>(null);

  const set = (k: Key) => (t: string) => {
    setV((p) => ({ ...p, [k]: t }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const auto = parseNum(v.kcal) === null ? validateManual({ ...v, name: v.name || 'x' }).food?.kcal : undefined;

  const save = async () => {
    const r = validateManual(v);
    setErrors(r.errors);
    if (!r.food) return;
    setSaving(true);
    try {
      await onSave(r.food);
    } catch {
      setErrors({ form: 'Couldn’t save. Try again.' });
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
      <SubHead title={`Manual · ${meal}`} onBack={onBack} />
      <View style={{ marginTop: 20, gap: 22 }}>
        <Field
          label="Food"
          placeholder="e.g. Banana bread"
          value={v.name}
          onChangeText={set('name')}
          error={errors.name}
          autoFocus
          autoCapitalize="sentences"
          returnKeyType="next"
          onSubmitEditing={() => kcalRef.current?.focus()}
          submitBehavior="submit"
          maxLength={80}
        />
        <Field
          ref={kcalRef}
          label="Energy"
          unit="kcal"
          numeric
          placeholder={auto ? String(auto) : '0'}
          value={v.kcal}
          onChangeText={set('kcal')}
          error={errors.kcal}
        />
        <View style={{ flexDirection: 'row', gap: 16 }}>
          <Field label="Carbs" unit="g" numeric placeholder="0" value={v.carbs} onChangeText={set('carbs')} error={errors.carbs} />
          <Field label="Protein" unit="g" numeric placeholder="0" value={v.protein} onChangeText={set('protein')} error={errors.protein} />
          <Field label="Fat" unit="g" numeric placeholder="0" value={v.fat} onChangeText={set('fat')} error={errors.fat} />
        </View>
        <Text maxFontSizeMultiplier={DT.list} style={{ fontFamily: F.mono, fontSize: T.label, color: C.grey, lineHeight: 16 }}>
          {auto ? `Blank kcal: ${auto} from the macros (4 · 4 · 9 per gram).` : 'Leave kcal blank to work it out from the macros.'}
        </Text>
        {errors.form ? <Text style={[caps, { color: C.accentText }]}>{errors.form}</Text> : null}
        <Button label={saving ? 'Saving…' : `Log to ${meal}`} onPress={save} disabled={saving} />
      </View>
      <NumpadDone />
    </ScrollView>
  );
}
