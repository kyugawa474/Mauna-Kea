import { Canvas, Group, Line, Path, Rect, Skia, vec } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

import { WEEKS, type Week } from '@/data/sample';
import { C, F } from '@/theme';

const CHART_H = 150;
const PAD = 1.5;

const easeOut = (t: number) => {
  'worklet';
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  return 1 - Math.pow(1 - c, 4);
};

/**
 * Weekly kJ vs target. Pages snap to: start of block → this block → the plan ahead,
 * with the next week peeking in so it reads as swipeable without instruction text.
 */
export function WeeklyBars({ width, clock }: { width: number; clock: SharedValue<number> }) {
  const col = width * 0.116;
  const total = col * WEEKS.length;
  const current = WEEKS.findIndex((w) => w.kind === 'current');
  const planStart = current + 1;
  const offsets = [0, col, Math.min(col * planStart, total - width)];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToOffsets={offsets}
      decelerationRate="fast"
      disableIntervalMomentum
      contentOffset={{ x: col, y: 0 }}
      style={{ marginHorizontal: -20 }}
      contentContainerStyle={{ paddingHorizontal: 20 }}
      accessibilityLabel="Weekly kilojoules versus target from Aug 24 to Dec 7"
    >
      <View style={{ width: total }}>
        <Canvas style={{ width: total, height: CHART_H + 4 }}>
          {WEEKS.map((w, i) => (
            <Bar key={w.label} w={w} i={i} x={i * col} colW={col} clock={clock} />
          ))}
          <Line p1={vec(0, CHART_H + 3.5)} p2={vec(total, CHART_H + 3.5)} color={C.ink} strokeWidth={1} />
        </Canvas>
        <View style={{ flexDirection: 'row', marginTop: 8 }}>
          {WEEKS.map((w) => (
            <Text
              key={w.label}
              style={{
                width: col, textAlign: 'center', fontFamily: F.mono, fontSize: 10,
                color: w.kind === 'current' ? C.ink : w.kind === 'plan' ? C.grey2 : C.grey,
              }}
            >
              {w.label}
            </Text>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

function hatch(x: number, w: number, period: number) {
  const p = Skia.PathBuilder.Make();
  for (let o = -CHART_H; o < w + CHART_H; o += period) {
    p.moveTo(x + o, CHART_H);
    p.lineTo(x + o + CHART_H, 0);
  }
  return p.detach();
}

function Bar({ w, i, x, colW, clock }: { w: Week; i: number; x: number; colW: number; clock: SharedValue<number> }) {
  const bx = x + PAD;
  const bw = colW - PAD * 2;
  const stripes = useMemo(() => hatch(bx, bw, w.kind === 'past' ? 4.5 * Math.SQRT2 : 6 * Math.SQRT2), [bx, bw, w.kind]);

  const grow = useDerivedValue(() => easeOut((clock.value - (150 + i * 55)) / 800));
  const tgtIn = useDerivedValue(() => easeOut((clock.value - (650 + i * 55)) / 450));

  const clipFor = (h: number) => {
    'worklet';
    return Skia.XYWHRect(bx, CHART_H - h * grow.value, bw, h * grow.value);
  };
  const mainClip = useDerivedValue(() => clipFor(w.kind === 'current' ? (w.plan ?? w.h) : w.h));
  const doneRect = useDerivedValue(() => clipFor(w.h));
  const tgtRect = useDerivedValue(() => Skia.XYWHRect(bx, CHART_H - w.tgt - 1, bw * tgtIn.value, 2));

  const stripe =
    w.kind === 'past' ? '#3B3A37' : w.kind === 'current' ? 'rgba(255,79,26,0.18)' : 'rgba(17,17,17,0.10)';

  return (
    <Group>
      <Group clip={mainClip}>
        {w.kind === 'past' && <Rect x={bx} y={0} width={bw} height={CHART_H} color={C.ink} />}
        <Path path={stripes} color={stripe} style="stroke" strokeWidth={w.kind === 'past' ? 1.5 : 3} />
      </Group>
      {w.kind === 'current' && <Rect rect={doneRect} color={C.orange} />}
      <Rect rect={tgtRect} color={C.orange} opacity={tgtIn} />
    </Group>
  );
}
