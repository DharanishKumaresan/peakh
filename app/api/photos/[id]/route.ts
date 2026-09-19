import { database, json, photoStorage, userId } from '../../storage';
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = userId(request);
  if (!user) return json({ error: 'Please sign in.' }, 401);
  try {
    const { id } = await params;
    const row = await database().prepare(`SELECT p.photo_key FROM profiles p WHERE p.id = ? AND (p.user_id = ? OR EXISTS (
      SELECT 1 FROM friendships f WHERE f.status = 'accepted' AND ((f.user_a = ? AND f.user_b = p.user_id) OR (f.user_b = ? AND f.user_a = p.user_id))))`)
      .bind(id, user, user, user).first<{ photo_key: string | null }>();
    if (!row?.photo_key) return json({ error: 'Photo unavailable.' }, 404);
    const photo = await photoStorage().get(row.photo_key);
    if (!photo) return json({ error: 'Photo unavailable.' }, 404);
    return new Response(photo.body, { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': 'inline; filename="profile.jpg"' } });
  } catch (e) { console.error('Photo load failed', e); return json({ error: 'Photo temporarily unavailable.' }, 503); }
}
