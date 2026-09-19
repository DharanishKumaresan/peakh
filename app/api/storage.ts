import { env } from 'cloudflare:workers';
import { makeSeed, type RecordState } from '../records';
export function database() { if (!env.DB) throw Error('Database unavailable'); return env.DB; }
export function photoStorage() { if (!env.PHOTOS) throw Error('Photo storage unavailable'); return env.PHOTOS; }
export function photoUrl(id: string, key: string | null) { return key ? '/api/photos/' + encodeURIComponent(id) + '?v=' + encodeURIComponent(key) : null; }
export function userId(request: Request) { return request.headers.get('oai-authenticated-user-id'); }
export function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store', ...extra } });
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  return (!origin || origin === new URL(request.url).origin) && request.headers.get('sec-fetch-site') !== 'cross-site';
}
export type ProfileRow = { user_id: string; id: string; name: string; code: string; photo_key: string | null };
export async function ensureProfile(request: Request, user: string) {
  const db = database();
  let profile = await db.prepare('SELECT user_id, id, name, code, photo_key FROM profiles WHERE user_id = ?').bind(user).first<ProfileRow>();
  if (profile) return profile;
  let name = 'Athlete';
  if (request.headers.get('oai-authenticated-user-full-name-encoding') === 'percent-encoded-utf-8') {
    try { name = decodeURIComponent(request.headers.get('oai-authenticated-user-full-name') || '').trim().slice(0, 50) || name; } catch { /* Keep the private fallback. */ }
  }
  await db.prepare('INSERT OR IGNORE INTO profiles (user_id, id, name, code, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(user, crypto.randomUUID(), name, crypto.randomUUID().replace(/-/g, '').slice(0, 16).toUpperCase(), new Date().toISOString()).run();
  profile = await db.prepare('SELECT user_id, id, name, code, photo_key FROM profiles WHERE user_id = ?').bind(user).first<ProfileRow>();
  if (!profile) throw Error('Could not create profile');
  return profile;
}
export async function ensureBoard(request: Request, user: string) {
  const db = database(), owner = 'user:' + user;
  const existing = await db.prepare('SELECT state, updated_at FROM record_boards WHERE owner = ?').bind(owner).first<{ state: string; updated_at: string }>();
  if (existing) return existing;
  // Preserve this browser's pre-sign-in records when creating its account board.
  const legacy = request.headers.get('cookie')?.match(/(?:^|;\s*)peakh_board=([a-f0-9-]{36})(?:;|$)/)?.[1];
  const seed = makeSeed();
  const empty: RecordState = { sample: false, friends: [], activities: seed.activities.map(a => ({ ...a, entries: [] })) };
  const old = legacy ? await db.prepare('SELECT state FROM record_boards WHERE owner = ?').bind('browser:' + legacy).first<{ state: string }>() : null;
  await db.prepare('INSERT OR IGNORE INTO record_boards (owner, state, updated_at) VALUES (?, ?, ?)').bind(owner, old?.state || JSON.stringify(empty), crypto.randomUUID()).run();
  return (await db.prepare('SELECT state, updated_at FROM record_boards WHERE owner = ?').bind(owner).first<{ state: string; updated_at: string }>())!;
}
