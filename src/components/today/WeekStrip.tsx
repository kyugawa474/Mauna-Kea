import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useApp, type DayLog } from '@/state/AppState';
import { themed, useTheme } from '@/state/Theme';
import { DT, F, T, px, type Palette } from '@/theme';

const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const LOG_LABEL: Record<DayLog, string> = { none: 'nothing logged', meal: 'meal logged', active: 'activity logged' };

/**
 * The week, one mark per day:
 *   no circle  – nothing logged
 *   outlined   – a meal logged, no activity
 *   filled     – an activity logged (with or without a meal)
 * The selected day carries a thin ring around its mark.
 */
export function WeekStrip({ selected, onSelect }: { selected: number; onSelect?: (i: number) => void }) {
  const { C } = useTheme();
  const { weekLog } = useApp();
  const styles = useStyles();
  return (
    <View style={styles.row}>
      {LETTERS.map((l, i) => {
        const log = weekLog[i];
        return (
          <Pressable
            key={i}
            onPress={() => onSelect?.(i)}
            hitSlop={4}
            style={styles.cell}
            accessibilityRole="button"
            accessibilityLabel={`${NAMES[i]}, ${LOG_LABEL[log]}`}
            accessibilityState={{ selected: i === selected }}
          >
            {i === selected && <View style={styles.sel} />}
            <View
              style={[
                styles.mark,
                log === 'meal' && { borderWidth: 1.5, borderColor: C.accent },
                log === 'active' && { backgroundColor: C.accent },
              ]}
            />
            <Text
              maxFontSizeMultiplier={DT.strip}
              style={[styles.letter, { color: log === 'active' ? C.onAccent : log === 'meal' ? C.accentText : C.grey }]}
            >
              {l}
            </Text>
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
