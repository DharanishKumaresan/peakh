import assert from 'node:assert/strict';
const origin=process.env.TEST_ORIGIN||'http://localhost:5173';
const first=await fetch(origin+'/api/records');assert.equal(first.status,200);
const cookie=first.headers.get('set-cookie')?.split(';')[0];assert.ok(cookie);
const initial=await first.json();
const headers={'Content-Type':'application/json',cookie,origin};
const send=(state)=>fetch(origin+'/api/records',{method:'PUT',headers,body:JSON.stringify(state)});
try{
 const state=structuredClone(initial);state.activities[0].entries.push({id:'integration-check',date:'2026-01-01',value:1201});
 assert.equal((await send(state)).status,200);
 const read=await fetch(origin+'/api/records',{headers:{cookie}});assert.equal((await read.json()).activities[0].entries.at(-1).value,1201);
 const invalid=structuredClone(state);invalid.activities[0].entries[0].value=-1;assert.equal((await send(invalid)).status,400);
 const invalidDate=structuredClone(state);invalidDate.activities[0].entries[0].date='2026-02-30';assert.equal((await send(invalidDate)).status,400);
 const future=structuredClone(state);future.activities[0].entries[0].date='2999-01-01';assert.equal((await send(future)).status,400);
 const different=await fetch(origin+'/api/records');assert.ok(!(await different.json()).activities[0].entries.some(e=>e.id==='integration-check'));
 const crossOrigin=await fetch(origin+'/api/records',{method:'PUT',headers:{...headers,origin:'https://untrusted.example'},body:JSON.stringify(state)});assert.equal(crossOrigin.status,403);
 console.log('PASS: persistence, validation, date bounds, board isolation, and origin checks.');
}finally{assert.equal((await send(initial)).status,200)}
