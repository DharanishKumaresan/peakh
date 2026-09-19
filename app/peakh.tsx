'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowUpRight, ArrowLeft, ArrowRight, Plus, Sun, Moon, Menu, Grid2X2, Rows3, Users, UserRound } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { type Activity, type RecordState, best, goalProgress, formatValue as fmt, parseValue, today } from './records';
import { leaderboard, publicRecords, type SocialState, type FriendProfile } from './social';
import ActivityDetail from './activity-detail';
import ProfilePhoto, { Avatar } from './profile-photo';

type Modal = 'log' | 'create' | 'goal' | 'friend' | 'profile' | 'reset' | 'remove' | null;
const blank: RecordState = { activities: [], friends: [], sample: false };
const message = (e: unknown) => e instanceof Error ? e.message : 'Something went wrong. Please try again.';
async function readResponse<T = { saved: boolean }>(r: Response): Promise<T> {
  const body = await r.json() as T & { error?: string };
  if (!r.ok) throw Error(body.error || 'Could not complete this request.');
  return body;
}

export default function Peakh() {
  const [data, setData] = useState<RecordState>(blank);
  const [loading, setLoading] = useState(true), [auth, setAuth] = useState(false);
  const [loadError, setLoadError] = useState(''), [error, setError] = useState('');
  const [saving, setSaving] = useState(false), [theme, setTheme] = useState('light');
  const [photoBusy, setPhotoBusy] = useState(false), [arrangement, setArrangement] = useState<'grid' | 'rows'>('grid');
  const [route, setRoute] = useState(''), [modal, setModal] = useState<Modal>(null);
  const [value, setValue] = useState(''), [date, setDate] = useState(today());
  const [name, setName] = useState(''), [unit, setUnit] = useState('reps'), [lower, setLower] = useState(false);
  const [activityId, setActivityId] = useState('run'), [board, setBoard] = useState('run');
  const [social, setSocial] = useState<SocialState | null>(null), [socialError, setSocialError] = useState('');
  const [friend, setFriend] = useState<FriendProfile | null>(null), [profileError, setProfileError] = useState('');
  const [friendActivity, setFriendActivity] = useState(''), [friendsView, setFriendsView] = useState('leaderboard');
  const [code, setCode] = useState(''), [toast, setToast] = useState(''), [synced, setSynced] = useState('');
  const version = useRef(''), submitLock = useRef(false), socialSequence = useRef(0);
  const activities = data.activities;
  const active = route.startsWith('activity/') ? activities.find(a => a.id === route.slice(9)) : undefined;
  const friendId = route.startsWith('friend/') ? route.slice(7) : '';
  const isFriends = route === 'friends' || !!friendId;
  const logActivity = activities.find(a => a.id === activityId) || activities[0];
  const boardActivity = activities.find(a => a.id === board) || activities[0];
  const profileActivity = friend?.activities.find(a => a.id === friendActivity) || friend?.activities[0];
  const rankings = boardActivity && social ? leaderboard(boardActivity, { ...social.self, records: publicRecords(data) }, social.friends) : [];

  const loadRecords = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    const previousVersion = version.current;
    try {
      const r = await fetch('/api/records', { cache: 'no-store' });
      if (r.status === 401) { setAuth(false); setData(blank); setSocial(null); setFriend(null); return; }
      const body = await readResponse<RecordState>(r);
      if (version.current !== previousVersion) return;
      version.current = r.headers.get('etag') || '';
      setData(body); setAuth(true); setLoadError('');
    } catch (e) { setLoadError(message(e)); }
    finally { if (showLoading) setLoading(false); }
  }, []);
  const refreshSocial = useCallback(async (signal?: AbortSignal) => {
    const seq = ++socialSequence.current;
    try {
      const r = await fetch('/api/social', { cache: 'no-store', signal });
      if (r.status === 401) { setAuth(false); setSocial(null); setFriend(null); return; }
      const body = await readResponse<SocialState>(r);
      if (seq !== socialSequence.current || signal?.aborted) return;
      setSocial(body); setSocialError(''); setSynced(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch (e) { if (!signal?.aborted && seq === socialSequence.current) setSocialError(message(e)); }
  }, []);
  useEffect(() => {
    // Hydrate browser-only navigation/preferences and load the external account store.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRecords(true);
    try { const t = localStorage.getItem('peakh-theme') || 'light'; setTheme(t); document.documentElement.dataset.theme = t; } catch {}
    try { setArrangement(localStorage.getItem('peakh-arrangement') === 'rows' ? 'rows' : 'grid'); } catch {}
    const onHash = () => { try { setRoute(decodeURIComponent(location.hash.slice(1))); } catch { setRoute(''); } };
    onHash(); window.addEventListener('hashchange', onHash);
    const invite = new URLSearchParams(location.search).get('friend');
    if (invite) { setCode(invite); setModal('friend'); history.replaceState(null, '', location.pathname + location.hash); }
    return () => window.removeEventListener('hashchange', onHash);
  }, [loadRecords]);
  // This effect subscribes the signed-in account to its external social data.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (auth) void refreshSocial(); }, [auth, refreshSocial]);
  useEffect(() => {
    if (!auth || !isFriends) return;
    const controller = new AbortController();
    const refresh = () => { if (document.visibilityState === 'visible') { void refreshSocial(controller.signal); if (!submitLock.current) void loadRecords(); } };
    refresh();
    const timer = setInterval(refresh, 10000);
    window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', refresh);
    return () => { controller.abort(); clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [auth, isFriends, refreshSocial, loadRecords]);
  useEffect(() => {
    // Clear the previous person's private data before fetching a new profile.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!auth || !friendId) { setFriend(null); return; }
    setFriend(null); setProfileError(''); setFriendActivity('');
    const controller = new AbortController();
    let inFlight = false;
    const refresh = async () => {
      if (inFlight || document.visibilityState !== 'visible') return;
      inFlight = true;
      try {
        const r = await fetch('/api/friends/' + encodeURIComponent(friendId), { cache: 'no-store', signal: controller.signal });
        if (r.status === 401 || r.status === 404) setFriend(null);
        const body = await readResponse<FriendProfile>(r);
        if (!controller.signal.aborted) { setFriend(body); setProfileError(''); }
      } catch (e) { if (!controller.signal.aborted) setProfileError(message(e)); }
      finally { inFlight = false; }
    };
    void refresh(); const timer = setInterval(refresh, 10000);
    window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', refresh);
    return () => { controller.abort(); clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [auth, friendId]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 4000); return () => clearTimeout(timer); }, [toast]);
  // Hash navigation changes the view in this single page without a route reload.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  function navigate(path: string) { window.location.assign('#' + path); window.scrollTo({ top: 0, behavior: 'instant' }); }
  function toggleTheme() { const t = theme === 'light' ? 'dark' : 'light'; setTheme(t); document.documentElement.dataset.theme = t; try { localStorage.setItem('peakh-theme', t); } catch {} }
  function toggleArrangement() { const next = arrangement === 'grid' ? 'rows' : 'grid'; setArrangement(next); try { localStorage.setItem('peakh-arrangement', next); } catch {} }
  function open(kind: Modal, id?: string) {
    setError(''); setValue(''); setName(kind === 'profile' ? social?.self.name || '' : ''); setDate(today());
    setActivityId(id || active?.id || activities[0]?.id || 'run'); setModal(kind);
    if (kind === 'goal') { const a = activities.find(a => a.id === (id || active?.id)); if (a?.goal) setValue(fmt(a.goal, a.unit)); }
    if (kind === 'friend') { setCode(''); void refreshSocial(); }
  }
  async function commit(next: RecordState, notice: string) {
    if (submitLock.current) return false;
    submitLock.current = true; setSaving(true); setError('');
    try {
      const r = await fetch('/api/records', { method: 'PUT', headers: { 'Content-Type': 'application/json', 'If-Match': version.current }, body: JSON.stringify(next) });
      if (r.status === 409) await loadRecords();
      if (r.status === 401) setAuth(false);
      await readResponse(r);
      version.current = r.headers.get('etag') || ''; setData(next); setModal(null); setToast(notice); void refreshSocial();
      return true;
    } catch (e) { setError(message(e)); return false; }
    finally { submitLock.current = false; setSaving(false); }
  }
  async function changeSocial(body: object, method = 'PATCH', notice = 'Updated.', close = false) {
    if (submitLock.current) return;
    submitLock.current = true; setSaving(true); setError('');
    try {
      const r = await fetch('/api/social', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (r.status === 401) setAuth(false);
      await readResponse(r); await refreshSocial(); setToast(notice);
      if (close) setModal(null);
      if ('action' in body && body.action === 'remove') { setFriend(null); navigate('friends'); }
    } catch (e) { setError(message(e)); }
    finally { submitLock.current = false; setSaving(false); }
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (modal === 'friend') return changeSocial({ code }, 'POST', 'Friend request sent.', true);
    if (modal === 'profile') return changeSocial({ action: 'rename', name }, 'PATCH', 'Profile updated.', true);
    if (modal === 'create') {
      if (!name.trim()) return setError('Give this activity a name.');
      if (activities.some(a => a.name.toLowerCase() === name.trim().toLowerCase())) return setError('That activity already exists.');
      const a: Activity = { id: crypto.randomUUID(), name: name.trim(), unit, lower, category: `CUSTOM · ${lower ? 'LOWER' : 'HIGHER'} IS BETTER`, goal: 0, entries: [] };
      if (await commit({ ...data, activities: [...activities, a] }, 'Activity added.')) { setActivityId(a.id); setModal('log'); }
      return;
    }
    if (!logActivity) return;
    const n = parseValue(value, logActivity.unit);
    if (!Number.isFinite(n) || n <= 0 || n > 1000000) return setError(logActivity.unit === 'min:sec' ? 'Use minutes:seconds, for example 22:30.' : 'Enter a positive value up to 1,000,000.');
    if (modal === 'goal') { await commit({ ...data, activities: activities.map(a => a.id === activityId ? { ...a, goal: n } : a) }, 'Goal updated.'); return; }
    if (!date || date > today() || Number.isNaN(new Date(date + 'T12:00:00').getTime())) return setError('Choose today or an earlier date.');
    const isPr = !logActivity.entries.length || (logActivity.lower ? n < best(logActivity) : n > best(logActivity));
    await commit({ ...data, activities: activities.map(a => a.id === activityId ? { ...a, entries: [...a.entries, { id: crypto.randomUUID(), value: n, date }] } : a) }, isPr ? 'New personal record.' : 'Effort logged.');
  }
  async function copyInvite() {
    if (!social) return;
    try { await navigator.clipboard.writeText(location.origin + '/?friend=' + social.self.code); setToast('Invite link copied.'); }
    catch { setError('Copy your friend code below and share it with your friend.'); }
  }
  useEffect(() => {
    const mc = (document as Document & { modelContext?: { registerTool: (tool: unknown, options: unknown) => unknown } }).modelContext;
    if (!mc || !auth) return;
    const controller = new AbortController();
    try { Promise.resolve(mc.registerTool({ name: 'start_activity_log', description: 'Open the peakh log form. Does not save an entry.', inputSchema: { type: 'object', properties: { activityId: { type: 'string' } }, required: ['activityId'], additionalProperties: false }, execute: (input: { activityId: string }) => { if (!activities.some(a => a.id === input.activityId)) throw Error('Unknown activity'); setError(''); setValue(''); setName(''); setDate(today()); setActivityId(input.activityId); setModal('log'); return { opened: true }; } }, { signal: controller.signal })).catch(() => {}); } catch {}
    return () => controller.abort();
  }, [activities, auth]);
  const signin = '/signin-with-chatgpt?return_to=' + encodeURIComponent(typeof window === 'undefined' ? '/' : '/'+(code ? '?friend=' + encodeURIComponent(code) : '') + location.hash);
  const modalTitle = modal === 'create' ? 'New activity.' : modal === 'goal' ? 'Set your target.' : modal === 'friend' ? 'Add a friend.' : modal === 'profile' ? 'Your profile.' : modal === 'reset' ? 'Start fresh?' : modal === 'remove' ? 'Remove friend?' : 'Log an effort.';
  return <div className="app">
    {loading && <div className="loading-line" />}
    <header className="header"><a href="#" className="logo" aria-label="peakh home">peakh<span className="logo-mark" /></a>
      <div className="header-right"><button className="theme-button" aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`} onClick={toggleTheme}>{theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}</button>
      {auth && <DropdownMenu><DropdownMenuTrigger asChild><button className="menu-trigger" aria-label="Open navigation"><Menu size={21} />{social?.requests.some(r => r.incoming) && <span className="request-dot" aria-label="Pending friend requests" />}</button></DropdownMenuTrigger><DropdownMenuContent className="peakh-menu" align="end" sideOffset={14}>
        <DropdownMenuItem className={!isFriends ? 'current' : ''} onSelect={() => navigate('')}><Grid2X2 />My records</DropdownMenuItem>
        <DropdownMenuItem className={isFriends ? 'current' : ''} onSelect={() => navigate('friends')}><Users />Friends{social?.requests.some(r => r.incoming) && <span className="request-dot" />}</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => open('profile')}><UserRound />Profile</DropdownMenuItem>
      </DropdownMenuContent></DropdownMenu>}
      </div>
    </header>
    <main className="main">
      {loadError && <div role="alert" className="status-message error-message">{loadError}<button onClick={() => loadRecords(true)}>Retry</button></div>}
      {loading ? <div className="empty">Loading your records…</div> : !auth ? <section className="signin-panel"><p className="mono muted">Your performance, on record.</p><h1 className="num">Make your<br />mark<span className="orange">.</span></h1><p>Track your best. See your friends’ progress.</p><a className="action-button" href={signin}>Sign in with ChatGPT <ArrowRight /></a></section> : <>
        {!isFriends && !active && <><section className="intro records-intro"><h1>Personal records<span className="orange">.</span></h1><button className="layout-toggle" aria-label={arrangement === 'grid' ? 'Switch to rows' : 'Switch to grid'} title={arrangement === 'grid' ? 'Switch to rows' : 'Switch to grid'} onClick={toggleArrangement}>{arrangement === 'grid' ? <Rows3 size={19} /> : <Grid2X2 size={19} />}</button></section>
          <div className={`record-grid simple-grid ${arrangement === 'rows' ? 'record-rows' : ''}`}>{activities.map(a => <article key={a.id} className="record-card simple-card">
            <button className="record-main" onClick={() => navigate('activity/' + a.id)} aria-label={`${a.name}: ${a.entries.length ? fmt(best(a), a.unit) + ' ' + a.unit : 'No record yet'}`}><div className="card-top"><h3>{a.name}</h3><ArrowUpRight /></div><div className="card-value"><span className="num">{a.entries.length ? fmt(best(a), a.unit) : '—'}</span><span className="unit mono">{a.unit}</span></div></button>
            <button className="card-goal" onClick={() => open('goal', a.id)} aria-label={`${a.goal ? 'Edit' : 'Set'} ${a.name} goal`}>
              <span className="goal-caption mono"><span>{a.goal ? `Goal ${fmt(a.goal, a.unit)} ${a.unit}` : '+ Set a goal'}</span><span>{a.goal && a.entries.length ? goalProgress(a) === 100 ? 'Achieved' : `${Math.floor(goalProgress(a))}%` : '—'}</span></span>
              <span className="goal-bar" role="progressbar" aria-label={`${a.name} goal progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.floor(goalProgress(a))}><span style={{ width: goalProgress(a) + '%' }} /></span>
            </button>
          </article>)}</div>
        </>}
        {active && <><button className="back-button" onClick={() => navigate('')}><ArrowLeft />All records</button><div className="detail-heading"><div><h1>{active.name}</h1><p className="mono muted">{active.category}</p></div><button className="action-button" onClick={() => open('log', active.id)}><Plus />Log effort</button></div><ActivityDetail activity={active} editable onGoal={() => open('goal', active.id)} /></>}
        {route === 'friends' && <>
          <section className="intro"><div><p className="eyebrow mono muted">Shared effort.</p><h1>Friends<span className="orange">.</span></h1></div><button className="action-button" onClick={() => open('friend')}><Plus />Add friend</button></section>
          <div className="social-toolbar"><div className="dialog-tabs">{['leaderboard', 'people', 'requests'].map(v => <button className={friendsView === v ? 'active' : ''} onClick={() => { setFriendsView(v); setError(''); void refreshSocial(); }} key={v}>{v === 'leaderboard' ? 'Leaderboard' : v === 'people' ? 'Friends' : `Requests${social?.requests.length ? ' (' + social.requests.length + ')' : ''}`}</button>)}</div><span className="mono muted sync-label">{socialError ? 'Sync paused' : synced ? 'Updated ' + synced + ' · every 10s' : 'Connecting…'}</span></div>
          {socialError && <div className="status-message error-message" role="alert">{socialError}<button onClick={() => refreshSocial()}>Retry</button></div>}
          {error && !modal && <p className="error-message" role="alert">{error}</p>}
          {!social ? <div className="empty">Loading friends…</div> : friendsView === 'leaderboard' ? <>
            <div className="friend-tabs" aria-label="Leaderboard activity">{activities.map(a => <button key={a.id} className={boardActivity?.id === a.id ? 'active' : ''} onClick={() => setBoard(a.id)}>{a.name}</button>)}</div>
            {boardActivity && <section><div className="section-bar"><h2 className="section-title mono">{boardActivity.name}</h2><span className="mono muted">{boardActivity.category}</span></div>
              {rankings.map(r => <div className="leader-row" key={r.id}><span className={`leader-rank num ${r.rank === 1 ? 'orange' : ''}`}>{String(r.rank).padStart(2, '0')}</span><button className="leader-name profile-link" onClick={() => navigate(r.id === social.self.id ? 'activity/' + boardActivity.id : 'friend/' + r.id)}><Avatar name={r.name} src={r.photoUrl} /><span>{r.name}{r.id === social.self.id && <small>YOU</small>}</span><ArrowUpRight size={14} /></button><span className="leader-value num">{fmt(r.value, boardActivity.unit)}<small>{boardActivity.unit}</small></span></div>)}
              {!rankings.length && <div className="empty">No personal records for this activity yet.</div>}
            </section>}<p className="friend-note">Rankings use real logged records for the same activity and measurement. {social.friends.length === 0 && 'Add a friend to compare your progress.'}</p>
          </> : friendsView === 'people' ? <div className="people-list">{social.friends.length ? social.friends.map(f => <button className="person-row" key={f.id} onClick={() => navigate('friend/' + f.id)}><span className="person-identity"><Avatar name={f.name} src={f.photoUrl} />{f.name}</span><span className="mono muted">View profile <ArrowUpRight size={16} /></span></button>) : <div className="empty">No friends yet. Share your code to get started.</div>}</div> :
            <section className="request-list"><p className="friend-note">Accepting a request shares your records, charts and activity history with each other.</p>{social.requests.length ? social.requests.map(r => <div className="request-row" key={r.id}><div><strong>{r.person.name}</strong><p className="mono muted">{r.incoming ? 'Wants to connect' : 'Request sent'}</p></div><div className="request-actions">{r.incoming && <button className="action-button" disabled={saving} onClick={() => changeSocial({ action: 'accept', id: r.id }, 'PATCH', 'Friend added.')}>Accept</button>}<button className="secondary-button" disabled={saving} onClick={() => changeSocial({ action: 'dismiss', id: r.id }, 'PATCH', r.incoming ? 'Request declined.' : 'Request cancelled.')}>{r.incoming ? 'Decline' : 'Cancel'}</button></div></div>) : <div className="empty">No pending requests.</div>}</section>}
        </>}
        {friendId && <><button className="back-button" onClick={() => navigate('friends')}><ArrowLeft />Friends</button>{profileError && <p className="error-message" role="alert">{profileError}</p>}{!friend ? !profileError && <div className="empty">Loading profile…</div> : <>
          <section className="detail-heading"><div className="friend-identity"><Avatar name={friend.name} src={friend.photoUrl} large /><div><p className="mono muted">Friend profile</p><h1>{friend.name}</h1></div></div><button className="secondary-button" onClick={() => open('remove')}>Remove friend</button></section>
          <div className="friend-tabs" aria-label="Friend activity">{friend.activities.map(a => <button key={a.id} className={profileActivity?.id === a.id ? 'active' : ''} onClick={() => setFriendActivity(a.id)}>{a.name}</button>)}</div>
          {profileActivity ? <><div className="section-bar"><h2>{profileActivity.name}</h2><span className="mono muted">{profileActivity.category}</span></div><ActivityDetail key={profileActivity.id} activity={profileActivity} /></> : <div className="empty">No activities yet.</div>}
        </>}</>}
        <footer className="footer"><span className="mono">peakh / Built on effort.</span>{data.sample && <button className="mono" onClick={() => open('reset')}>Remove sample records ↗</button>}</footer>
      </>}
    </main>
    {auth && <button className="fab" aria-label="Log a new effort" onClick={() => open('log')} disabled={loading || !!loadError}><Plus /></button>}
    {toast && <div className="toast" role="status">{toast}</div>}
    <Dialog open={!!modal && auth} onOpenChange={v => { if (!v && !saving && !photoBusy) { setModal(null); setError(''); } }}><DialogContent className="peakh-dialog" showCloseButton={!saving && !photoBusy}>
      <p className="mono orange">peakh</p><DialogTitle>{modalTitle}</DialogTitle><DialogDescription>{modal === 'friend' ? 'Send a request using their friend code. Once accepted, you can see each other’s records and history.' : modal === 'profile' ? 'Your name appears to friends. Share your code to connect.' : modal === 'remove' ? 'You will no longer share records or appear on each other’s leaderboards.' : modal === 'reset' ? 'Remove example logs. Your own entries and activities stay.' : modal === 'goal' ? 'Give your progress a direction.' : modal === 'create' ? 'Choose how you measure this activity.' : 'One effort. One step forward.'}</DialogDescription>
      {modal === 'profile' && <ProfilePhoto name={social?.self.name || 'Me'} src={social?.self.photoUrl} disabled={saving} onBusy={setPhotoBusy} onSaved={url => { socialSequence.current++; setSocial(s => s ? { ...s, self: { ...s.self, photoUrl: url } } : s); setToast(url ? 'Profile photo updated.' : 'Profile photo removed.'); void refreshSocial(); }} />}
      {(modal === 'friend' || modal === 'profile') && <div className="invite-code"><span className="mono muted">Your friend code</span><code>{social?.self.code || 'Loading…'}</code><button className="secondary-button" type="button" disabled={!social} onClick={copyInvite}>Copy invite link</button></div>}
      {modal === 'reset' ? <button className="action-button" disabled={saving} onClick={() => commit({ ...data, sample: false, friends: [], activities: activities.map(a => ({ ...a, entries: a.entries.filter(e => !e.id.startsWith('sample-')) })) }, 'Sample records removed.')}>{saving ? 'Saving…' : 'Remove samples'}</button> :
       modal === 'remove' ? <button className="action-button" disabled={saving} onClick={async () => { if (!friend) return; await changeSocial({ action: 'remove', id: friend.id }, 'PATCH', 'Friend removed.', true); void refreshSocial(); }}>{saving ? 'Removing…' : 'Remove friend'}</button> :
       <form onSubmit={submit}>
        {(modal === 'log' || modal === 'create') && <div className="dialog-tabs"><button type="button" className={modal === 'log' ? 'active' : ''} onClick={() => { setModal('log'); setError(''); }}>Log effort</button><button type="button" className={modal === 'create' ? 'active' : ''} onClick={() => { setModal('create'); setError(''); }}>New activity</button></div>}
        {modal === 'friend' ? <label className="field">Friend’s code<input value={code} onChange={e => setCode(e.target.value)} maxLength={24} placeholder="16-character code" autoComplete="off" required /></label> :
         modal === 'profile' ? <label className="field">Display name<input value={name} onChange={e => setName(e.target.value)} maxLength={50} required /></label> :
         modal === 'create' ? <><label className="field">Activity name<input value={name} onChange={e => setName(e.target.value)} maxLength={45} placeholder="e.g. Deadlift" required /></label><label className="field">Measurement<select value={unit} onChange={e => { setUnit(e.target.value); setLower(e.target.value === 'min:sec'); }}>{['reps', 'kg', 'lb', 'min:sec', 'sec', 'km', 'm'].map(u => <option key={u}>{u}</option>)}</select></label><label className="field">A better record means<select value={lower ? 'lower' : 'higher'} onChange={e => setLower(e.target.value === 'lower')}><option value="higher">A higher number</option><option value="lower">A lower number</option></select></label></> :
         <>{modal === 'log' && <label className="field">Activity<select value={activityId} onChange={e => { if (e.target.value === '__new') { setModal('create'); return; } setActivityId(e.target.value); setValue(''); }}>{activities.map(a => <option value={a.id} key={a.id}>{a.name} · {a.unit}</option>)}<option value="__new">+ Create an activity</option></select></label>}
          <label className="field">{modal === 'goal' ? 'Goal' : 'Your effort'} · {logActivity?.unit}<input inputMode={logActivity?.unit === 'min:sec' ? 'text' : 'decimal'} value={value} onChange={e => setValue(e.target.value)} placeholder={logActivity?.unit === 'min:sec' ? '22:30' : '0'} maxLength={15} required />{logActivity?.unit === 'min:sec' && <small>Minutes:seconds, for example 22:30</small>}</label>
          {modal === 'log' && <label className="field">Date<input type="date" value={date} max={today()} onChange={e => setDate(e.target.value)} required /></label>}</>}
        {error && <p role="alert" className="error-message">{error}</p>}
        <button className="action-button submit-button" disabled={saving || photoBusy || loading || !!loadError}>{saving ? 'Saving…' : modal === 'friend' ? 'Send request' : modal === 'profile' ? 'Save profile' : modal === 'create' ? 'Create activity' : modal === 'goal' ? 'Set goal' : 'Log effort'}<ArrowRight /></button>
        {modal === 'profile' && <a className="signout-link mono muted" href="/signout-with-chatgpt?return_to=%2F">Sign out</a>}
      </form>}
      {error && (modal === 'reset' || modal === 'remove') && <p className="error-message" role="alert">{error}</p>}
    </DialogContent></Dialog>
  </div>;
}


