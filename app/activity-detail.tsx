'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { ResponsiveContainer, AreaChart, Area, ReferenceLine, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { type Activity, best, formatValue as fmt, shortDate, dayAgo, byDate } from './records';
function Heatmap({ activity }: { activity: Activity }) {
  const today = dayAgo(0);
  const weekday = (new Date(today + 'T12:00:00').getDay() + 6) % 7;
  const days = Array.from({ length: 182 }, (_, i) => dayAgo(175 + weekday - i));
  const counts = new Map<string, number>();
  activity.entries.forEach(e => counts.set(e.date, (counts.get(e.date) || 0) + 1));
  const latest = [...counts.keys()].filter(d => d >= days[0] && d <= today).sort().at(-1);
  const [picked, setPicked] = useState<string | null>(null);
  const selected = picked && days.includes(picked) ? picked : latest || today;
  const logs = activity.entries.filter(e => e.date === selected);
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const wrap = scroller.current;
    const cell = wrap?.querySelector<HTMLElement>('[data-selected="true"]');
    if (wrap && cell) wrap.scrollLeft = cell.offsetLeft - wrap.clientWidth / 2 + cell.clientWidth / 2;
  }, [activity.id, latest]);
  const label = (date: string) => new Date(date + 'T12:00:00').toLocaleDateString('en', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  return <section className="heat-section consistency-calendar">
    <div className="section-bar"><h2 className="section-title mono">Consistency</h2><span className="mono muted">Last 26 weeks</span></div>
    <div className="calendar-layout"><div className="calendar-weekdays" aria-hidden="true">{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i}>{d}</span>)}</div>
      <div className="heat-wrap" ref={scroller}><div className="calendar-months mono muted" aria-hidden="true">{Array.from({ length: 26 }, (_, week) => {
        const date = days[week * 7];
        return <span key={date}>{week === 0 || date.slice(0, 7) !== days[(week - 1) * 7].slice(0, 7) ? new Date(date + 'T12:00:00').toLocaleDateString('en', { month: 'short' }) : ''}</span>;
      })}</div><div className="heat-grid" role="group" aria-label="Logged activity calendar">{days.map(d => <button type="button" key={d} disabled={d > today} data-selected={d === selected} aria-pressed={d === selected} aria-label={`${label(d)}: ${counts.get(d) || 0} logs`} title={`${label(d)}: ${counts.get(d) || 0} logs`} className={`heat-cell ${counts.get(d) ? 'logged' : ''} ${d === today ? 'today' : ''}`} onClick={() => setPicked(d)} />)}</div></div>
    </div>
    <div className="heat-footer"><span>{days.filter(d => d <= today && counts.has(d)).length} active days</span><span className="calendar-key"><i /> Logged day</span></div>
    <div className="calendar-selection" aria-live="polite"><strong>{label(selected)}</strong><span>{logs.length ? `${logs.length} ${logs.length === 1 ? 'effort' : 'efforts'} logged · ${logs.map(e => `${fmt(e.value, activity.unit)} ${activity.unit}`).join(', ')}` : 'No efforts logged on this day.'}</span></div>
    <p className="calendar-hint">Tap a day to see its records. Scroll for earlier weeks.</p>
  </section>;
}
export default function ActivityDetail({ activity: a, editable = false, onGoal, onDelete }: { activity: Activity; editable?: boolean; onGoal?: () => void; onDelete?: (entryId: string) => void }) {
  const [range, setRange] = useState('All');
  const fillId = useId().replace(/:/g, '');
  const entries = [...a.entries].sort(byDate);
  const plotted = entries.filter(e => range === 'All' || e.date >= dayAgo(range === '30D' ? 30 : 90)).map((e, i) => ({ ...e, index: i }));
  const pr = best(a);
  return <>
    <div className="detail-stats">
      <div className="detail-stat"><div className="detail-stat-label mono muted">Personal record</div><div className="detail-value"><span className="num orange">{a.entries.length ? fmt(pr, a.unit) : '—'}</span><span className="unit mono">{a.unit}</span></div></div>
      <div className="detail-stat"><div className="detail-stat-label mono muted">End goal {editable && <button onClick={onGoal}>Edit</button>}</div><div className="detail-value"><span className="num outlined">{a.goal ? fmt(a.goal, a.unit) : '—'}</span><span className="unit mono">{a.unit}</span></div></div>
    </div>
    <div className="detail-body"><div><section className="chart-panel">
      <div className="section-bar progress-heading"><h2 className="section-title mono">Progress over time</h2><div className="filters">{['30D', '90D', 'All'].map(r => <button key={r} aria-pressed={range === r} className={range === r ? 'active' : ''} onClick={() => setRange(r)}>{r}</button>)}</div></div>
      {plotted.length ? <div className="chart progress-chart" role="img" aria-label={`${a.name} progress: ${plotted.length} efforts. Better results appear higher.`}><ResponsiveContainer width="100%" height="100%"><AreaChart data={plotted} margin={{ top: 12, right: 24, left: 0, bottom: 12 }}>
        <defs><linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--orange)" stopOpacity={0.24}/><stop offset="100%" stopColor="var(--orange)" stopOpacity={0.01}/></linearGradient></defs>
        <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 5" strokeOpacity={1} />
        <XAxis dataKey="index" tickFormatter={i => plotted[i] ? shortDate(plotted[i].date) : ''} axisLine={{ stroke: 'var(--muted)' }} tickLine={{ stroke: 'var(--muted)' }} minTickGap={35} tickMargin={10} padding={{ left: 10, right: 10 }} />
        <YAxis reversed={a.lower} domain={['auto', 'auto']} tickFormatter={v => fmt(v, a.unit)} axisLine={{ stroke: 'var(--muted)' }} tickLine={{ stroke: 'var(--muted)' }} width={58} tickMargin={8} tickCount={4} padding={{ top: 10, bottom: 10 }} />
        {plotted.some(e => e.value === pr) && <ReferenceLine y={pr} stroke="var(--orange)" strokeOpacity={0.35} strokeDasharray="4 6" />}
        <Tooltip cursor={{ stroke: 'var(--orange)', strokeOpacity: 0.4, strokeDasharray: '3 5' }} content={({ active, payload }) => active && payload?.length ? <div className="chart-tooltip progress-tooltip"><p className="mono muted">{shortDate(payload[0].payload.date)}</p><strong>{fmt(Number(payload[0].value), a.unit)} <small>{a.unit}</small></strong>{Number(payload[0].value) === pr && <span className="tooltip-best">Personal best</span>}</div> : null} />
        <Area type="linear" dataKey="value" baseValue={a.lower ? 'dataMax' : 'dataMin'} stroke="var(--orange)" strokeWidth={3} fill={`url(#${fillId})`} isAnimationActive={false} activeDot={{ r: 6, fill: 'var(--orange)', stroke: 'var(--glass-solid)', strokeWidth: 3 }}
          dot={({ cx, cy, payload }) => <g key={payload.id}>{payload.value === pr && <circle cx={cx} cy={cy} r={10} fill="var(--orange)" opacity={0.12}/>}<circle cx={cx} cy={cy} r={payload.value === pr ? 4.5 : plotted.length < 20 ? 3 : 0} fill={payload.value === pr ? 'var(--orange)' : 'var(--glass-solid)'} stroke="var(--orange)" strokeWidth={2}/></g>} />
      </AreaChart></ResponsiveContainer></div> : <div className="empty">{entries.length ? 'No efforts in this date range.' : 'No efforts logged yet.'}</div>}
    </section><Heatmap key={a.id} activity={a} /></div>
    <section className="history"><div className="section-bar"><h2 className="section-title mono">Activity history</h2><span className="count-label mono">{entries.length}</span></div>
      <div className="history-list">{entries.map((e, i) => ({ e, change: i ? e.value - entries[i - 1].value : null })).reverse().map(({ e, change }) => <div className="history-row" key={e.id}>
        <div><div className="date mono">{shortDate(e.date)} {e.date.slice(0, 4)}</div>{e.value === pr && <p className="mono muted" style={{ fontSize: 9 }}>Personal best</p>}</div>
        <div><div className="history-value">{fmt(e.value, a.unit)} <small>{a.unit}</small></div><div className={`history-delta mono ${change !== null && (a.lower ? change < 0 : change > 0) ? 'orange' : 'muted'}`}>{change === null ? 'First entry' : `${change > 0 ? '+' : change < 0 ? '−' : ''}${fmt(Math.abs(change), a.unit)}`}</div>{editable && onDelete && <button className="delete-record mono" aria-label={`Delete ${a.name} record ${fmt(e.value, a.unit)} ${a.unit} on ${e.date}`} onClick={() => onDelete(e.id)}>Delete</button>}</div>
      </div>)}</div>{!entries.length && <p className="friend-note">The first effort starts the story.</p>}
    </section></div>
  </>;
}
