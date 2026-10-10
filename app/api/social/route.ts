import { z } from 'zod';
import { publicRecords } from '../../social';
import { type RecordState } from '../../records';
import { rpc, json, sameOrigin, userId, photoUrl, type ProfileRow } from '../storage';
type Peer = { connection_id: string; requested_by: string; status: string; id: string; name: string; photo_key: string | null; state: RecordState | null };
export async function GET(request: Request) {
  const user = await userId(request);
  if (!user) return json({ error: 'Please sign in.' }, 401);
  try {
    const { self, peers } = await rpc<{ self: ProfileRow; peers: Peer[] }>('social_get');
    return json({ self: { id: self.id, name: self.name, code: self.code, photoUrl: photoUrl(self.id, self.photo_key) },
      friends: peers.filter(r => r.status === 'accepted').map(r => ({ id: r.id, name: r.name, photoUrl: photoUrl(r.id, r.photo_key), records: r.state ? publicRecords(r.state) : [] })),
      requests: peers.filter(r => r.status === 'pending').map(r => ({ id: r.connection_id, person: { id: r.id, name: r.name }, incoming: r.requested_by !== user })),
    });
  } catch (e) { console.error('Friend load failed', e); return json({ error: 'Could not refresh friends. Please try again.' }, 503); }
}
const requestSchema = z.object({ code: z.string().trim().transform(s => s.replace(/[\s-]/g, '').toUpperCase()).pipe(z.string().regex(/^[A-F0-9]{16}$/)) });
export async function POST(request: Request) {
  if (!await userId(request)) return json({ error: 'Please sign in.' }, 401);
  if (!sameOrigin(request)) return json({ error: 'Request origin is not allowed.' }, 403);
  try {
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) return json({ error: 'Enter a valid 16-character friend code.' }, 400);
    const result = await rpc<{ error?: string; status: number }>('request_friend', parsed.data);
    return json(result.error ? { error: result.error } : { saved: true }, result.status);
  } catch (e) { console.error('Friend request failed', e); return json({ error: 'Could not send this request. Please try again.' }, 503); }
}
const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('rename'), name: z.string().trim().min(1).max(50) }),
  z.object({ action: z.literal('accept'), id: z.string().uuid() }),
  z.object({ action: z.literal('dismiss'), id: z.string().uuid() }),
  z.object({ action: z.literal('remove'), id: z.string().uuid() }),
]);
export async function PATCH(request: Request) {
  if (!await userId(request)) return json({ error: 'Please sign in.' }, 401);
  if (!sameOrigin(request)) return json({ error: 'Request origin is not allowed.' }, 403);
  try {
    const parsed = actionSchema.safeParse(await request.json());
    if (!parsed.success) return json({ error: 'Please check your request.' }, 400);
    const result = await rpc<{ saved: boolean }>('social_action', parsed.data);
    return result.saved ? json(result) : json({ error: 'This connection changed. Refresh and try again.' }, 404);
  } catch (e) { console.error('Friend update failed', e); return json({ error: 'Could not update this connection.' }, 503); }
}
