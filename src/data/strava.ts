/**
 * Live data from Strava: the stored session, an on-device ride cache, and the mapping onto the
 * shapes the screens already draw (src/data/training.ts).
 *
 * Rate limits are tight (100 reads per 15 min, 1,000 a day per app), so a sync asks only for rides
 * newer than the last one it has (plus a two-day overlap to catch edits), and each ride's streams
 * are fetched once, reduced to small histograms, and kept. Raw streams are never stored.
 */
import { File, Paths } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';

import { DAYS, WEEK, WEEKS, ZONE_COLORS, ZONE_STARTS, type Day, type DayVariant, type RideStats, type Week, type ZoneLabel } from './sample';
import { SAMPLE_DATA, type ActivityRow, type Tick, type TrainingData, type WeekMark, type ZoneBlock } from './training';

const API = 'https://www.strava.com/api/v3';
/** Where the app's own token routes live. Empty in development: Metro serves them on its origin. */
const API_ORIGIN = (process.env.EXPO_PUBLIC_API_ORIGIN ?? '').replace(/\/$/, '');
export const STRAVA_CLIENT_ID = process.env.EXPO_PUBLIC_STRAVA_CLIENT_ID ?? '';

/** The athlete's FTP and weight until we read them from Strava (that needs profile:read_all). */
const FTP = 242;
const DEFAULT_KG = 72;
/** Watts where Z1–Z5 start (Z5 runs to 400 W on the charts), from the 4 W ray indices. */
const POWER_BOUNDS = [0, ...ZONE_STARTS.map((i) => i * 4), 400];
/** Heart-rate zones (bpm) until we read the athlete's own. */
const HR_BOUNDS = [0, 125, 145, 160, 172, 200];
/** History the Training tab shows: 12 weeks of consistency, 8 weeks of zones and weekly bars. */
const HISTORY_WEEKS = 12;
const ZONE_WEEKS = 8;
/** Stream requests per sync, leaving headroom in the 15-minute window. */
const STREAMS_PER_SYNC = 40;

// ───────────────────────── session ─────────────────────────

export interface StravaSession {
  accessToken: string;
  refreshToken: string;
  /** Seconds since the epoch. */
  expiresAt: number;
  scope?: string;
  athlete: { id: number; firstname: string; lastname: string; weight?: number | null };
}

const SESSION_KEY = 'strava.session';

export async function loadSession(): Promise<StravaSession | null> {
  try {
    const raw = await SecureStore.getItemAsync(SESSION_KEY);
    return raw ? (JSON.parse(raw) as StravaSession) : null;
  } catch {
    return null;
  }
}

const saveSession = (s: StravaSession) => SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(s));

interface TokenPayload {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  scope?: string;
  athlete?: StravaSession['athlete'];
}

async function postToken(path: 'token' | 'refresh', body: Record<string, string>): Promise<TokenPayload> {
  const res = await fetch(`${API_ORIGIN}/api/strava/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.access_token) throw new Error(json?.error ?? `Token request failed (${res.status})`);
  return json as TokenPayload;
}

/** Finish OAuth: trade the redirect's `code` for tokens (via our server) and keep them in SecureStore. */
export async function connectWithCode(code: string): Promise<StravaSession> {
  const t = await postToken('token', { code });
  if (!t.athlete) throw new Error('Strava did not return an athlete');
  const session: StravaSession = {
    accessToken: t.access_token,
    refreshToken: t.refresh_token,
    expiresAt: t.expires_at,
    scope: t.scope,
    athlete: t.athlete,
  };
  await saveSession(session);
  return session;
}

/** Forget the tokens and every cached ride. (Strava access stays granted until revoked on strava.com.) */
export async function disconnect() {
  await SecureStore.deleteItemAsync(SESSION_KEY).catch(() => {});
  try {
    if (cacheFile().exists) cacheFile().delete();
  } catch {}
}

/** A session whose access token is good for at least five more minutes, refreshing if needed. */
async function fresh(session: StravaSession): Promise<StravaSession> {
  if (session.expiresAt - Date.now() / 1000 > 300) return session;
  const t = await postToken('refresh', { refresh_token: session.refreshToken });
  const next = { ...session, accessToken: t.access_token, refreshToken: t.refresh_token, expiresAt: t.expires_at };
  await saveSession(next);
  return next;
}

class RateLimited extends Error {}

async function get<T>(session: StravaSession, path: string): Promise<T | null> {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${session.accessToken}` } });
  if (res.status === 429) throw new RateLimited('Strava rate limit reached; try again in 15 minutes');
  if (res.status === 404) return null;
  if (res.status === 401) throw new Error('Strava access was revoked; connect again');
  if (!res.ok) throw new Error(`Strava ${res.status} on ${path.split('?')[0]}`);
  return (await res.json()) as T;
}

