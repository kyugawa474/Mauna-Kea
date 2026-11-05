import { Pressable, StyleSheet, Text, View } from 'react-native';

import { C, F } from '@/theme';

const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
type Mark = 'fuelled' | 'rode' | 'rest' | 'planned';
/** Sample-week status per day. */
const MARKS: Mark[] = ['fuelled', 'rode', 'rest', 'rode', 'planned', 'planned', 'planned'];

export function WeekStrip({ selected, onSelect }: { selected: number; onSelect?: (i: number) => void }) {
  return (
    <View style={styles.row} accessibilityLabel="This week, Monday to Sunday; the selected day is ringed">
      {LETTERS.map((l, i) => {
        const m = MARKS[i];
        const filled = m === 'rode';
        return (
          <Pressable key={i} onPress={() => onSelect?.(i)} hitSlop={4} style={styles.cell} accessibilityRole="button">
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
            <Text style={[styles.letter, { color: filled ? C.white : m === 'fuelled' ? C.orange : C.grey2 }]}>{l}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', height: 36, alignItems: 'center' },
  cell: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  sel: { position: 'absolute', width: 34.4, height: 34.4, borderRadius: 17.2, borderWidth: 1.2, borderColor: C.ink },
  mark: { position: 'absolute', width: 29, height: 29, borderRadius: 14.5 },
  letter: { fontFamily: F.monoMedium, fontSize: 10 },
});
