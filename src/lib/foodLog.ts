import * as SQLite from 'expo-sqlite';

import { RECENT_FOODS } from '@/data/sample';
import type { FoodInput } from '@/lib/nutrition';

/**
 * On-device food log (expo-sqlite). Two tables:
 * - `entries`: every logged food, keyed by `day` (a local YYYY-MM-DD, or `sample:<variant>` for
 *   the sample week's other days) and meal.
 * - `recents`: foods to offer again, most recently used first. Seeded from the sample list.
 */

export type EntrySource = 'manual' | 'photo' | 'recent';

export interface LogEntry extends FoodInput {
  id: number;
  day: string;
  meal: string;
  source: EntrySource;
  createdAt: number;
}

export interface RecentFood extends FoodInput {
  lastUsed: number;
}

const SCHEMA_VERSION = 1;

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function db() {
  dbPromise ??= SQLite.openDatabaseAsync('foodlog.db').then(async (d) => {
    await migrate(d);
    return d;
  });
  return dbPromise;
}

async function migrate(d: SQLite.SQLiteDatabase) {
  await d.execAsync('PRAGMA journal_mode = WAL;');
  const row = await d.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  if ((row?.user_version ?? 0) >= SCHEMA_VERSION) return;
  await d.execAsync(`
    CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day TEXT NOT NULL,
      meal TEXT NOT NULL,
      name TEXT NOT NULL,
      kcal REAL NOT NULL,
      carbs REAL NOT NULL,
      protein REAL NOT NULL,
      fat REAL NOT NULL,
      source TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS entries_day ON entries (day);
    CREATE TABLE IF NOT EXISTS recents (
      name TEXT PRIMARY KEY NOT NULL COLLATE NOCASE,
      kcal REAL NOT NULL,
      carbs REAL NOT NULL,
      protein REAL NOT NULL,
      fat REAL NOT NULL,
      last_used INTEGER NOT NULL
    );
  `);
  // Seed recents with the sample list, oldest last so the list keeps its order.
  const now = Date.now();
  for (const [i, f] of RECENT_FOODS.entries()) {
    await d.runAsync(
      'INSERT OR IGNORE INTO recents (name, kcal, carbs, protein, fat, last_used) VALUES (?, ?, ?, ?, ?, ?)',
      f.name, f.kcal, f.c, f.p, f.f, now - i * 1000,
    );
  }
  await d.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}

type EntryRow = { id: number; day: string; meal: string; name: string; kcal: number; carbs: number; protein: number; fat: number; source: EntrySource; created_at: number };
type RecentRow = { name: string; kcal: number; carbs: number; protein: number; fat: number; last_used: number };

const toEntry = (r: EntryRow): LogEntry => ({
  id: r.id, day: r.day, meal: r.meal, name: r.name, kcal: r.kcal, carbs: r.carbs, protein: r.protein, fat: r.fat,
  source: r.source, createdAt: r.created_at,
});
const toRecent = (r: RecentRow): RecentFood => ({
  name: r.name, kcal: r.kcal, carbs: r.carbs, protein: r.protein, fat: r.fat, lastUsed: r.last_used,
});

export async function loadEntries(): Promise<LogEntry[]> {
  const rows = await (await db()).getAllAsync<EntryRow>('SELECT * FROM entries ORDER BY created_at ASC, id ASC');
  return rows.map(toEntry);
}

export async function loadRecents(limit = 12): Promise<RecentFood[]> {
  const rows = await (await db()).getAllAsync<RecentRow>('SELECT * FROM recents ORDER BY last_used DESC LIMIT ?', limit);
  return rows.map(toRecent);
}

/** Log foods to a day and meal, and bump each into recents. Returns the stored entries. */
export async function insertEntries(day: string, meal: string, foods: FoodInput[], source: EntrySource): Promise<LogEntry[]> {
  const d = await db();
  const out: LogEntry[] = [];
  await d.withTransactionAsync(async () => {
    let now = Date.now();
    for (const f of foods) {
      const ts = now++;
      const r = await d.runAsync(
        'INSERT INTO entries (day, meal, name, kcal, carbs, protein, fat, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        day, meal, f.name, f.kcal, f.carbs, f.protein, f.fat, source, ts,
      );
      await d.runAsync(
        `INSERT INTO recents (name, kcal, carbs, protein, fat, last_used) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(name) DO UPDATE SET kcal = excluded.kcal, carbs = excluded.carbs, protein = excluded.protein,
           fat = excluded.fat, last_used = excluded.last_used`,
        f.name, f.kcal, f.carbs, f.protein, f.fat, ts,
      );
      out.push({ ...f, id: r.lastInsertRowId, day, meal, source, createdAt: ts });
    }
  });
  return out;
}

export async function deleteEntry(id: number) {
  await (await db()).runAsync('DELETE FROM entries WHERE id = ?', id);
}

/** Local calendar date as YYYY-MM-DD. */
export function localDay(date = new Date()) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}
