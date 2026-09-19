import { database, ensureProfile, json, photoStorage, photoUrl, sameOrigin, userId } from '../../storage';

const maxBytes = 512 * 1024;
// Only accept the small JPEG produced by the photo editor, never active formats such as SVG.
function validJpeg(bytes: Uint8Array) {
  if (bytes.length < 4 || bytes[0] !== 255 || bytes[1] !== 216 || bytes.at(-2) !== 255 || bytes.at(-1) !== 217) return false;
  let offset = 2;
  while (offset + 8 < bytes.length && bytes[offset] === 255) {
    const marker = bytes[offset + 1], length = bytes[offset + 2] * 256 + bytes[offset + 3];
    if (length < 2 || offset + 2 + length > bytes.length) return false;
    if ([192, 193, 194].includes(marker)) {
      const height = bytes[offset + 5] * 256 + bytes[offset + 6], width = bytes[offset + 7] * 256 + bytes[offset + 8];
      return width > 0 && width <= 512 && height > 0 && height <= 512;
    }
    offset += 2 + length;
  }
  return false;
}
export async function PUT(request: Request) {
  const user = userId(request);
  if (!user) return json({ error: 'Please sign in again.' }, 401);
  if (!sameOrigin(request)) return json({ error: 'Request origin is not allowed.' }, 403);
  if (request.headers.get('content-type') !== 'image/jpeg') return json({ error: 'Choose a JPG, PNG or WebP photo using the photo picker.' }, 415);
  if (Number(request.headers.get('content-length')) > maxBytes) return json({ error: 'This photo is too large.' }, 413);
  try {
    const reader = request.body?.getReader();
    if (!reader) return json({ error: 'Choose a photo first.' }, 400);
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) {
      const next = await reader.read(); if (next.done) break;
      size += next.value.length;
      if (size > maxBytes) { await reader.cancel(); return json({ error: 'This photo is too large.' }, 413); }
      chunks.push(next.value);
    }
    const bytes = new Uint8Array(size); let position = 0;
    for (const chunk of chunks) { bytes.set(chunk, position); position += chunk.length; }
    if (!validJpeg(bytes)) return json({ error: 'This photo could not be read. Choose another image.' }, 400);
    const profile = await ensureProfile(request, user), bucket = photoStorage();
    const key = 'avatars/' + crypto.randomUUID() + '.jpg';
    await bucket.put(key, bytes, { httpMetadata: { contentType: 'image/jpeg' } });
    try { await database().prepare('UPDATE profiles SET photo_key = ? WHERE user_id = ?').bind(key, user).run(); }
    catch (e) { await bucket.delete(key).catch(() => {}); throw e; }
    if (profile.photo_key) await bucket.delete(profile.photo_key).catch(e => console.error('Old photo cleanup failed', e));
    return json({ photoUrl: photoUrl(profile.id, key) });
  } catch (e) { console.error('Photo save failed', e); return json({ error: 'Could not save your photo. Please try again.' }, 503); }
}
export async function DELETE(request: Request) {
  const user = userId(request);
  if (!user) return json({ error: 'Please sign in again.' }, 401);
  if (!sameOrigin(request)) return json({ error: 'Request origin is not allowed.' }, 403);
  try {
    const profile = await ensureProfile(request, user);
    await database().prepare('UPDATE profiles SET photo_key = NULL WHERE user_id = ?').bind(user).run();
    if (profile.photo_key) await photoStorage().delete(profile.photo_key).catch(e => console.error('Photo cleanup failed', e));
    return json({ photoUrl: null });
  } catch (e) { console.error('Photo removal failed', e); return json({ error: 'Could not remove your photo. Please try again.' }, 503); }
}
