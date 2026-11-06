/**
 * Shared nutrition shapes: the app's log entries and the food photo route's response.
 * Imported by both the app and `src/app/api/food/analyze+api.ts`, so keep it free of secrets
 * and native modules.
 */

/** One food as logged: kcal plus macros in grams. */
export interface FoodInput {
  name: string;
  kcal: number;
  carbs: number;
  protein: number;
  fat: number;
}

export type Confidence = 'low' | 'medium' | 'high';

/** One item the vision model found in a photo. Everything is an estimate the user can edit. */
export interface EstimatedItem extends FoodInput {
  /** Estimated portion weight in grams. */
  grams: number;
  confidence: Confidence;
}

export interface Totals {
  kcal: number;
  carbs: number;
  protein: number;
  fat: number;
}

export interface AnalyzeResponse {
  items: EstimatedItem[];
  totals: Totals;
  /** A short caveat from the model (hidden ingredients, portion assumptions). */
  notes: string;
  model: string;
}

/** Error codes the route returns as `{ error, message }`. */
export type AnalyzeErrorCode = 'not_configured' | 'bad_request' | 'no_food' | 'refused' | 'rate_limited' | 'upstream';

export interface AnalyzeError {
  error: AnalyzeErrorCode;
  message: string;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function sumTotals(items: FoodInput[]): Totals {
  const t = items.reduce(
    (a, i) => ({ kcal: a.kcal + i.kcal, carbs: a.carbs + i.carbs, protein: a.protein + i.protein, fat: a.fat + i.fat }),
    { kcal: 0, carbs: 0, protein: 0, fat: 0 },
  );
  return { kcal: Math.round(t.kcal), carbs: round1(t.carbs), protein: round1(t.protein), fat: round1(t.fat) };
}

/** Keep a number finite, non-negative and to one decimal place. */
export const clean = (n: unknown, max = 10000) => {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : 0;
  return round1(Math.min(max, Math.max(0, v)));
};
