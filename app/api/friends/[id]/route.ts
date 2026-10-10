import { sharedActivities } from '../../../social';
import { type RecordState } from '../../../records';
import { rpc, json, userId, photoUrl } from '../../storage';
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await userId(request)) return json({ error: 'Please sign in.' }, 401);
  try {
    const { id } = await params;
    const row = await rpc<{ id: string; name: string; photo_key: string | null; state: RecordState | null } | null>('friend_get', { id });
    if (!row) return json({ error: 'This profile is available only to accepted friends.' }, 404);
    return json({ id: row.id, name: row.name, photoUrl: photoUrl(row.id, row.photo_key), activities: row.state ? sharedActivities(row.state) : [] });
  } catch (e) { console.error('Profile load failed', e); return json({ error: 'Could not load this profile. Please try again.' }, 503); }
}
