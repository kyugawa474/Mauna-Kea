import { Pressable, StyleSheet, Text, View } from 'react-native';

import { themed, useTheme } from '@/state/Theme';
import { DT, F, T, px, type Palette } from '@/theme';

const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
type Mark = 'fuelled' | 'rode' | 'rest' | 'planned';
const MARK_LABEL: Record<Mark, string> = { fuelled: 'fuelled', rode: 'rode', rest: 'rest day', planned: 'planned' };
/** Sample-week status per day. */
const MARKS: Mark[] = ['fuelled', 'rode', 'rest', 'rode', 'planned', 'planned', 'planned'];

export function WeekStrip({ selected, onSelect }: { selected: number; onSelect?: (i: number) => void }) {
  const { C } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.row}>
      {LETTERS.map((l, i) => {
        const m = MARKS[i];
        const filled = m === 'rode';
        return (
          <Pressable
            key={i}
            onPress={() => onSelect?.(i)}
            hitSlop={4}
            style={styles.cell}
            accessibilityRole="button"
            accessibilityLabel={`${NAMES[i]}, ${MARK_LABEL[m]}`}
            accessibilityState={{ selected: i === selected }}
          >
            {i === selected && <View style={styles.sel} />}
            <View
              style={[
                styles.mark,
                m === 'fuelled' && { borderWidth: 1.5, borderColor: C.orange },
                filled && { backgroundColor: C.orange },
                m === 'rest' && { borderWidth: 1.2, borderColor: C.grey2, borderStyle: 'dashed' },
                m === 'planned' && { borderWidth: 1.2, borderColor: C.line },
              ]}
            />
            <Text maxFontSizeMultiplier={DT.strip} style={[styles.letter, { color: filled ? C.onOrange : m === 'fuelled' ? C.orangeText : C.grey }]}>{l}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// Whole-pixel sizes, each circle placed explicitly at the cell's centre: the old 34.4/29/1.2pt
// sizes rounded unevenly on 3x screens and left the selected ring ~0.5pt off centre.
const CELL = 36;
const SEL = 34;
const MARK = 28;
const ring = (d: number) => ({ position: 'absolute' as const, width: d, height: d, borderRadius: d / 2, top: (CELL - d) / 2, left: (CELL - d) / 2 });

const useStyles = themed((C: Palette) => StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', height: CELL, alignItems: 'center' },
  cell: { width: CELL, height: CELL, alignItems: 'center', justifyContent: 'center' },
  sel: { ...ring(SEL), borderWidth: px(1.25), borderColor: C.ink },
  mark: ring(MARK),
  letter: { fontFamily: F.monoMedium, fontSize: T.label },
}));
