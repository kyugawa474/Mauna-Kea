/**
 * The shape every screen reads: one week of days plus the Training tab's charts. It comes from
 * either the bundled sample (not connected) or Strava (src/data/strava.ts), and AppState holds it.
 */
import {
  ACTIVITY_LOG,
  CONSISTENCY,
  DAYS,
  TODAY_INDEX,
  TRAINING_STATS,
  WEEK,
  WEEKS,
  ZONE_BLOCKS,
  ZONE_TICKS,
  type Day,
  type DayVariant,
  type Week,
} from './sample';

export type Tick = [x: number, length: number, colour: string];
export type WeekMark = 'fuelled' | 'rode' | 'rest' | 'planned';
export interface ActivityRow { id: string; date: string; name: string; sub: string; kj?: number; kind: 'ride' | 'other' | 'skipped' }
export interface ZoneBlock { name: string; hours: string; sub: string; colors: readonly [string, string]; ink: string }

export interface TrainingData {
  source: 'sample' | 'strava';
  /** Monday to Sunday of the current week. */
  days: Day[];
  todayIndex: number;
  /** "Thu · Oct 22": the Training header. */
  todayLabel: string;
  /** Week strip mark per day, Monday first. */
  weekMarks: WeekMark[];
  weeks: Week[];
  stats: { variability: number; avgWeek: number; thisWeek: number; weekTarget: number };
  zoneTicks: { up: Tick[]; dn: Tick[] };
  zoneBlocks: ZoneBlock[];
  /** "Last 8 weeks · 41h" */
  zoneRange: string;
  /** 12 weeks × 7 days: ride | other | both | rest | future; "!" marks today. */
  consistency: string[][];
  activityLog: ActivityRow[];
}

const sampleDays = WEEK.map((k, i) => DAYS[(i === TODAY_INDEX ? 'thu_end' : k) as DayVariant]);

export const SAMPLE_DATA: TrainingData = {
  source: 'sample',
  days: sampleDays,
  todayIndex: TODAY_INDEX,
  todayLabel: 'Thu · Oct 22',
  weekMarks: ['fuelled', 'rode', 'rest', 'rode', 'planned', 'planned', 'planned'],
  weeks: WEEKS,
  stats: TRAINING_STATS,
  zoneTicks: ZONE_TICKS,
  zoneBlocks: ZONE_BLOCKS,
  zoneRange: 'Last 8 weeks · 41h',
  consistency: CONSISTENCY,
  activityLog: ACTIVITY_LOG.map((a) => ({ ...a, id: a.date })),
};
