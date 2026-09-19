export type Entry = { id: string; date: string; value: number };
export type Activity = { id: string; name: string; category: string; unit: string; lower: boolean; goal: number; entries: Entry[] };
export type Friend = { id: string; name: string; records: Record<string, number> };
export type RecordState = { activities: Activity[]; friends: Friend[]; sample: boolean };
export const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
export const dayAgo = (days: number) => { const d = new Date(); d.setDate(d.getDate()-days); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
// Stable sort preserves logging order for multiple efforts on the same date.
export const byDate = (a: Entry,b: Entry) => a.date.localeCompare(b.date);
export function best(a: Activity) { return a.entries.length ? (a.lower ? Math.min : Math.max)(...a.entries.map(e=>e.value)) : 0; }
export function goalProgress(a: Activity) {
 const pr = best(a);
 if (!a.goal || !pr) return 0;
 return Math.max(0, Math.min(100, (a.lower ? a.goal / pr : pr / a.goal) * 100));
}
export function formatValue(n: number, unit: string) { if(unit === 'min:sec') return `${Math.floor(n/60)}:${String(Math.round(n%60)).padStart(2,'0')}`; return Number(n.toFixed(2)).toString(); }
export function parseValue(s: string, unit: string) { if(unit === 'min:sec') { if(!/^\d+:([0-5]\d)$/.test(s)) return NaN; const [m,sec]=s.split(':').map(Number);return m*60+sec; } return Number(s); }
export function shortDate(s: string) { return new Date(s+'T12:00:00').toLocaleDateString('en-GB',{day:'2-digit',month:'short'}); }
export function makeSeed(): RecordState {
 const defs: [string,string,string,string,boolean,number,number[]][] = [
 ['run','Running','5 KM · TIME','min:sec',true,1200,[1560,1532,1490,1505,1450,1438,1394,1380,1356,1344]],
 ['bench','Bench press','STRENGTH · 1 REP MAX','kg',false,100,[60,65,65,70,67.5,75,77.5,80,82.5,85]],
 ['swim','Swimming','100 M · FREESTYLE','min:sec',true,90,[132,125,128,120,118,115,112,110,107,102]],
 ['push','Pushups','BODYWEIGHT · UNBROKEN','reps',false,60,[25,28,30,28,34,36,38,40,42,45]],
 ['pull','Pullups','BODYWEIGHT · UNBROKEN','reps',false,20,[5,6,7,7,8,9,10,10,11,12]],
 ];
 return {sample:true,activities:defs.map(([id,name,category,unit,lower,goal,values],ix)=>({id,name,category,unit,lower,goal,entries:values.map((value,j)=>({id:`sample-${ix}-${j}`,date:dayAgo((9-j)*7 + [0,1,3,2,4][ix]),value}))})),friends:[{id:'alex',name:'Alex Morgan',records:{run:1290,bench:95,swim:99,push:52,pull:16}},{id:'sam',name:'Sam Chen',records:{run:1422,bench:80,swim:95,push:40,pull:10}},{id:'jordan',name:'Jordan Lee',records:{run:1388,bench:90,swim:110,push:48,pull:14}}]};
}
