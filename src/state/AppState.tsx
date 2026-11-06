import * as Haptics from 'expo-haptics';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { DAYS, RECENT_FOODS, TODAY_INDEX, WEEK, type DayVariant } from '@/data/sample';

export type ThuPhase = 'thu_start' | 'thu_mid' | 'thu_end';
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

  const variant: DayVariant =
    dayIndex === 3 ? thuPhase : dayIndex === 5 && satDone ? 'sat_done' : (WEEK[dayIndex] as DayVariant);

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

  const value: AppState = {
    dayIndex, setDayIndex, thuPhase, cycleThuPhase, satDone, toggleSatDone, variant,
    addOpen, setAddOpen, meal, setMeal,
    picked: picks[variant] ?? {}, togglePick, totals,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used inside AppStateProvider');
  return v;
}
