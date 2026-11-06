import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import type { AnalyzeError, AnalyzeErrorCode, AnalyzeResponse } from '@/lib/nutrition';

/**
 * Client for the food photo route. In development the relative URL resolves to the Metro dev
 * server, which serves `src/app/api`. Production builds need EXPO_PUBLIC_API_ORIGIN (the Expo
 * Hosting URL) or the expo-router plugin's `origin`.
 */
const ORIGIN = (process.env.EXPO_PUBLIC_API_ORIGIN ?? '').replace(/\/$/, '');
const TIMEOUT_MS = 75_000;
/** Longest edge sent to the model. ~1.1 MP keeps detail for portions without a heavy upload. */
const MAX_EDGE = 1280;

export type PhotoErrorCode = AnalyzeErrorCode | 'network' | 'timeout' | 'image';

export class PhotoError extends Error {
  constructor(public code: PhotoErrorCode, message: string) {
    super(message);
  }
}

/** Downscale and re-encode as JPEG so uploads stay small (typically 150–400 KB). */
export async function preparePhoto(uri: string, width: number, height: number) {
  try {
    const ctx = ImageManipulator.manipulate(uri);
    if (Math.max(width, height) > MAX_EDGE) {
      ctx.resize(width >= height ? { width: MAX_EDGE, height: null } : { width: null, height: MAX_EDGE });
    }
    const rendered = await ctx.renderAsync();
    const out = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
    if (!out.base64) throw new Error('no base64');
    return { uri: out.uri, base64: out.base64 };
  } catch {
    throw new PhotoError('image', 'Could not read that photo. Try another one.');
  }
}

export async function analyzePhoto(base64: string): Promise<AnalyzeResponse> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${ORIGIN}/api/food/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64, mediaType: 'image/jpeg' }),
      signal: ctrl.signal,
    });
  } catch {
    throw ctrl.signal.aborted
      ? new PhotoError('timeout', 'The estimate took too long. Check your connection and try again.')
      : new PhotoError('network', 'Can’t reach the server. Check your connection and try again.');
  } finally {
    clearTimeout(timer);
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new PhotoError('upstream', `The server answered ${res.status} without an estimate.`);
  }
  if (!res.ok) {
    const e = body as Partial<AnalyzeError>;
    throw new PhotoError(e.error ?? 'upstream', e.message ?? `The server answered ${res.status}.`);
  }
  return body as AnalyzeResponse;
}