// ───────────────────────── cache ─────────────────────────

/** One activity as kept on device: summary fields plus histograms reduced from its streams. */
export interface CachedActivity {
  id: number;
  name: string;
  sport: string;
  /** Local start, "YYYY-MM-DDTHH:mm:ss" (Strava's start_date_local without its misleading Z). */
  local: string;
  /** Epoch seconds (UTC start). */
  start: number;
  movingS: number;
  kj?: number;
  avgW?: number;
  /** Power from a power meter (false = Strava's estimate, which has no watts stream). */
  meter: boolean;
  hasHr: boolean;
  /** Streams were asked for (whether or not they had power). */
  streams: boolean;
  /** Seconds in each 4 W step, 0–400 W (100 steps). */
  power?: number[];
  /** Seconds in each of 90 time-in-zone ticks (18 per zone), for power and heart rate. */
  zoneP?: number[];
  zoneHr?: number[];
}

interface Cache {
  version: 1;
  athleteId: number;
  syncedAt: number;
  activities: Record<string, CachedActivity>;
}

const cacheFile = () => new File(Paths.document, 'strava-cache.json');

async function readCache(athleteId: number): Promise<Cache> {
  try {
    const f = cacheFile();
    if (f.exists) {
      const c = JSON.parse(await f.text()) as Cache;
      if (c.version === 1 && c.athleteId === athleteId) return c;
    }
  } catch {}
  return { version: 1, athleteId, syncedAt: 0, activities: {} };
}

async function writeCache(c: Cache) {
  const f = cacheFile();
  if (!f.exists) f.create();
  await f.write(JSON.stringify(c));
}

// ───────────────────────── sync ─────────────────────────

const RIDE_TYPES = new Set(['Ride', 'VirtualRide', 'MountainBikeRide', 'GravelRide', 'EBikeRide', 'EMountainBikeRide', 'Velomobile', 'Handcycle']);
const isRide = (a: CachedActivity) => RIDE_TYPES.has(a.sport);

interface SummaryActivity {
  id: number;
  name: string;
  sport_type?: string;
  type?: string;
  start_date: string;
  start_date_local: string;
  moving_time: number;
  kilojoules?: number;
  average_watts?: number;
  device_watts?: boolean;
  has_heartrate?: boolean;
}
type Stream = { data: (number | null)[] };
type StreamSet = { time?: Stream; watts?: Stream; heartrate?: Stream };

/** Monday 00:00 local of the week holding `d`. */
function mondayOf(d: Date) {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
  return m;
}
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Bring the cache up to date. Returns the (possibly refreshed) session and the cache. A rate-limit
 * stop keeps what was fetched so far; the next sync carries on from there.
 */
export async function sync(session0: StravaSession, now = new Date()): Promise<{ session: StravaSession; cache: Cache; note?: string }> {
  let session = await fresh(session0);
  const cache = await readCache(session.athlete.id);
  const windowStart = addDays(mondayOf(now), -7 * (HISTORY_WEEKS - 1)).getTime() / 1000;
  const newest = Math.max(0, ...Object.values(cache.activities).map((a) => a.start));
  const after = Math.floor(Math.max(windowStart, newest - 2 * 86400));
  let note: string | undefined;

  try {
    for (let page = 1; page < 20; page++) {
      const list = await get<SummaryActivity[]>(session, `/athlete/activities?after=${after}&per_page=200&page=${page}`);
      if (!list?.length) break;
      for (const a of list) {
        const prev = cache.activities[a.id];
        const meter = !!a.device_watts;
        cache.activities[a.id] = {
          ...prev,
          id: a.id,
          name: a.name,
          sport: a.sport_type ?? a.type ?? 'Workout',
          local: a.start_date_local.replace(/Z$/, ''),
          start: Date.parse(a.start_date) / 1000,
          movingS: a.moving_time,
          kj: a.kilojoules,
          avgW: a.average_watts,
          meter,
          hasHr: !!a.has_heartrate,
          // Re-ask for streams only if the ride gained power or heart rate since we last looked.
          streams: !!prev?.streams && prev.meter === meter && prev.hasHr === !!a.has_heartrate,
        };
      }
      if (list.length < 200) break;
    }

    // Streams for recent rides with a power meter or heart rate, newest first.
    const zoneStart = addDays(mondayOf(now), -7 * (ZONE_WEEKS - 1)).getTime() / 1000;
    const want = Object.values(cache.activities)
      .filter((a) => isRide(a) && !a.streams && (a.meter || a.hasHr) && a.start >= zoneStart)
      .sort((a, b) => b.start - a.start);
    for (const a of want.slice(0, STREAMS_PER_SYNC)) {
      session = await fresh(session);
      const set = await get<StreamSet>(session, `/activities/${a.id}/streams?keys=time,watts,heartrate&key_by_type=true`);
      Object.assign(a, reduceStreams(set), { streams: true });
    }
    if (want.length > STREAMS_PER_SYNC) note = `${want.length - STREAMS_PER_SYNC} rides left to load`;
  } catch (e) {
    if (!(e instanceof RateLimited)) throw e;
    note = e.message;
  }

  for (const [id, a] of Object.entries(cache.activities)) if (a.start < windowStart - 86400) delete cache.activities[id];
  cache.syncedAt = Date.now();
  await writeCache(cache);
  return { session, cache, note };
}

