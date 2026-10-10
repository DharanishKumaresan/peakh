import { z } from 'zod';
import { today } from '../../records';
import { rpc, ensureBoard, json, sameOrigin, userId } from '../storage';

const value = z.number().finite().positive().max(1000000);
const validDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => {
  const d = new Date(s + 'T12:00:00Z');
  return s <= today() && !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
});
const schema = z.object({
  sample: z.boolean(),
  activities: z.array(z.object({ id: z.string().min(1).max(100), name: z.string().trim().min(1).max(45), category: z.string().max(100), unit: z.enum(['reps','kg','lb','min:sec','sec','km','m']), lower: z.boolean(), goal: z.number().finite().min(0).max(1000000), entries: z.array(z.object({ id: z.string().min(1).max(100), date: validDate, value })).max(10000).refine(entries => new Set(entries.map(e => e.id)).size === entries.length) })).max(100),
  friends: z.array(z.unknown()).max(100),
}).refine(s => new Set(s.activities.map(a => a.id)).size === s.activities.length);

export async function GET(request: Request) {
  const user = await userId(request);
  if (!user) return json({ error: 'Sign in to save and share your records.' }, 401);
  try {
    const row = await ensureBoard(request, user);
    return json({ ...JSON.parse(row.state), version: row.updated_at }, 200, { ETag: JSON.stringify(row.updated_at) });
  } catch (e) { console.error('Record load failed', e); return json({ error: 'Records are temporarily unavailable. Please try again.' }, 503); }
}
export async function PUT(request: Request) {
  const user = await userId(request);
  if (!user) return json({ error: 'Please sign in again.' }, 401);
  if (!sameOrigin(request)) return json({ error: 'Request origin is not allowed.' }, 403);
  try {
    const raw = await request.text();
    if (raw.length > 2000000) return json({ error: 'Record limit reached.' }, 413);
    let parsed, body;
    try { body = JSON.parse(raw); parsed = schema.safeParse(body); } catch { return json({ error: 'Please check your values and dates.' }, 400); }
    if (!parsed.success) return json({ error: 'Please check your values and dates.' }, 400);
    // Keep the header fallback for tabs running the previous release.
    const expected = typeof body.expectedVersion === 'string' && body.expectedVersion
      ? body.expectedVersion : request.headers.get('if-match')?.replace(/^"|"$/g, '');
    if (!expected) return json({ error: 'Reload your records before saving.' }, 428);
    const result = await rpc<{ saved: boolean; version: string }>('board_save', { state: { ...parsed.data, friends: [] }, expected });
    if (!result.saved) return json({ error: 'Your records changed on another device. We refreshed them; submit again to save this entry.' }, 409);
    return json({ saved: true, version: result.version }, 200, { ETag: JSON.stringify(result.version) });
  } catch (e) { console.error('Record save failed', e); return json({ error: 'Could not save. Your input is still here; please try again.' }, 503); }
}
