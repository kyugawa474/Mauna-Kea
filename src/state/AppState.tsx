import * as Haptics from 'expo-haptics';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { DAYS, TODAY_INDEX, WEEK, type DayVariant } from '@/data/sample';
import { deleteEntry, insertEntries, loadEntries, loadRecents, localDay, type EntrySource, type LogEntry, type RecentFood } from '@/lib/foodLog';
import { sumTotals, type FoodInput } from '@/lib/nutrition';

export type ThuPhase = 'thu_start' | 'thu_mid' | 'thu_end';
export const MEALS = ['Breakfast', 'Lunch', 'Snack', 'Dinner'] as const;
export type Meal = (typeof MEALS)[number];

/** Recent food name → ticked, per log day. */
type Picks = Record<string, Record<string, boolean>>;

interface AppState {
  dayIndex: number;
  setDayIndex: (i: number) => void;
  /** Sample-data switch so the three Thursday states can be previewed. */
  thuPhase: ThuPhase;
  cycleThuPhase: () => void;
  /** Sample-data switch: Saturday as planned, or as a completed long ride (to preview a big sun). */
  satDone: boolean;
  toggleSatDone: () => void;
  variant: DayVariant;
  addOpen: boolean;
  setAddOpen: (open: boolean) => void;
  meal: Meal;
  setMeal: (m: Meal) => void;
  /** Recent foods, most recently used first (persisted). */
  recents: RecentFood[];
  /** Ticked in the add panel but not yet logged (logged when the panel closes). Keyed by name. */
  picked: Record<string, boolean>;
  togglePick: (name: string) => void;
  /** Log foods to the selected day and meal right away (manual entry, photo review). */
  logFoods: (foods: FoodInput[], source: EntrySource) => Promise<void>;
  removeEntry: (id: number) => Promise<void>;
  /** What's logged on the selected day, oldest first. */
  entries: LogEntry[];
  /** Totals for the current day: the sample baseline plus logged entries. */
  totals: { gP: number; gC: number; gF: number; left: number; addedKcal: number };
}

const Ctx = createContext<AppState | null>(null);

/** Log key for a day: the real date for "today", a stable sample key for the rest of the sample week. */
function dayKeyFor(dayIndex: number, variant: DayVariant) {
  return dayIndex === TODAY_INDEX ? localDay() : `sample:${variant}`;
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [dayIndex, setDayIndex] = useState(TODAY_INDEX);
  const [thuPhase, setThuPhase] = useState<ThuPhase>('thu_end');
  const [satDone, setSatDone] = useState(false);
  const [addOpen, setAddOpenRaw] = useState(false);
  const [meal, setMeal] = useState<Meal>('Snack');
  const [picks, setPicks] = useState<Picks>({});
  const [allEntries, setAllEntries] = useState<LogEntry[]>([]);
  const [recents, setRecents] = useState<RecentFood[]>([]);

  const variant: DayVariant =
    dayIndex === 3 ? thuPhase : dayIndex === 5 && satDone ? 'sat_done' : (WEEK[dayIndex] as DayVariant);
  const dayKey = dayKeyFor(dayIndex, variant);

  useEffect(() => {
    let live = true;
    Promise.all([loadEntries(), loadRecents()])
      .then(([e, r]) => {
        if (!live) return;
        setAllEntries(e);
        setRecents(r);
      })
      .catch((err) => console.warn('[foodLog] load failed', err));
    return () => {
      live = false;
    };
  }, []);

  const toggleSatDone = useCallback(() => setSatDone((d) => !d), []);

  const cycleThuPhase = useCallback(() => {
    setThuPhase((p) => (p === 'thu_start' ? 'thu_mid' : p === 'thu_mid' ? 'thu_end' : 'thu_start'));
  }, []);

  const persist = useCallback(
    async (foods: FoodInput[], source: EntrySource) => {
      if (!foods.length) return;
      const added = await insertEntries(dayKey, meal, foods, source);
      setAllEntries((e) => [...e, ...added]);
      setRecents(await loadRecents());
    },
    [dayKey, meal],
  );

  // Closing the panel logs what was ticked in Recent, which animates the Today screen.
  const setAddOpen = useCallback(
    (open: boolean) => {
      setAddOpenRaw(open);
      if (!open) {
        const ticked = picks[dayKey] ?? {};
        const foods = recents.filter((r) => ticked[r.name]).map(({ name, kcal, carbs, protein, fat }) => ({ name, kcal, carbs, protein, fat }));
        if (foods.length) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setPicks((p) => ({ ...p, [dayKey]: {} }));
          persist(foods, 'recent').catch((err) => console.warn('[foodLog] save failed', err));
        }
      }
    },
    [picks, dayKey, recents, persist],
  );

  const togglePick = useCallback(
    (name: string) => setPicks((p) => ({ ...p, [dayKey]: { ...(p[dayKey] ?? {}), [name]: !(p[dayKey] ?? {})[name] } })),
    [dayKey],
  );

  const logFoods = useCallback(
    async (foods: FoodInput[], source: EntrySource) => {
      await persist(foods, source);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    [persist],
  );

  const removeEntry = useCallback(async (id: number) => {
    await deleteEntry(id);
    setAllEntries((e) => e.filter((x) => x.id !== id));
  }, []);

  const entries = useMemo(() => allEntries.filter((e) => e.day === dayKey), [allEntries, dayKey]);

  const totals = useMemo(() => {
    const base = DAYS[variant];
    const t = sumTotals(entries);
    return { gP: base.gP + t.protein, gC: base.gC + t.carbs, gF: base.gF + t.fat, left: Math.max(0, base.left - t.kcal), addedKcal: t.kcal };
  }, [entries, variant]);

  const value: AppState = {
    dayIndex, setDayIndex, thuPhase, cycleThuPhase, satDone, toggleSatDone, variant,
    addOpen, setAddOpen, meal, setMeal, recents,
    picked: picks[dayKey] ?? {}, togglePick, logFoods, removeEntry, entries, totals,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used inside AppStateProvider');
  return v;
}
