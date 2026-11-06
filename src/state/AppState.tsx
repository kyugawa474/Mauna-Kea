import * as Haptics from 'expo-haptics';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { DAYS, RECENT_FOODS, TODAY_INDEX, WEEK, type DayVariant } from '@/data/sample';

export type ThuPhase = 'thu_start' | 'thu_mid' | 'thu_end';
/** What a day has logged: nothing, a meal only, or an activity (with or without a meal). */
export type DayLog = 'none' | 'meal' | 'active';
export const MEALS = ['Breakfast', 'Lunch', 'Snack', 'Dinner'] as const;
export type Meal = (typeof MEALS)[number];

/** food index → true, per day variant */
type Picks = Partial<Record<DayVariant, Record<number, boolean>>>;

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
  /** Ticked in the add panel but not yet committed. */
  picked: Record<number, boolean>;
  togglePick: (foodIndex: number) => void;
  /** Per weekday (Mon–Sun), what has been logged; drives the week strip's marks. */
  weekLog: DayLog[];
  /** Totals for the current day including committed foods. */
  totals: { gP: number; gC: number; gF: number; left: number; addedKcal: number };
}

const Ctx = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [dayIndex, setDayIndex] = useState(TODAY_INDEX);
  const [thuPhase, setThuPhase] = useState<ThuPhase>('thu_end');
  const [satDone, setSatDone] = useState(false);
  const [addOpen, setAddOpenRaw] = useState(false);
  const [meal, setMeal] = useState<Meal>('Snack');
  const [picks, setPicks] = useState<Picks>({});
  const [committed, setCommitted] = useState<Picks>({});

  const variantFor = useCallback(
    (i: number): DayVariant => (i === 3 ? thuPhase : i === 5 && satDone ? 'sat_done' : (WEEK[i] as DayVariant)),
    [thuPhase, satDone],
  );
  const variant = variantFor(dayIndex);

  const toggleSatDone = useCallback(() => setSatDone((d) => !d), []);

  const cycleThuPhase = useCallback(() => {
    setThuPhase((p) => (p === 'thu_start' ? 'thu_mid' : p === 'thu_mid' ? 'thu_end' : 'thu_start'));
  }, []);

  // Closing the panel commits what was ticked, which animates the Today screen.
  const setAddOpen = useCallback(
    (open: boolean) => {
      setAddOpenRaw(open);
      if (!open) {
        const ticked = picks[variant] ?? {};
        const before = committed[variant] ?? {};
        // Confirm with a success haptic when closing actually logs something new.
        if (Object.keys(ticked).some((k) => ticked[+k] && !before[+k])) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        setCommitted((c) => ({ ...c, [variant]: { ...ticked } }));
      }
    },
    [picks, committed, variant],
  );

  const togglePick = useCallback(
    (i: number) => setPicks((p) => ({ ...p, [variant]: { ...(p[variant] ?? {}), [i]: !(p[variant] ?? {})[i] } })),
    [variant],
  );

  const totals = useMemo(() => {
    const base = DAYS[variant];
    const com = committed[variant] ?? {};
    let aP = 0, aC = 0, aF = 0, aK = 0;
    RECENT_FOODS.forEach((f, i) => {
      if (com[i]) { aP += f.p; aC += f.c; aF += f.f; aK += f.kcal; }
    });
    return { gP: base.gP + aP, gC: base.gC + aC, gF: base.gF + aF, left: Math.max(0, base.left - aK), addedKcal: aK };
  }, [committed, variant]);

  // A meal counts once any kcal are eaten (in the sample data or committed from the food log);
  // an activity once any kJ are ridden. Any activity fills the day, meal or not.
  const weekLog = useMemo(
    () =>
      WEEK.map((_, i): DayLog => {
        const v = variantFor(i);
        const d = DAYS[v];
        const meal = d.left < d.of || Object.values(committed[v] ?? {}).some(Boolean);
        return d.kj > 0 ? 'active' : meal ? 'meal' : 'none';
      }),
    [variantFor, committed],
  );

  const value: AppState = {
    dayIndex, setDayIndex, thuPhase, cycleThuPhase, satDone, toggleSatDone, variant,
    addOpen, setAddOpen, meal, setMeal,
    picked: picks[variant] ?? {}, togglePick, weekLog, totals,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used inside AppStateProvider');
  return v;
}
