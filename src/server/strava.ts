/**
 * Server-only Strava helpers, imported only by the API routes in src/app/api/strava/.
 * The client secret is read from the server's environment at request time and never reaches the
 * app bundle (Expo strips everything imported by a `+api.ts` file from the client).
 */

const TOKEN_URL = 'https://www.strava.com/oauth/token';

/** What the app receives: Strava's token response, with only the athlete fields the app uses. */
export interface TokenPayload {
  access_token: string;
  refresh_token: string;
  /** Seconds since the epoch. */
  expires_at: number;
  scope?: string;
  athlete?: { id: number; firstname: string; lastname: string; weight?: number | null };
}

function credentials() {
  const id = process.env.STRAVA_CLIENT_ID ?? process.env.EXPO_PUBLIC_STRAVA_CLIENT_ID;
  const secret = process.env.STRAVA_CLIENT_SECRET;
  if (!id || !secret) {
    throw Response.json(
      { error: 'Server is missing STRAVA_CLIENT_ID or STRAVA_CLIENT_SECRET (see .env.example).' },
      { status: 500 },
    );
  }
  return { id, secret };
}

/** POST to Strava's token endpoint and pass its status through, trimming the athlete object. */
export async function tokenRequest(params: Record<string, string>) {
  const { id, secret } = credentials();
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: id, client_secret: secret, ...params }).toString(),
  });
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok || !body?.access_token) {
    return Response.json({ error: 'Strava token request failed', status: res.status, detail: body }, { status: res.ok ? 502 : res.status });
  }
  const a = body.athlete as TokenPayload['athlete'] | undefined;
  const payload: TokenPayload = {
    access_token: body.access_token as string,
    refresh_token: body.refresh_token as string,
    expires_at: body.expires_at as number,
    scope: body.scope as string | undefined,
    athlete: a ? { id: a.id, firstname: a.firstname, lastname: a.lastname, weight: a.weight ?? null } : undefined,
  };
  return Response.json(payload, { headers: { 'Cache-Control': 'no-store' } });
}

/** Read one string field from a JSON body, or answer 400. */
export async function field(request: Request, name: string) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const v = body?.[name];
  if (typeof v !== 'string' || !v) throw Response.json({ error: `Missing "${name}"` }, { status: 400 });
  return v;
}
