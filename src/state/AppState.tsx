import * as Haptics from 'expo-haptics';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { DAYS, RECENT_FOODS, WEEK, type Day, type DayVariant } from '@/data/sample';
import * as Strava from '@/data/strava';
import { SAMPLE_DATA, type TrainingData } from '@/data/training';

export type ThuPhase = 'thu_start' | 'thu_mid' | 'thu_end';
export const MEALS = ['Breakfast', 'Lunch', 'Snack', 'Dinner'] as const;
export type Meal = (typeof MEALS)[number];

/** food index → true, per day variant */
type Picks = Partial<Record<DayVariant, Record<number, boolean>>>;

export type StravaStatus = 'loading' | 'disconnected' | 'connecting' | 'syncing' | 'connected';

interface AppState {
  /** What the screens draw: Strava once connected, the bundled sample otherwise. */
  data: TrainingData;
  /** The selected day, already resolved (sample preview phases included). */
  day: Day;
  /** Any day of this week by index (Monday = 0). */
  dayAt: (i: number) => Day;
  strava: {
    status: StravaStatus;
    athlete?: string;
    /** Last sync (ms since epoch). */
    syncedAt?: number;
    /** The last error or partial-sync note, if any. */
    message?: string;
  };
  connectStrava: (code: string) => Promise<void>;
  disconnectStrava: () => Promise<void>;
  syncStrava: () => Promise<void>;
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
  const [data, setData] = useState<TrainingData>(SAMPLE_DATA);
  const [strava, setStrava] = useState<AppState['strava']>({ status: 'loading' });
  const session = useRef<Strava.StravaSession | null>(null);
  const [dayIndex, setDayIndex] = useState(SAMPLE_DATA.todayIndex);
  const [thuPhase, setThuPhase] = useState<ThuPhase>('thu_end');
  const [satDone, setSatDone] = useState(false);
  const [addOpen, setAddOpenRaw] = useState(false);
  const [meal, setMeal] = useState<Meal>('Snack');
  const [picks, setPicks] = useState<Picks>({});
  const [committed, setCommitted] = useState<Picks>({});

  const live = data.source === 'strava';
  // The variant keys food picks per weekday. Thursday's phases and Saturday's done state are
  // sample-only previews; live days come straight from the data.
  const variant: DayVariant =
    !live && dayIndex === 3 ? thuPhase : !live && dayIndex === 5 && satDone ? 'sat_done' : (WEEK[dayIndex] as DayVariant);
  const day = live ? data.days[dayIndex] : DAYS[variant];
  const dayAt = useCallback(
    (i: number) => (live ? data.days[i] : DAYS[(i === 3 ? 'thu_start' : WEEK[i]) as DayVariant]),
    [live, data],
  );

  // ── Strava: show the cache at once, then sync in the background ──
  const syncStrava = useCallback(async () => {
    const s = session.current;
    if (!s) return;
    setStrava((v) => ({ ...v, status: 'syncing', message: undefined }));
    try {
      const { session: next, cache, note } = await Strava.sync(s);
      session.current = next;
      setData(Strava.buildData(cache, next));
      setStrava((v) => ({ ...v, status: 'connected', syncedAt: cache.syncedAt, message: note }));
    } catch (e) {
      setStrava((v) => ({ ...v, status: 'connected', message: e instanceof Error ? e.message : String(e) }));
    }
  }, []);

  const adopt = useCallback(
    async (s: Strava.StravaSession) => {
      session.current = s;
      const cache = await Strava.cached(s);
      const name = `${s.athlete.firstname} ${s.athlete.lastname}`.trim();
      if (cache.syncedAt) setData(Strava.buildData(cache, s));
      setStrava({ status: 'connected', athlete: name, syncedAt: cache.syncedAt || undefined });
      if (cache.syncedAt) setDayIndex((new Date().getDay() + 6) % 7);
      await syncStrava();
    },
    [syncStrava],
  );

  useEffect(() => {
    Strava.loadSession().then((s) => (s ? adopt(s) : setStrava({ status: 'disconnected' })));
  }, [adopt]);

  const connectStrava = useCallback(
    async (code: string) => {
      setStrava({ status: 'connecting' });
      try {
        await adopt(await Strava.connectWithCode(code));
        setDayIndex((new Date().getDay() + 6) % 7);
      } catch (e) {
        setStrava({ status: 'disconnected', message: e instanceof Error ? e.message : String(e) });
      }
    },
    [adopt],
  );

  const disconnectStrava = useCallback(async () => {
    session.current = null;
    await Strava.disconnect();
    setData(SAMPLE_DATA);
    setDayIndex(SAMPLE_DATA.todayIndex);
    setStrava({ status: 'disconnected' });
  }, []);

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
    const base = day;
    const com = committed[variant] ?? {};
    let aP = 0, aC = 0, aF = 0, aK = 0;
    RECENT_FOODS.forEach((f, i) => {
      if (com[i]) { aP += f.p; aC += f.c; aF += f.f; aK += f.kcal; }
    });
    return { gP: base.gP + aP, gC: base.gC + aC, gF: base.gF + aF, left: Math.max(0, base.left - aK), addedKcal: aK };
  }, [committed, variant, day]);

  const value: AppState = {
    data, day, dayAt, strava, connectStrava, disconnectStrava, syncStrava,
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
