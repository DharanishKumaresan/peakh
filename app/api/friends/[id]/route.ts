import { sharedActivities } from '../../../social';
import { database, json, userId } from '../../storage';
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = userId(request);
  if (!user) return json({ error: 'Please sign in.' }, 401);
  const { id } = await params;
  try {
    const row = await database().prepare(`SELECT p.id, p.name, b.state FROM profiles p
      LEFT JOIN record_boards b ON b.owner = 'user:' || p.user_id
      WHERE p.id = ? AND (p.user_id = ? OR EXISTS (SELECT 1 FROM friendships f WHERE f.status = 'accepted'
        AND ((f.user_a = ? AND f.user_b = p.user_id) OR (f.user_b = ? AND f.user_a = p.user_id))))`)
      .bind(id, user, user, user).first<{ id: string; name: string; state: string | null }>();
    if (!row) return json({ error: 'This profile is available only to accepted friends.' }, 404);
    return json({ id: row.id, name: row.name, activities: row.state ? sharedActivities(JSON.parse(row.state)) : [] });
  } catch (e) { console.error('Profile load failed', e); return json({ error: 'Could not load this profile. Please try again.' }, 503); }
}
