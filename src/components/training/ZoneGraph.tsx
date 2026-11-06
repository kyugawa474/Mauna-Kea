import { Canvas, DashPathEffect, Group, Line, Path, Skia, Text as SkText, useFont, vec } from '@shopify/react-native-skia';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

import { ZONE_BLOCKS, ZONE_COLORS, ZONE_TICKS } from '@/data/sample';
import { useTheme } from '@/state/Theme';
import { DT, F, useLayout, T, zoneColor, type Palette } from '@/theme';


const W = 350;
/** Vertical stretch on the tick lengths in the data (power peaks at 41, heart rate at 62). */
const V = 1.75;
/** Baseline of the power ticks (they grow up from here); the zone bar and Z labels sit just below. */
const UP_Y = 16 + 41.2 * V + 4;
const BAR_Y = UP_Y + 8;
const ZLABEL_Y = UP_Y + 22;
/** Baseline of the heart-rate ticks (they grow down from here). */
const DN_Y = UP_Y + 36;
const H = DN_Y + 62 * V + 20;

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
  const { stackTiles } = useLayout();
  const { C, caps, scheme } = useTheme();
  const ink = (dataInk: string) => (scheme === 'dark' ? C.onAccent : dataInk);
  const k = width / W;
  const font = useFont(require('@expo-google-fonts/ibm-plex-mono/400Regular/IBMPlexMono_400Regular.ttf'), 11);

  return (
    <View style={{ gap: 14 }}>
      <Canvas style={{ width, height: H * k }}>
        <Group transform={[{ scale: k }]}>
          {[70, 140, 210, 280].map((x) => (
            <Line key={x} p1={vec(x, 18)} p2={vec(x, H - 6)} color={C.ink} strokeWidth={0.6} opacity={0.4}>
              <DashPathEffect intervals={[1, 3]} />
            </Line>
          ))}
          <TickSet ticks={ZONE_TICKS.up} dir={-1} y={UP_Y} clock={clock} C={C} />
          <TickSet ticks={ZONE_TICKS.dn} dir={1} y={DN_Y} clock={clock} C={C} />
          {ZONE_COLORS.map((c, z) => (
            <Line key={c} p1={vec(1 + z * 70, BAR_Y)} p2={vec(69 + z * 70, BAR_Y)} color={zoneColor(c, C)} strokeWidth={3} />
          ))}
          {font && (
            <>
              {ZONE_COLORS.map((_, z) => {
                const label = `Z${z + 1}`;
                return <SkText key={label} x={35 + z * 70 - font.measureText(label).width / 2} y={ZLABEL_Y} text={label} font={font} color={C.ink} />;
              })}
              <SkText x={0} y={8} text="POWER" font={font} color={C.grey} />
              <SkText x={0} y={H - 2} text="HEART RATE" font={font} color={C.grey} />
            </>
          )}
        </Group>
      </Canvas>

      <View style={[styles.blocks, stackTiles && { flexDirection: 'column' }]}>
        {ZONE_BLOCKS.map((b) => (
          // By day the tiles carry the data's zone colours and their own ink; after dark they take the
          // white tints, so every tile's text is the dark onAccent.
          <LinearGradient
            key={b.name}
            colors={[zoneColor(b.colors[0], C), zoneColor(b.colors[1], C)]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.block}
          >
            <Text maxFontSizeMultiplier={DT.list} style={[caps, { color: ink(b.ink) }]}>{b.name}</Text>
            <Text maxFontSizeMultiplier={DT.fixed} style={[styles.hours, { color: ink(b.ink) }]}>{b.hours}</Text>
            {/* Zone range and HR time on their own lines, so all three tiles wrap the same at 11pt.
                Full opacity: at 60% the text fell below 4.5:1 on the gradients. */}
            <View style={{ gap: 2 }}>
              {b.sub.split(' · ').map((part) => (
                <Text key={part} maxFontSizeMultiplier={DT.list} style={[styles.sub, { color: ink(b.ink) }]}>{part}</Text>
              ))}
            </View>
          </LinearGradient>
        ))}
      </View>
      <Text maxFontSizeMultiplier={DT.list} style={[styles.sub, { color: C.grey, marginTop: -6 }]}>From your Strava rides · 4.6h coasting not drawn</Text>
    </View>
  );
}

// Rendered inside a Skia Canvas, which is its own React tree: theme context doesn't reach it, so the palette comes in as a prop.
function TickSet({ ticks, dir, y, clock, C }: { ticks: [number, number, string][]; dir: 1 | -1; y: number; clock: SharedValue<number>; C: Palette }) {
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
        <ColorTicks key={color} color={zoneColor(color, C)} list={list} dir={dir} y={y} clock={clock} />
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
      p.lineTo(t.x, y + dir * t.L * V * f);
    }
    return p.detach();
  });
  return <Path path={path} color={color} style="stroke" strokeWidth={1.6} />;
}

const styles = StyleSheet.create({
  blocks: { flexDirection: 'row', gap: 3 },
  block: { flex: 1, paddingVertical: 12, paddingHorizontal: 10, gap: 10, },
  hours: { fontFamily: F.light, fontSize: T.mid, letterSpacing: -0.8 },
  sub: { fontFamily: F.mono, fontSize: T.label },
});
