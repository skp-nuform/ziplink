import { createHash } from 'node:crypto';
import { body, InputError, json, routeError } from '@/lib/links-server';
import { database } from '@/lib/database';
import { configured, passwordMatches, makeSession, cookieName, sessionSeconds } from '@/lib/authorization';
export async function POST(request: Request) {
  try {
    const origin = request.headers.get('origin');
    if ((origin && origin !== new URL(request.url).origin) || request.headers.get('sec-fetch-site') === 'cross-site' || request.headers.get('x-shortly-request') !== '1') throw new InputError('Open Shortly directly to sign in.',403);
    if (!configured()) throw new InputError('Workspace setup is not complete.',503);
    const input = await body(request);
    if (typeof input.password !== 'string' || input.password.length > 256) throw new InputError('Enter your owner password.',400);
    const db = database(); const now = Date.now(); const window = Math.floor(now / 600000);
    // Vercel supplies this trusted proxy header. The global bucket also limits
    // distributed attempts. Raw IP addresses are never stored.
    const ip = process.env.VERCEL ? request.headers.get('x-vercel-forwarded-for') || 'unknown' : 'local';
    const hash = createHash('sha256').update(ip + ':' + window).digest('hex');
    for (const [key,limit] of [[hash,10],['global',100]] as const) {
      const row = await db.prepare('INSERT INTO login_attempts (bucket, attempts, expires_at) VALUES (?, 1, ?) ON CONFLICT(bucket) DO UPDATE SET attempts = login_attempts.attempts + 1 WHERE login_attempts.attempts < ? RETURNING attempts').bind(String(window) + ':' + key, (window + 1) * 600000, limit).first();
      if (!row) throw new InputError('Too many attempts. Try again in ten minutes.',429);
    }
    await db.prepare('DELETE FROM login_attempts WHERE expires_at < ?').bind(now).run();
    if (!passwordMatches(input.password)) throw new InputError('That password is not correct.',401);
    const response = json({ok:true});
    response.headers.set('Set-Cookie', cookieName + '=' + makeSession() + '; Path=/; HttpOnly; SameSite=Strict; Max-Age=' + sessionSeconds + (process.env.VERCEL || new URL(request.url).protocol === 'https:' ? '; Secure' : ''));
    return response;
  } catch(error) { return routeError(error); }
}
