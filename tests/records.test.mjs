import { test } from 'node:test';
import assert from 'node:assert/strict';
import { best, goalProgress, parseValue, formatValue, byDate, makeSeed, deleteRecord } from '../app/records.ts';
test('deleting a record preserves other activities and recalculates the personal best', () => {
 const state = makeSeed();
 const original = structuredClone(state);
 for (const id of ['run', 'bench']) {
  const activity = state.activities.find(a => a.id === id);
  const entry = activity.entries.find(e => e.value === best(activity));
  const next = deleteRecord(state, id, entry.id);
  const updated = next.activities.find(a => a.id === id);
  assert.equal(updated.entries.length, activity.entries.length - 1);
  assert.ok(!updated.entries.some(e => e.id === entry.id));
  assert.notEqual(best(updated), best(activity));
  for (const other of state.activities.filter(a => a.id !== id)) assert.equal(next.activities.find(a => a.id === other.id), other);
 }
 assert.deepEqual(state, original);
});
test('deleting the last log leaves the activity and goal intact', () => {
 const state = makeSeed(); const a = state.activities[0]; a.entries = [a.entries[0]];
 const next = deleteRecord(state, a.id, a.entries[0].id);
 assert.equal(next.activities[0].entries.length, 0);
 assert.equal(next.activities[0].goal, a.goal);
 assert.equal(best(next.activities[0]), 0);
 assert.deepEqual(deleteRecord(state, a.id, 'missing'), state);
});
test('running and swimming records favor lower times',()=>{const a=makeSeed().activities[0];assert.equal(best({...a,entries:[{value:1300},{value:1400},{value:1250}]}),1250)});
test('strength records favor higher values and handle empty history',()=>{const a=makeSeed().activities[1];assert.equal(best({...a,entries:[{value:85},{value:80},{value:90}]}),90);assert.equal(best({...a,entries:[]}),0)});
test('time input is strict and round trips',()=>{assert.equal(parseValue('22:24','min:sec'),1344);assert.equal(formatValue(1344,'min:sec'),'22:24');for(const v of ['22:65','22.5','abc','-1:20'])assert.ok(Number.isNaN(parseValue(v,'min:sec')));assert.equal(parseValue('87.5','kg'),87.5)});
test('backdated and same-day entries retain chronological logging order',()=>{const a=[{id:'z',date:'2026-01-02'},{id:'a',date:'2026-01-02'},{id:'b',date:'2026-01-01'}];assert.deepEqual(a.sort(byDate).map(x=>x.id),['b','z','a'])});
test('goals handle time, strength, empty records and exceeded targets',()=>{
 const [run,bench]=makeSeed().activities;
 assert.equal(goalProgress({...bench,goal:100,entries:[{value:85}]}),85);
 assert.equal(goalProgress({...run,goal:1200,entries:[{value:1500}]}),80);
 assert.equal(goalProgress({...run,goal:1200,entries:[{value:1100}]}),100);
 assert.equal(goalProgress({...bench,goal:80,entries:[{value:100}]}),100);
 assert.equal(goalProgress({...bench,entries:[]}),0);
 assert.equal(goalProgress({...bench,goal:0}),0);
});
