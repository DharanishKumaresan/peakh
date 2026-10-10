import { serverClient } from '@/lib/supabase/server';
export async function userId(_request: Request) {
  const client = await serverClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}
export async function rpc<T>(action: string, payload: object = {}): Promise<T> {
  const client = await serverClient();
  const { data, error } = await client.rpc('peakh_api', { action, payload });
  if (error) throw new Error(error.message);
  return data as T;
}
export function photoUrl(id: string, key: string | null) { return key ? '/api/photos/' + encodeURIComponent(id) + '?v=' + encodeURIComponent(key) : null; }
export function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store', ...extra } });
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  return (!origin || origin === new URL(request.url).origin) && request.headers.get('sec-fetch-site') !== 'cross-site';
}
export type ProfileRow = { user_id: string; id: string; name: string; code: string; photo_key: string | null };
export async function ensureProfile(_request: Request, _user: string) { return rpc<ProfileRow>('profile_get'); }
export async function ensureBoard(_request: Request, _user: string) { return rpc<{ state: string; updated_at: string }>('board_get'); }
export async function photoStorage() {
  const client = await serverClient(), bucket = client.storage.from('peakh-photos');
  return {
    async put(key: string, bytes: Uint8Array) {
      const { error } = await bucket.upload(key, bytes, { contentType: 'image/jpeg', upsert: false });
      if (error) throw new Error(error.message);
    },
    async delete(key: string) { const { error } = await bucket.remove([key]); if (error) throw new Error(error.message); },
    async get(key: string) { const { data, error } = await bucket.download(key); if (error) return null; return { body: data }; },
  };
}
