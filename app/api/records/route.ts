import { z } from 'zod';
import { today } from '../../records';
import { database, ensureBoard, json, sameOrigin, userId } from '../storage';

const value = z.number().finite().positive().max(1000000);
const validDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => {
  const d = new Date(s + 'T12:00:00Z');
  return s <= today() && !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
});
const schema = z.object({
  sample: z.boolean(),
  activities: z.array(z.object({ id: z.string().min(1).max(100), name: z.string().trim().min(1).max(45), category: z.string().max(100), unit: z.enum(['reps','kg','lb','min:sec','sec','km','m']), lower: z.boolean(), goal: z.number().finite().min(0).max(1000000), entries: z.array(z.object({ id: z.string().min(1).max(100), date: validDate, value })).max(10000).refine(entries => new Set(entries.map(e => e.id)).size === entries.length) })).min(1).max(100),
  friends: z.array(z.unknown()).max(100),
}).refine(s => new Set(s.activities.map(a => a.id)).size === s.activities.length);

export async function GET(request: Request) {
  const user = userId(request);
  if (!user) return json({ error: 'Sign in to save and share your records.' }, 401);
  try {
    const row = await ensureBoard(request, user);
    return json(JSON.parse(row.state), 200, { ETag: row.updated_at });
  } catch (e) { console.error('Record load failed', e); return json({ error: 'Records are temporarily unavailable. Please try again.' }, 503); }
}
export async function PUT(request: Request) {
  const user = userId(request);
  if (!user) return json({ error: 'Please sign in again.' }, 401);
  if (!sameOrigin(request)) return json({ error: 'Request origin is not allowed.' }, 403);
  try {
    const raw = await request.text();
    if (raw.length > 2000000) return json({ error: 'Record limit reached.' }, 413);
    let parsed;
    try { parsed = schema.safeParse(JSON.parse(raw)); } catch { return json({ error: 'Please check your values and dates.' }, 400); }
    if (!parsed.success) return json({ error: 'Please check your values and dates.' }, 400);
    const expected = request.headers.get('if-match');
    if (!expected) return json({ error: 'Reload your records before saving.' }, 428);
    const version = crypto.randomUUID();
    const result = await database().prepare('UPDATE record_boards SET state = ?, updated_at = ? WHERE owner = ? AND updated_at = ?')
      .bind(JSON.stringify({ ...parsed.data, friends: [] }), version, 'user:' + user, expected).run();
    if (!result.meta.changes) return json({ error: 'Your records changed on another device. We refreshed them; submit again to save this entry.' }, 409);
    return json({ saved: true }, 200, { ETag: version });
  } catch (e) { console.error('Record save failed', e); return json({ error: 'Could not save. Your input is still here; please try again.' }, 503); }
}
