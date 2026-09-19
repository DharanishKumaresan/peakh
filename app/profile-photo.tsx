'use client';
import { useEffect, useState } from 'react';
import { Camera } from 'lucide-react';

export function Avatar({ name, src, large = false }: { name: string; src?: string | null; large?: boolean }) {
  const [failed, setFailed] = useState<string | null>(null);
  return <span className={`avatar photo-avatar ${large ? 'avatar-large' : ''}`} aria-hidden="true">
    {src && failed !== src ?
      // Authenticated images are served directly so the viewer's session accompanies the request.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" onError={() => setFailed(src)} /> : name.trim().split(/\s+/).map(s => s[0]).slice(0, 2).join('').toUpperCase() || 'ME'}
  </span>;
}

export default function ProfilePhoto({ name, src, disabled, onSaved, onBusy }: {
  name: string; src?: string | null; disabled: boolean;
  onSaved: (url: string | null) => void; onBusy: (busy: boolean) => void;
}) {
  const [draft, setDraft] = useState<{ blob: Blob; url: string } | null>(null);
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => () => { if (draft) URL.revokeObjectURL(draft.url); }, [draft]);
  function working(value: boolean) { setBusy(value); onBusy(value); }
  async function choose(file?: File) {
    if (!file) return;
    setError('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setError('Choose a JPG, PNG or WebP image.'); return; }
    if (file.size > 10 * 1024 * 1024) { setError('Choose a photo under 10 MB.'); return; }
    working(true);
    try {
      const image = await createImageBitmap(file);
      try {
        if (image.width * image.height > 40000000) throw Error('Choose a smaller image, up to 40 megapixels.');
        const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 512;
        const ctx = canvas.getContext('2d'); if (!ctx) throw Error('Photo editing is unavailable in this browser.');
        ctx.fillStyle = '#f5f5f3'; ctx.fillRect(0, 0, 512, 512);
        const size = Math.min(image.width, image.height);
        ctx.drawImage(image, (image.width - size) / 2, (image.height - size) / 2, size, size, 0, 0, 512, 512);
        const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(Error('Could not prepare this photo.')), 'image/jpeg', 0.85));
        setDraft({ blob, url: URL.createObjectURL(blob) });
      } finally { image.close(); }
    } catch (e) { setError(e instanceof Error ? e.message : 'This image could not be read. Try another photo.'); }
    finally { working(false); }
  }
  async function save(remove = false) {
    if (busy || disabled || (!remove && !draft)) return;
    working(true); setError('');
    try {
      const response = await fetch('/api/profile/photo', { method: remove ? 'DELETE' : 'PUT', ...(remove ? {} : { headers: { 'Content-Type': 'image/jpeg' }, body: draft!.blob }) });
      const body = await response.json() as { error?: string; photoUrl: string | null };
      if (!response.ok) throw Error(body.error || 'Could not save your photo. Please try again.');
      onSaved(body.photoUrl); setDraft(null);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save your photo. Please try again.'); }
    finally { working(false); }
  }
  return <section className="photo-editor" aria-label="Profile photo">
    <div className="photo-editor-row"><Avatar name={name} src={draft?.url || src} large /><div className="photo-editor-controls">
      <label className={`secondary-button photo-picker ${busy || disabled ? 'disabled' : ''}`}><Camera size={15} />{src || draft ? 'Change photo' : 'Add photo'}
        <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" aria-label="Choose profile photo" disabled={busy || disabled} onChange={e => { void choose(e.target.files?.[0]); e.target.value = ''; }} />
      </label>
      <span className="photo-help">JPG, PNG or WebP · up to 10 MB</span>
      {src && !draft && <button type="button" className="photo-remove" disabled={busy || disabled} onClick={() => save(true)}>Remove photo</button>}
    </div></div>
    {draft && <><p className="photo-help">Preview of your photo. Visible to accepted friends.</p><div className="row-actions"><button type="button" className="action-button" disabled={busy || disabled} onClick={() => save()}>Save photo</button><button type="button" className="secondary-button" disabled={busy || disabled} onClick={() => setDraft(null)}>Cancel</button></div></>}
    {busy && <p className="photo-help" role="status">Updating photo…</p>}
    {error && <p className="error-message" role="alert">{error}</p>}
  </section>;
}
