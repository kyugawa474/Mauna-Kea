import Anthropic from '@anthropic-ai/sdk';

import { clean, sumTotals, type AnalyzeError, type AnalyzeErrorCode, type AnalyzeResponse, type Confidence, type EstimatedItem } from '@/lib/nutrition';

/**
 * POST /api/food/analyze — estimate the nutrition of a meal photo with Claude.
 *
 * Body: `{ image: <base64 JPEG/PNG/WebP>, mediaType?: 'image/jpeg' | 'image/png' | 'image/webp' }`.
 * The app downscales the photo before upload, so a body over ~6 MB is refused.
 *
 * Server env (never EXPO_PUBLIC_): ANTHROPIC_API_KEY, and optionally FOOD_VISION_MODEL
 * (default claude-sonnet-5-5).
 */

const DEFAULT_MODEL = 'claude-sonnet-5-5';
const MAX_BASE64 = 6_000_000;
const MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
type MediaType = (typeof MEDIA_TYPES)[number];

/** Models that accept the server-side refusal fallback (`fallbacks: "default"`). */
const FALLBACK_MODELS = new Set(['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-opus-5', 'claude-fable-5-1']);

const SYSTEM = `You estimate the nutrition of food in a photo for an endurance cyclist's food log.

List each distinct food or drink you can see as its own item (for a plated meal: the protein, the starch, the vegetables, any sauce or dressing). For each item estimate the portion weight in grams as served, then kcal, carbohydrate, protein and fat in grams for that portion. Use visual cues for scale (plate and cutlery size, packaging, hands). If a package label is legible, use it.

Be realistic rather than conservative: include cooking oil, butter and sauces you can reasonably infer, and say so in notes. Set confidence to "high" only for packaged or clearly portioned foods, "medium" for typical home or restaurant plates, and "low" for mixed dishes, hidden ingredients or unclear portions.

If the photo contains no food or drink, set food_found to false and return an empty items list.

Keep names short (a few words, sentence case). Keep notes to one or two short sentences.`;

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['food_found', 'items', 'notes'],
  properties: {
    food_found: { type: 'boolean' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'grams', 'kcal', 'carbs', 'protein', 'fat', 'confidence'],
        properties: {
          name: { type: 'string' },
          grams: { type: 'number' },
          kcal: { type: 'number' },
          carbs: { type: 'number' },
          protein: { type: 'number' },
          fat: { type: 'number' },
          confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
        },
      },
    },
    notes: { type: 'string' },
  },
} as const;

interface ModelOutput {
  food_found: boolean;
  items: { name: string; grams: number; kcal: number; carbs: number; protein: number; fat: number; confidence: Confidence }[];
  notes: string;
}

const fail = (error: AnalyzeErrorCode, message: string, status: number) =>
  Response.json({ error, message } satisfies AnalyzeError, { status });

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return fail('not_configured', 'The food photo service is not set up yet (no ANTHROPIC_API_KEY on the server).', 503);
  }

  let image: string;
  let mediaType: MediaType;
  try {
    const body = (await request.json()) as { image?: unknown; mediaType?: unknown };
    if (typeof body.image !== 'string' || body.image.length < 100) throw new Error('missing image');
    if (body.image.length > MAX_BASE64) {
      return fail('bad_request', 'That photo is too large. Try again with a smaller image.', 413);
    }
    image = body.image.replace(/^data:image\/\w+;base64,/, '');
    mediaType = MEDIA_TYPES.includes(body.mediaType as MediaType) ? (body.mediaType as MediaType) : 'image/jpeg';
  } catch {
    return fail('bad_request', 'Send a JSON body with a base64 image.', 400);
  }

  const model = process.env.FOOD_VISION_MODEL?.trim() || DEFAULT_MODEL;
  const client = new Anthropic({ apiKey, timeout: 60_000, maxRetries: 1 });

  let message: Anthropic.Beta.BetaMessage;
  try {
    const useFallback = FALLBACK_MODELS.has(model);
    message = await client.beta.messages.create({
      model,
      max_tokens: 4000,
      // Medium effort keeps a phone round trip short; the estimate is reviewed by the user anyway.
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
      // On a safety decline, let the API retry on Anthropic's recommended fallback model.
      ...(useFallback ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
            { type: 'text', text: 'Estimate the nutrition of everything in this photo.' },
          ],
        },
      ],
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
      return fail('not_configured', 'The server’s Anthropic API key was rejected.', 503);
    }
    if (err instanceof Anthropic.RateLimitError) {
      return fail('rate_limited', 'Too many photo requests right now. Try again in a minute.', 429);
    }
    if (err instanceof Anthropic.BadRequestError || err instanceof Anthropic.NotFoundError) {
      console.error('[food/analyze] request rejected', err.status, err.message);
      return fail('upstream', 'The photo service rejected the request. Check FOOD_VISION_MODEL and the image.', 502);
    }
    if (err instanceof Anthropic.APIError) {
      console.error('[food/analyze] api error', err.status, err.message);
      return fail('upstream', 'The photo service is unavailable. Try again shortly.', 502);
    }
    console.error('[food/analyze] unexpected', err);
    return fail('upstream', 'Could not reach the photo service.', 502);
  }

  if (message.stop_reason === 'refusal') {
    return fail('refused', 'The model declined this photo. Log it manually instead.', 422);
  }
  if (message.stop_reason === 'max_tokens') {
    return fail('upstream', 'The estimate was cut short. Try a photo with fewer items.', 502);
  }

  const text = message.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')?.text;
  let out: ModelOutput;
  try {
    out = JSON.parse(text ?? '') as ModelOutput;
  } catch {
    return fail('upstream', 'The photo service returned an unreadable estimate. Try again.', 502);
  }

  const items: EstimatedItem[] = (Array.isArray(out.items) ? out.items : [])
    .map((i) => ({
      name: String(i.name ?? '').trim().slice(0, 80) || 'Food',
      grams: clean(i.grams, 5000),
      kcal: Math.round(clean(i.kcal, 10000)),
      carbs: clean(i.carbs, 2000),
      protein: clean(i.protein, 2000),
      fat: clean(i.fat, 2000),
      confidence: (['low', 'medium', 'high'] as const).includes(i.confidence) ? i.confidence : 'low',
    }))
    .filter((i) => i.kcal > 0 || i.grams > 0);

  if (!out.food_found || items.length === 0) {
    return fail('no_food', 'No food found in that photo. Try a closer, well-lit shot, or log it manually.', 422);
  }

  return Response.json({
    items,
    totals: sumTotals(items),
    notes: String(out.notes ?? '').slice(0, 400),
    model: message.model,
  } satisfies AnalyzeResponse);
}
