import { z } from 'zod';
import { publicRecords } from '../../social';
import { database, ensureProfile, json, sameOrigin, userId, type ProfileRow } from '../storage';

export async function GET(request: Request) {
  const user = userId(request);
  if (!user) return json({ error: 'Please sign in.' }, 401);
  try {
    const db = database(), self = await ensureProfile(request, user);
    const result = await db.prepare(`SELECT f.id AS connection_id, f.requested_by, f.status, p.id, p.name, b.state
      FROM friendships f JOIN profiles p ON p.user_id = CASE WHEN f.user_a = ? THEN f.user_b ELSE f.user_a END
      LEFT JOIN record_boards b ON b.owner = 'user:' || p.user_id
      WHERE f.user_a = ? OR f.user_b = ? ORDER BY f.created_at DESC`).bind(user, user, user).all<{ connection_id: string; requested_by: string; status: string; id: string; name: string; state: string | null }>();
    return json({ self: { id: self.id, name: self.name, code: self.code },
      friends: result.results.filter(r => r.status === 'accepted').map(r => ({ id: r.id, name: r.name, records: r.state ? publicRecords(JSON.parse(r.state)) : [] })),
      requests: result.results.filter(r => r.status === 'pending').map(r => ({ id: r.connection_id, person: { id: r.id, name: r.name }, incoming: r.requested_by !== user })),
    });
  } catch (e) { console.error('Friend load failed', e); return json({ error: 'Could not refresh friends. Please try again.' }, 503); }
}
const requestSchema = z.object({ code: z.string().trim().transform(s => s.replace(/[\s-]/g, '').toUpperCase()).pipe(z.string().regex(/^[A-F0-9]{16}$/)) });
export async function POST(request: Request) {
  const user = userId(request);
  if (!user) return json({ error: 'Please sign in.' }, 401);
  if (!sameOrigin(request)) return json({ error: 'Request origin is not allowed.' }, 403);
  try {
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) return json({ error: 'Enter a valid 16-character friend code.' }, 400);
    const db = database();
    await ensureProfile(request, user);
    const target = await db.prepare('SELECT user_id, id, name, code FROM profiles WHERE code = ?').bind(parsed.data.code).first<ProfileRow>();
    if (!target) return json({ error: 'No profile has that code. Check it with your friend.' }, 404);
    if (target.user_id === user) return json({ error: 'That is your own friend code.' }, 400);
    const [a, b] = [user, target.user_id].sort();
    const count = await db.prepare('SELECT COUNT(*) AS total FROM friendships WHERE user_a = ? OR user_b = ? OR user_a = ? OR user_b = ?').bind(user, user, target.user_id, target.user_id).first<{ total: number }>();
    if ((count?.total || 0) >= 200) return json({ error: 'Friend request limit reached. Clear pending requests first.' }, 400);
    const result = await db.prepare("INSERT OR IGNORE INTO friendships (user_a, user_b, id, requested_by, status, created_at) VALUES (?, ?, ?, ?, 'pending', ?)")
      .bind(a, b, crypto.randomUUID(), user, new Date().toISOString()).run();
    if (!result.meta.changes) return json({ error: 'You are already connected or have a pending request. Check your requests.' }, 409);
    return json({ saved: true }, 201);
  } catch (e) { console.error('Friend request failed', e); return json({ error: 'Could not send this request. Please try again.' }, 400); }
}
const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('rename'), name: z.string().trim().min(1).max(50) }),
  z.object({ action: z.literal('accept'), id: z.string().uuid() }),
  z.object({ action: z.literal('dismiss'), id: z.string().uuid() }),
  z.object({ action: z.literal('remove'), id: z.string().uuid() }),
]);
export async function PATCH(request: Request) {
  const user = userId(request);
  if (!user) return json({ error: 'Please sign in.' }, 401);
  if (!sameOrigin(request)) return json({ error: 'Request origin is not allowed.' }, 403);
  try {
    const parsed = actionSchema.safeParse(await request.json());
    if (!parsed.success) return json({ error: 'Please check your request.' }, 400);
    const db = database(), action = parsed.data;
    await ensureProfile(request, user);
    if (action.action === 'rename') {
      await db.prepare('UPDATE profiles SET name = ? WHERE user_id = ?').bind(action.name, user).run();
      return json({ saved: true });
    }
    let result;
    if (action.action === 'accept') result = await db.prepare("UPDATE friendships SET status = 'accepted' WHERE id = ? AND status = 'pending' AND requested_by != ? AND (user_a = ? OR user_b = ?)").bind(action.id, user, user, user).run();
    else if (action.action === 'dismiss') result = await db.prepare("DELETE FROM friendships WHERE id = ? AND status = 'pending' AND (user_a = ? OR user_b = ?)").bind(action.id, user, user).run();
    else result = await db.prepare("DELETE FROM friendships WHERE status = 'accepted' AND ((user_a = ? AND user_b = (SELECT user_id FROM profiles WHERE id = ?)) OR (user_b = ? AND user_a = (SELECT user_id FROM profiles WHERE id = ?)))").bind(user, action.id, user, action.id).run();
    return result.meta.changes ? json({ saved: true }) : json({ error: 'This connection changed. Refresh and try again.' }, 404);
  } catch (e) { console.error('Friend update failed', e); return json({ error: 'Could not update this connection.' }, 400); }
}
