import { Canvas, DashPathEffect, Group, Line, Path, Skia, Text as SkText, useFont, vec } from '@shopify/react-native-skia';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

import { ZONE_BLOCKS, ZONE_COLORS, ZONE_TICKS } from '@/data/sample';
import { C, F, caps } from '@/theme';

const W = 350;
const H = 188;
const UP_Y = 82;
const DN_Y = 118;

const ease = (t: number) => {
  'worklet';
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  return 1 - Math.pow(1 - c, 4);
};

/**
 * Time in zone from real Strava rides: power ticks grow up, heart-rate ticks grow down,
 * sharing one Z1–Z5 bar. Ticks grow left to right.
 */
export function ZoneGraph({ width, clock }: { width: number; clock: SharedValue<number> }) {
  const k = width / W;
  const font = useFont(require('@expo-google-fonts/ibm-plex-mono/400Regular/IBMPlexMono_400Regular.ttf'), 9);

  return (
    <View style={{ gap: 14 }}>
      <Canvas style={{ width, height: H * k }}>
        <Group transform={[{ scale: k }]}>
          {[70, 140, 210, 280].map((x) => (
            <Line key={x} p1={vec(x, 18)} p2={vec(x, 182)} color={C.ink} strokeWidth={0.6} opacity={0.4}>
              <DashPathEffect intervals={[1, 3]} />
            </Line>
          ))}
          <TickSet ticks={ZONE_TICKS.up} dir={-1} y={UP_Y} clock={clock} />
          <TickSet ticks={ZONE_TICKS.dn} dir={1} y={DN_Y} clock={clock} />
          {ZONE_COLORS.map((c, z) => (
            <Line key={c} p1={vec(1 + z * 70, 90)} p2={vec(69 + z * 70, 90)} color={c} strokeWidth={3} />
          ))}
          {font && (
            <>
              {ZONE_COLORS.map((_, z) => {
                const label = `Z${z + 1}`;
                return <SkText key={label} x={35 + z * 70 - font.measureText(label).width / 2} y={104} text={label} font={font} color={C.ink} />;
              })}
              <SkText x={0} y={8} text="POWER" font={font} color={C.grey} />
              <SkText x={0} y={186} text="HEART RATE" font={font} color={C.grey} />
            </>
          )}
        </Group>
      </Canvas>

      <View style={styles.blocks}>
        {ZONE_BLOCKS.map((b) => (
          <LinearGradient key={b.name} colors={b.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.block}>
            <Text style={[caps, { color: b.ink }]}>{b.name}</Text>
            <Text style={[styles.hours, { color: b.ink }]}>{b.hours}</Text>
            <Text style={[styles.sub, { color: b.ink, opacity: b.ink === C.white ? 0.65 : 0.6 }]}>{b.sub}</Text>
          </LinearGradient>
        ))}
      </View>
      <Text style={[styles.sub, { color: C.grey2, marginTop: -6 }]}>From your Strava rides · 4.6h coasting not drawn</Text>
    </View>
  );
}

function TickSet({ ticks, dir, y, clock }: { ticks: [number, number, string][]; dir: 1 | -1; y: number; clock: SharedValue<number> }) {
  const byColor = useMemo(() => {
    const m = new Map<string, { i: number; x: number; L: number }[]>();
    ticks.forEach(([x, L, c], i) => {
      if (!m.has(c)) m.set(c, []);
      m.get(c)!.push({ i, x, L });
    });
    return [...m];
  }, [ticks]);
  return (
    <>
      {byColor.map(([color, list]) => (
        <ColorTicks key={color} color={color} list={list} dir={dir} y={y} clock={clock} />
      ))}
    </>
  );
}

function ColorTicks({ color, list, dir, y, clock }: { color: string; list: { i: number; x: number; L: number }[]; dir: 1 | -1; y: number; clock: SharedValue<number> }) {
  const path = useDerivedValue(() => {
    const p = Skia.PathBuilder.Make();
    for (const t of list) {
      const f = ease((clock.value - (450 + t.i * 14)) / 550);
      if (f <= 0) continue;
      p.moveTo(t.x, y);
      p.lineTo(t.x, y + dir * t.L * f);
    }
    return p.detach();
  });
  return <Path path={path} color={color} style="stroke" strokeWidth={1.6} />;
}

const styles = StyleSheet.create({
  blocks: { flexDirection: 'row', gap: 3 },
  block: { flex: 1, paddingVertical: 12, paddingHorizontal: 10, gap: 10, },
  hours: { fontFamily: F.light, fontSize: 26, letterSpacing: -0.8 },
  sub: { fontFamily: F.mono, fontSize: 10 },
});