/** Cached data only: no network. */
export async function cached(session: StravaSession) {
  return readCache(session.athlete.id);
}

/** Bin `v` into one of 90 ticks: 5 zones of 18 equal steps between `bounds`. */
function zoneTick(v: number, bounds: number[]) {
  let z = 0;
  while (z < 4 && v >= bounds[z + 1]) z++;
  const lo = bounds[z], hi = bounds[z + 1];
  const k = Math.min(17, Math.max(0, Math.floor(((v - lo) / (hi - lo)) * 18)));
  return z * 18 + k;
}

/** Time-weighted histograms from a ride's streams (gaps over 10 s are pauses and count as 1 s). */
export function reduceStreams(set: StreamSet | null): Pick<CachedActivity, 'power' | 'zoneP' | 'zoneHr'> {
  const time = set?.time?.data;
  if (!time?.length) return {};
  const watts = set?.watts?.data;
  const hr = set?.heartrate?.data;
  const power = watts ? new Array(100).fill(0) : undefined;
  const zoneP = watts ? new Array(90).fill(0) : undefined;
  const zoneHr = hr ? new Array(90).fill(0) : undefined;
  for (let i = 0; i < time.length; i++) {
    const gap = i === 0 ? 1 : (time[i] ?? 0) - (time[i - 1] ?? 0);
    const dt = gap > 0 && gap <= 10 ? gap : 1;
    const w = watts?.[i];
    if (power && zoneP && typeof w === 'number' && w >= 0) {
      power[Math.min(99, Math.floor(w / 4))] += dt;
      zoneP[zoneTick(w, POWER_BOUNDS)] += dt;
    }
    const h = hr?.[i];
    if (zoneHr && typeof h === 'number' && h > 0) zoneHr[zoneTick(h, HR_BOUNDS)] += dt;
  }
  return { power, zoneP, zoneHr };
}

// ───────────────────────── mapping ─────────────────────────

const GREY = '#C4C2BC';
const TICK_GREY = '#B4B2AC';
const RAY_MAX = 40.5;
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const label = (d: Date) => `${DOW[(d.getDay() + 6) % 7]} · ${MON[d.getMonth()]} ${d.getDate()}`;
/** Weekly bars: px per kJ on the 150 px chart, from the sample (1,483 kJ drew 43 px). */
const KJ_PER_PX = 1483 / 43;
const zoneOfRay = (i: number) => ZONE_STARTS.filter((s) => i >= s).length;
const zoneName = (pct: number) => `Zone ${pct < 55 ? 1 : pct < 75 ? 2 : pct < 90 ? 3 : pct < 105 ? 4 : 5}`;
const sum = (xs: number[]) => xs.reduce((t, x) => t + x, 0);
const addInto = (acc: number[] | undefined, xs: number[] | undefined) => (xs ? (acc ?? new Array(xs.length).fill(0)).map((v, i) => v + xs[i]) : acc);

/** 100 power steps → sun rays: longest RAY_MAX, zero-time steps grey at 2.5, zone colours by index. */
export function toRays(power: number[]): [number, string][] {
  const longest = Math.max(...power);
  return power.map((s, i) => (s > 0 && longest > 0 ? [Math.max(2.5, Math.round((s / longest) * RAY_MAX * 10) / 10), ZONE_COLORS[zoneOfRay(i)]] : [2.5, GREY]));
}

