'use client';
import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { browserClient } from '@/lib/supabase/client';

export default function SignIn({ onSignedIn }: { onSignedIn: () => void }) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState(''), [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const client = browserClient();
      const result = mode === 'signin'
        ? await client.auth.signInWithPassword({ email: email.trim(), password })
        : await client.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: location.origin + '/auth/callback' } });
      if (result.error) throw result.error;
      if (result.data.session) { setPassword(''); onSignedIn(); }
      else setNotice('Check your email to confirm your account, then sign in here.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not sign in. Please try again.'); }
    finally { setBusy(false); }
  }
  return <section className="signin-panel"><p className="mono muted">Your performance, on record.</p><h1 className="num">Make your<br />mark<span className="orange">.</span></h1><p>Track your best. See your friends’ progress.</p>
    <form onSubmit={submit} className="auth-form">
      <div className="dialog-tabs"><button type="button" className={mode === 'signin' ? 'active' : ''} onClick={() => { setMode('signin'); setError(''); setNotice(''); }}>Sign in</button><button type="button" className={mode === 'signup' ? 'active' : ''} onClick={() => { setMode('signup'); setError(''); setNotice(''); }}>Create account</button></div>
      <label className="field">Email<input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required maxLength={254} /></label>
      <label className="field">Password<input type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} required minLength={mode === 'signup' ? 8 : 1} maxLength={128} /></label>
      {error && <p role="alert" className="error-message">{error}</p>}{notice && <p role="status" className="photo-help">{notice}</p>}
      <button className="action-button" disabled={busy}>{busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}<ArrowRight size={16} /></button>
    </form>
  </section>;
}
