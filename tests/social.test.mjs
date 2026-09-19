import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { makeSeed } from '../app/records.ts';
const source = (await readFile(new URL('../app/social.ts', import.meta.url), 'utf8')).replace("'./records'", JSON.stringify(new URL('../app/records.ts', import.meta.url).href));
const js = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {activityKey,publicRecords,leaderboard} = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
test('leaderboards rank real PRs in the right direction and preserve ties',()=>{
 const [run,bench]=makeSeed().activities;
 const person=(id,value,a)=>({id,name:id,records:[{key:activityKey(a),value}]});
 assert.deepEqual(leaderboard(run,person('You',1200,run),[person('Friend',1250,run)]).map(r=>r.id),['You','Friend']);
 assert.deepEqual(leaderboard(bench,person('You',85,bench),[person('Friend',95,bench)]).map(r=>r.id),['Friend','You']);
 assert.deepEqual(leaderboard(bench,person('You',95,bench),[person('Friend',95,bench),person('Third',80,bench)]).map(r=>r.rank),[1,1,3]);
 assert.notEqual(activityKey(bench),activityKey({...bench,unit:'lb'}));
 assert.notEqual(activityKey(run),activityKey({...run,category:'10 KM · TIME'}));
 assert.equal(publicRecords(makeSeed()).length,0);
});
