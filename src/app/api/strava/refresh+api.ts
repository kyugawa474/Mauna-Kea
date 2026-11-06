import { field, tokenRequest } from '@/server/strava';

/**
 * Trade the latest refresh token for a fresh access token (they last six hours). Strava may rotate
 * the refresh token too; the app stores whichever it gets back. Body: `{ refresh_token }`.
 */
export async function POST(request: Request) {
  const refresh_token = await field(request, 'refresh_token');
  return tokenRequest({ refresh_token, grant_type: 'refresh_token' });
}
