import { createHmac, createHash, timingSafeEqual, randomBytes } from 'node:crypto';
export const cookieName = 'shortly_session';
export const sessionSeconds = 60 * 60 * 24 * 7;
export function configured(secret = process.env.SHORTLY_ADMIN_PASSWORD) { return !!secret && secret.length >= 24; }
export function passwordMatches(input: string, secret = process.env.SHORTLY_ADMIN_PASSWORD) {
  if (!configured(secret)) return false;
  return timingSafeEqual(createHash('sha256').update(input).digest(), createHash('sha256').update(secret!).digest());
}
export function makeSession(secret = process.env.SHORTLY_ADMIN_PASSWORD, now = Date.now()) {
  if (!configured(secret)) throw new Error('Owner password is not configured');
  const value = String(now + sessionSeconds * 1000) + '.' + randomBytes(16).toString('hex');
  return value + '.' + createHmac('sha256', secret!).update(value).digest('hex');
}
export function validSession(token: string, secret = process.env.SHORTLY_ADMIN_PASSWORD, now = Date.now()) {
  if (!configured(secret)) return false;
  const parts = token.split('.');
  if (parts.length !== 3 || !/^\d{13}$/.test(parts[0]) || !/^[a-f0-9]{32}$/.test(parts[1]) || !/^[a-f0-9]{64}$/.test(parts[2])) return false;
  const expiry = Number(parts[0]);
  if (expiry <= now || expiry > now + sessionSeconds * 1000) return false;
  const expected = createHmac('sha256', secret!).update(parts[0] + '.' + parts[1]).digest();
  return timingSafeEqual(expected, Buffer.from(parts[2], 'hex'));
}
export function ownerAccess(headers: Headers) {
  const cookie = (headers.get('cookie') || '').split(';').map(v => v.trim()).find(v => v.startsWith(cookieName + '='));
  return validSession(cookie?.slice(cookieName.length + 1) || '');
}
