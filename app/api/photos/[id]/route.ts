import { rpc, json, photoStorage, userId } from '../../storage';
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await userId(request)) return json({ error: 'Please sign in.' }, 401);
  try {
    const { id } = await params;
    const row = await rpc<{ photo_key: string | null } | null>('friend_get', { id });
    if (!row?.photo_key) return json({ error: 'Photo unavailable.' }, 404);
    const photo = await (await photoStorage()).get(row.photo_key);
    if (!photo) return json({ error: 'Photo unavailable.' }, 404);
    return new Response(photo.body, { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': 'inline; filename="profile.jpg"' } });
  } catch (e) { console.error('Photo load failed', e); return json({ error: 'Photo temporarily unavailable.' }, 503); }
}
