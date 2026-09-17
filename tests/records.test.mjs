import { test } from 'node:test';
import assert from 'node:assert/strict';
import { best, parseValue, formatValue, byDate, makeSeed } from '../app/records.ts';
test('running and swimming records favor lower times',()=>{const a=makeSeed().activities[0];assert.equal(best({...a,entries:[{value:1300},{value:1400},{value:1250}]}),1250)});
test('strength records favor higher values and handle empty history',()=>{const a=makeSeed().activities[1];assert.equal(best({...a,entries:[{value:85},{value:80},{value:90}]}),90);assert.equal(best({...a,entries:[]}),0)});
test('time input is strict and round trips',()=>{assert.equal(parseValue('22:24','min:sec'),1344);assert.equal(formatValue(1344,'min:sec'),'22:24');for(const v of ['22:65','22.5','abc','-1:20'])assert.ok(Number.isNaN(parseValue(v,'min:sec')));assert.equal(parseValue('87.5','kg'),87.5)});
test('backdated and same-day entries retain chronological logging order',()=>{const a=[{id:'z',date:'2026-01-02'},{id:'a',date:'2026-01-02'},{id:'b',date:'2026-01-01'}];assert.deepEqual(a.sort(byDate).map(x=>x.id),['b','z','a'])});
