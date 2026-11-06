import type { ComponentRef, Ref } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { themed, useTheme } from '@/state/Theme';
import { DT, F, T, type Palette } from '@/theme';

/** "‹ Back" plus a caps title, the header of the panel's sub-views. */
export function SubHead({ title, onBack }: { title: string; onBack: () => void }) {
  const { C, caps } = useTheme();
  const s = useStyles();
  return (
    <View style={s.subHead}>
      <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back to food log" hitSlop={10}>
        <Text maxFontSizeMultiplier={DT.list} style={[caps, { fontSize: T.label }]}>‹ Back</Text>
      </Pressable>
      <Text maxFontSizeMultiplier={DT.list} numberOfLines={1} style={[caps, { color: C.grey, flexShrink: 1 }]} accessibilityRole="header">
        {title}
      </Text>
    </View>
  );
}

/** A labelled field: caps label, input on an ink rule, optional unit and error. */
export function Field({
  label, unit, error, numeric, style, inputStyle, ref, ...rest
}: TextInputProps & {
  label: string; unit?: string; error?: string; numeric?: boolean; inputStyle?: TextInputProps['style']; ref?: Ref<ComponentRef<typeof TextInput>>;
}) {
  const { C, caps } = useTheme();
  const s = useStyles();
  return (
    <View style={[{ flex: 1, minWidth: 0 }, style]}>
      <Text maxFontSizeMultiplier={DT.list} style={[caps, { color: error ? C.accentText : C.grey }]}>{label}</Text>
      <View style={[s.fieldRule, error ? { borderBottomColor: C.accentText } : null]}>
        <TextInput
          ref={ref}
          placeholderTextColor={C.grey2}
          selectionColor={C.accentText}
          maxFontSizeMultiplier={DT.list}
          accessibilityLabel={unit ? `${label}, ${unit}` : label}
          {...(numeric ? { keyboardType: 'decimal-pad' as const, selectTextOnFocus: true } : null)}
          style={[numeric ? s.numInput : s.textInput, inputStyle]}
          {...rest}
        />
        {unit ? <Text maxFontSizeMultiplier={DT.list} style={s.unit}>{unit}</Text> : null}
      </View>
      {error ? <Text maxFontSizeMultiplier={DT.list} style={s.error}>{error}</Text> : null}
    </View>
  );
}

/** Full-width ink (primary) or outlined (secondary) caps button. */
export function Button({
  label, onPress, kind = 'primary', disabled, accessibilityHint,
}: { label: string; onPress: () => void; kind?: 'primary' | 'secondary' | 'accent'; disabled?: boolean; accessibilityHint?: string }) {
  const { C, caps } = useTheme();
  const s = useStyles();
  const bg = kind === 'primary' ? C.ink : kind === 'accent' ? C.accent : 'transparent';
  const fg = kind === 'primary' ? C.paper : kind === 'accent' ? C.onAccent : C.ink;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [s.button, { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 }]}
    >
      <Text maxFontSizeMultiplier={DT.strip} numberOfLines={1} adjustsFontSizeToFit style={[caps, { color: fg, letterSpacing: 1 }]}>{label}</Text>
    </Pressable>
  );
}

/** The round ✕ used to remove a row. */
export function RemoveButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { C } = useTheme();
  const s = useStyles();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={6} style={s.remove}>
      <View style={{ position: 'absolute', width: 12, height: 1.4, backgroundColor: C.ink, transform: [{ rotate: '45deg' }] }} />
      <View style={{ position: 'absolute', width: 12, height: 1.4, backgroundColor: C.ink, transform: [{ rotate: '-45deg' }] }} />
    </Pressable>
  );
}

/** Parse a typed number: '' → null, otherwise a finite non-negative number or NaN. */
export function parseNum(s: string): number | null {
  const t = s.trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}

/** Show a number in an input: whole numbers plain, otherwise one decimal. */
export const fmtNum = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export const useStyles = themed((C: Palette) => StyleSheet.create({
  subHead: {
    marginTop: 20, marginHorizontal: -20, paddingHorizontal: 20, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: C.ink,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 16,
  },
  fieldRule: { flexDirection: 'row', alignItems: 'baseline', borderBottomWidth: 1, borderBottomColor: C.ink, marginTop: 4 },
  textInput: { flex: 1, fontFamily: F.medium, fontSize: T.body, color: C.ink, paddingVertical: 8 },
  numInput: { flex: 1, minWidth: 0, fontFamily: F.light, fontSize: T.mid, letterSpacing: -0.5, color: C.ink, paddingVertical: 4 },
  unit: { fontFamily: F.mono, fontSize: T.label, color: C.grey, marginLeft: 4 },
  error: { fontFamily: F.mono, fontSize: T.label, color: C.accentText, marginTop: 4 },
  button: { height: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.ink, paddingHorizontal: 12 },
  remove: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: C.ink, alignItems: 'center', justifyContent: 'center' },
}));
