'use client';
import { useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { type Activity, best, formatValue as fmt, shortDate, dayAgo, byDate } from './records';
function Heatmap({activity}:{activity:Activity}){const days=Array.from({length:182},(_,i)=>dayAgo(181-i));const counts=new Map<string,number>();activity.entries.forEach(e=>counts.set(e.date,(counts.get(e.date)||0)+1));const months=[...new Set(days.map(d=>new Date(d+'T12:00:00').toLocaleDateString('en',{month:'short'})))];return <section className="heat-section"><div className="section-bar"><h2 className="section-title mono">Consistency</h2><span className="mono muted">Last 26 weeks</span></div><div className="heat-wrap"><div className="heat-months mono muted">{months.map(m=><span key={m}>{m}</span>)}</div><div className="heat-grid" role="img" aria-label={`${activity.entries.filter(e=>e.date>=days[0]).length} logs over the last 26 weeks`}>{days.map(d=><div key={d} className={`heat-cell ${counts.get(d)?counts.get(d)!>1?'strong':'on':''}`} title={`${shortDate(d)}: ${counts.get(d)||0} logs`}/>)}</div></div><div className="heat-footer mono"><span>{days.filter(d=>counts.has(d)).length} active days</span><span className="heat-legend">Less <i/><i/> More</span></div></section>}
export default function ActivityDetail({ activity: a, editable = false, onGoal }: { activity: Activity; editable?: boolean; onGoal?: () => void }) {
  const [range, setRange] = useState('All');
  const entries = [...a.entries].sort(byDate);
  const plotted = entries.filter(e => range === 'All' || e.date >= dayAgo(range === '30D' ? 30 : 90)).map((e, i) => ({ ...e, index: i }));
  const pr = best(a);
  return <>
    <div className="detail-stats">
      <div className="detail-stat"><div className="detail-stat-label mono muted">Personal record</div><div className="detail-value"><span className="num orange">{a.entries.length ? fmt(pr, a.unit) : '—'}</span><span className="unit mono">{a.unit}</span></div></div>
      <div className="detail-stat"><div className="detail-stat-label mono muted">End goal {editable && <button onClick={onGoal}>Edit</button>}</div><div className="detail-value"><span className="num outlined">{a.goal ? fmt(a.goal, a.unit) : '—'}</span><span className="unit mono">{a.unit}</span></div></div>
    </div>
    <div className="detail-body"><div><section className="chart-panel">
      <div className="section-bar"><h2 className="section-title mono">Progress over time</h2><div className="filters">{['30D', '90D', 'All'].map(r => <button key={r} className={range === r ? 'active' : ''} onClick={() => setRange(r)}>{r}</button>)}</div></div>
      {plotted.length ? <div className="chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={plotted} margin={{ top: 12, right: 18, left: -10, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 5" />
        <XAxis dataKey="index" tickFormatter={i => plotted[i] ? shortDate(plotted[i].date) : ''} axisLine={false} tickLine={false} minTickGap={35} dy={10} />
        <YAxis domain={['auto', 'auto']} tickFormatter={v => fmt(v, a.unit)} axisLine={false} tickLine={false} width={65} />
        <Tooltip content={({ active, payload }) => active && payload?.length ? <div className="chart-tooltip"><p className="mono muted">{shortDate(payload[0].payload.date)}</p><p>{fmt(Number(payload[0].value), a.unit)} {a.unit}</p></div> : null} />
        <Line type="linear" dataKey="value" stroke="var(--fg)" strokeWidth={1.7} isAnimationActive={false} activeDot={{ r: 5, fill: 'var(--orange)' }}
          dot={({ cx, cy, payload }) => <circle key={payload.id} cx={cx} cy={cy} r={payload.value === pr ? 5 : plotted.length === 1 ? 3 : 0} fill={payload.value === pr ? 'var(--orange)' : 'var(--fg)'} stroke="var(--bg)" strokeWidth={2} />} />
      </LineChart></ResponsiveContainer></div> : <div className="empty">{entries.length ? 'No efforts in this date range.' : 'No efforts logged yet.'}</div>}
      <p className="mono muted chart-caption"><span className="orange">● Personal best</span><span>{a.lower ? 'Lower is better' : 'Higher is better'}</span></p>
    </section><Heatmap activity={a} /></div>
    <section className="history"><div className="section-bar"><h2 className="section-title mono">Activity history</h2><span className="count-label mono">{entries.length}</span></div>
      <div className="history-list">{entries.map((e, i) => ({ e, change: i ? e.value - entries[i - 1].value : null })).reverse().map(({ e, change }) => <div className="history-row" key={e.id}>
        <div><div className="date mono">{shortDate(e.date)} {e.date.slice(0, 4)}</div>{e.value === pr && <p className="mono muted" style={{ fontSize: 9 }}>Personal best</p>}</div>
        <div><div className="history-value">{fmt(e.value, a.unit)} <small>{a.unit}</small></div><div className={`history-delta mono ${change !== null && (a.lower ? change < 0 : change > 0) ? 'orange' : 'muted'}`}>{change === null ? 'First entry' : `${change > 0 ? '+' : change < 0 ? '−' : ''}${fmt(Math.abs(change), a.unit)}`}</div></div>
      </div>)}</div>{!entries.length && <p className="friend-note">The first effort starts the story.</p>}
    </section></div>
  </>;
}
