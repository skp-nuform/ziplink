import { createHash } from 'node:crypto';
import { database } from './database';
import { InputError } from './links-server';

export async function limitCreation(request: Request, owner: boolean) {
  const db = database();
  const now = Date.now();
  async function take(bucket: string, limit: number, expires: number, message: string) {
    const row = await db.prepare('INSERT INTO creation_limits (bucket, attempts, expires_at) VALUES (?, 1, ?) ON CONFLICT(bucket) DO UPDATE SET attempts = creation_limits.attempts + 1 WHERE creation_limits.attempts < ? RETURNING attempts')
      .bind(bucket, expires, limit).first();
    if (!row) throw new InputError(message, 429);
  }
  if (!owner) {
    const window = Math.floor(now / 600000);
    // Trust Vercel's proxy header, never client-supplied forwarding headers.
    const ip = process.env.VERCEL ? request.headers.get('x-vercel-forwarded-for') || 'unknown' : 'local';
    const key = createHash('sha256').update(ip + ':' + window).digest('hex');
    await take('visitor:' + key, 10, (window + 1) * 600000, 'You’ve reached the limit of 10 links. Please try again in ten minutes.');
  }
  const minute = Math.floor(now / 60000);
  await take('global:' + minute, 30, (minute + 1) * 60000, 'Lots of links are being created. Please try again in one minute.');
  await db.prepare('DELETE FROM creation_limits WHERE expires_at < ?').bind(now).run();
}
