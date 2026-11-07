import { field, tokenRequest } from '@/server/strava';

/** Exchange the one-time OAuth `code` for an access and refresh token. Body: `{ code }`. */
export async function POST(request: Request) {
  const code = await field(request, 'code');
  return tokenRequest({ code, grant_type: 'authorization_code' });
}
