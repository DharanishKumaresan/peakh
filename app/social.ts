import { best, type Activity, type RecordState } from './records';
export type PublicRecord = { key: string; value: number; activity?: Pick<Activity, 'name' | 'category' | 'unit' | 'lower'> };
export type Person = { id: string; name: string; photoUrl?: string | null; records: PublicRecord[] };
export type Connection = { id: string; person: { id: string; name: string; photoUrl?: string | null }; incoming: boolean };
export type SocialState = { self: { id: string; name: string; code: string; photoUrl?: string | null }; friends: Person[]; requests: Connection[] };
export type FriendProfile = { id: string; name: string; photoUrl?: string | null; activities: Activity[] };
// Compare the same event, units and scoring direction, including custom activities.
export function activityKey(a: Activity) {
  return JSON.stringify([a.name, a.category, a.unit].map(s => s.trim().toLowerCase().replace(/\s+/g, ' ')).concat(String(a.lower)));
}
export function sharedActivities(state: RecordState): Activity[] {
  return state.activities.map(a => ({ ...a, entries: a.entries.filter(e => !e.id.startsWith('sample-')) }));
}
export function publicRecords(state: RecordState): PublicRecord[] {
  const records = new Map<string, number>();
  for (const a of sharedActivities(state)) {
    if (!a.entries.length) continue;
    const key = activityKey(a), value = best(a), previous = records.get(key);
    records.set(key, previous === undefined ? value : (a.lower ? Math.min(previous, value) : Math.max(previous, value)));
  }
  return [...records].map(([key, value]) => {
    const a = state.activities.find(a => activityKey(a) === key)!;
    return { key, value, activity: { name: a.name, category: a.category, unit: a.unit, lower: a.lower } };
  });
}
// Union of real logged categories, not the default or unlogged activity list.
export function leaderboardActivities(state: RecordState, friends: Person[]): Activity[] {
  const categories = new Map<string, Activity>();
  const own = sharedActivities(state);
  for (const a of own) if (a.entries.length) categories.set(activityKey(a), a);
  for (const friend of friends) for (const record of friend.records) {
    if (categories.has(record.key)) continue;
    const local = own.find(a => activityKey(a) === record.key);
    if (local) { categories.set(record.key, local); continue; }
    if (record.activity) categories.set(record.key, { ...record.activity, id: record.key, goal: 0, entries: [] });
  }
  return [...categories.values()];
}
export function leaderboard(activity: Activity, self: Person, friends: Person[]) {
  const key = activityKey(activity);
  const rows = [self, ...friends].flatMap(p => {
    const record = p.records.find(r => r.key === key);
    return record ? [{ id: p.id, name: p.name, photoUrl: p.photoUrl, value: record.value, rank: 0 }] : [];
  }).sort((a, b) => (activity.lower ? a.value - b.value : b.value - a.value) || a.name.localeCompare(b.name));
  rows.forEach((r, i) => { r.rank = i && rows[i - 1].value === r.value ? rows[i - 1].rank : i + 1; });
  return rows;
}