/** Zone-label radii sit 16 px inside the sun (7 px further on the lower half), as in the sample. */
function zoneLabels(r: number): ZoneLabel[] {
  const base = DAYS.tue.zoneLabels!;
  return base.map(([t, , a, b, sweep]) => [t, Math.round((sweep ? r - 16 : r - 9) * 10) / 10, a, b, sweep]);
}

function toTicks(secs: number[] | undefined, max: number): Tick[] {
  const longest = secs ? Math.max(...secs) : 0;
  return Array.from({ length: 90 }, (_, i) => {
    const x = Math.round((Math.floor(i / 18) * 70 + ((i % 18) + 0.5) * (70 / 18)) * 10) / 10;
    const s = secs?.[i] ?? 0;
    return s > 0 && longest > 0
      ? [x, Math.max(2, Math.round((s / longest) * max * 10) / 10), ZONE_COLORS[Math.floor(i / 18)]]
      : [x, 2, TICK_GREY];
  });
}

const hrs = (s: number) => (s < 3600 ? `${Math.round(s / 60)}m` : `${(s / 3600).toFixed(1)}h`);

/** The weekday's sample day: nutrition and kJ targets have no live source yet. */
function sampleFor(i: number): Day {
  return DAYS[(i === 3 ? 'thu_start' : WEEK[i]) as DayVariant];
}

function rideStats(rides: CachedActivity[], kg: number): RideStats | undefined {
  const secs = sum(rides.map((r) => r.movingS));
  if (!secs) return undefined;
  const powered = rides.filter((r) => r.avgW);
  const pSecs = sum(powered.map((r) => r.movingS));
  const w = pSecs ? Math.round(sum(powered.map((r) => (r.avgW ?? 0) * r.movingS)) / pSecs) : 0;
  const pct = Math.round((w / FTP) * 100);
  return { min: Math.round(secs / 60), w, wkg: (w / kg).toFixed(1), pct, zone: zoneName(pct) };
}

/** Everything the screens draw, from the cache. Targets and nutrition stay from the sample plan. */
export function buildData(cache: Cache, session: StravaSession, now = new Date()): TrainingData {
  const kg = session.athlete.weight || DEFAULT_KG;
  const monday = mondayOf(now);
  const todayIndex = (now.getDay() + 6) % 7;
  const byDay = new Map<string, CachedActivity[]>();
  for (const a of Object.values(cache.activities)) {
    const k = a.local.slice(0, 10);
    byDay.set(k, [...(byDay.get(k) ?? []), a]);
  }
  const ridesOn = (d: Date) => (byDay.get(dayKey(d)) ?? []).filter(isRide);
  const kjOn = (d: Date) => Math.round(sum(ridesOn(d).map((r) => r.kj ?? 0)));

  // ── this week ──
  const days: Day[] = WEEK.map((_, i) => {
    const date = addDays(monday, i);
    const base = sampleFor(i);
    const rides = ridesOn(date);
    const kj = kjOn(date);
    const power = rides.reduce<number[] | undefined>((acc, r) => addInto(acc, r.power), undefined);
    const rays = power && sum(power) > 0 ? toRays(power) : undefined;
    const tgt = base.tgt;
    const future = i > todayIndex;
    const note =
      tgt === 0
        ? kj > 0 ? 'kJ · rest day ride' : 'kJ · rest from the bike'
        : future ? `kJ of ${tgt.toLocaleString('en-US')} · planned`
        : i === todayIndex && kj === 0 ? `kJ of ${tgt.toLocaleString('en-US')} · not started`
        : i === todayIndex && kj < tgt ? `kJ of ${tgt.toLocaleString('en-US')} · ${(tgt - kj).toLocaleString('en-US')} to go`
        : `kJ of ${tgt.toLocaleString('en-US')}`;
    const r = 175 * Math.sqrt(kj / 1300);
    return {
      ...base,
      label: label(date),
      kj,
      tgt,
      note,
      ride: rideStats(rides, kg),
      rays,
      zoneLabels: rays ? zoneLabels(r) : undefined,
    };
  });

  const weekMarks: WeekMark[] = days.map((d, i) => (i > todayIndex ? 'planned' : d.kj > 0 ? 'rode' : i === todayIndex && d.tgt > 0 ? 'planned' : 'rest'));

  // ── weekly kJ: 8 past weeks, this week, then the plan ──
  const cur = WEEKS.findIndex((w) => w.kind === 'current');
  const weekKj = (k: number) => sum(Array.from({ length: 7 }, (_, d) => kjOn(addDays(monday, 7 * k + d))));
  const md = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
  const px = (kj: number) => Math.min(150, Math.round(kj / KJ_PER_PX));
  const pastKj = Array.from({ length: cur }, (_, i) => weekKj(i - cur));
  const thisWeek = sum(days.map((d) => d.kj));
  const weeks: Week[] = WEEKS.map((w, i) => {
    const lbl = md(addDays(monday, 7 * (i - cur)));
    if (w.kind === 'past') return { ...w, label: lbl, h: px(pastKj[i]) };
    if (w.kind === 'current') return { ...w, label: lbl, h: px(thisWeek) };
    return { ...w, label: lbl };
  });
  const avgWeek = pastKj.length ? Math.round(sum(pastKj) / pastKj.length) : 0;
  const sd = avgWeek ? Math.sqrt(sum(pastKj.map((k) => (k - avgWeek) ** 2)) / pastKj.length) : 0;

  // ── time in zone: last 8 weeks of streams ──
  const zoneFrom = addDays(monday, -7 * (ZONE_WEEKS - 1));
  const recent = Object.values(cache.activities).filter((a) => isRide(a) && new Date(a.local) >= zoneFrom);
  const zp = recent.reduce<number[] | undefined>((acc, r) => addInto(acc, r.zoneP), undefined);
  const zh = recent.reduce<number[] | undefined>((acc, r) => addInto(acc, r.zoneHr), undefined);
  const zoneSecs = (xs: number[] | undefined, zones: number[]) => sum(zones.flatMap((z) => (xs ?? []).slice(z * 18, z * 18 + 18)));
  const block = (name: string, zones: number[], colors: readonly [string, string], ink: string, zLabel: string): ZoneBlock => ({
    name, colors, ink,
    hours: hrs(zoneSecs(zp, zones)),
    sub: `${zLabel} · HR ${hrs(zoneSecs(zh, zones))}`,
  });
  const zoneBlocks = [
    block('Easy', [0, 1], [ZONE_COLORS[0], ZONE_COLORS[1]], '#111111', 'Z1–2'),
    block('Moderate', [2, 3], [ZONE_COLORS[2], ZONE_COLORS[3]], '#111111', 'Z3–4'),
    block('Hard', [4], [ZONE_COLORS[4], ZONE_COLORS[4]], '#FFFFFF', 'Z5'),
  ];
  const rideHours = Math.round(sum(recent.map((r) => r.movingS)) / 3600);

  // ── consistency: 12 weeks, this week last ──
  const consistency = Array.from({ length: HISTORY_WEEKS }, (_, c) =>
    Array.from({ length: 7 }, (_, d) => {
      const date = addDays(monday, 7 * (c - HISTORY_WEEKS + 1) + d);
      const isToday = c === HISTORY_WEEKS - 1 && d === todayIndex;
      if (c === HISTORY_WEEKS - 1 && d > todayIndex) return 'future';
      const acts = byDay.get(dayKey(date)) ?? [];
      const ride = acts.some(isRide), other = acts.some((a) => !isRide(a));
      return (ride && other ? 'both' : ride ? 'ride' : other ? 'other' : 'rest') + (isToday ? '!' : '');
    }),
  );

  // ── activity log: this week, newest first ──
  const activityLog: ActivityRow[] = Object.values(cache.activities)
    .filter((a) => new Date(a.local) >= monday)
    .sort((a, b) => b.start - a.start)
    .map((a) => {
      const min = Math.round(a.movingS / 60);
      const ride = isRide(a);
      const sub = ride && a.avgW ? `${zoneName((a.avgW / FTP) * 100)} · ${min} min` : `${min} min`;
      return { id: String(a.id), date: label(new Date(a.local)), name: a.name, sub, kj: ride && a.kj ? Math.round(a.kj) : undefined, kind: ride ? 'ride' : 'other' };
    });

  return {
    source: 'strava',
    days,
    todayIndex,
    todayLabel: label(now),
    weekMarks,
    weeks,
    stats: {
      variability: avgWeek ? Math.round((sd / avgWeek) * 1000) / 10 : 0,
      avgWeek,
      thisWeek,
      weekTarget: SAMPLE_DATA.stats.weekTarget,
    },
    zoneTicks: { up: toTicks(zp, 41.2), dn: toTicks(zh, 62) },
    zoneBlocks,
    zoneRange: `Last ${ZONE_WEEKS} weeks · ${rideHours}h`,
    consistency,
    activityLog,
  };
}
