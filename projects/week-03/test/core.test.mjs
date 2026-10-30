import test from 'node:test';
import assert from 'node:assert/strict';
import { ConflictError, FakeModel, Kernel, MemoryStore } from '../dist/core.js';
const mk = async () => { const s = new MemoryStore(); const r = await s.create({tenantId:'tenant-A',agentVersion:'v1',prompt:'hello'}); return {s,r}; };
test('create produces CREATED and immutable RunCreated event', async () => {
  const {s,r}=await mk(); assert.equal(r.status,'CREATED');
  const ev=await s.events(r.id); assert.deepEqual(ev.map(x=>x.seq),[1]);
  ev[0].type='tampered'; assert.equal((await s.events(r.id))[0].type,'RunCreated');
});
test('happy path: MODEL -> TOOL -> MODEL with ordered events', async () => {
  const {s,r}=await mk();
  const m=new FakeModel([{kind:'tool',callId:'c1',name:'order.get',args:{orderId:'1'}},{kind:'final',text:'done'}]);
  const tools=new Map([['order.get',{name:'order.get',execute:async()=>({paid:true})}]]);
  const done=await new Kernel(s,m,tools).drain(r.id);
  assert.equal(done.status,'COMPLETED'); assert.equal(done.output,'done');
  assert.deepEqual((await s.steps(r.id)).map(x=>x.kind),['MODEL','TOOL','MODEL']);
  assert.deepEqual((await s.steps(r.id)).map(x=>x.status),['SUCCEEDED','SUCCEEDED','SUCCEEDED']);
  const events=await s.events(r.id); assert.deepEqual(events.map(x=>x.seq),events.map((_,i)=>i+1));
});
test('invalid transition CREATED -> COMPLETED is rejected', async () => {
  const {s,r}=await mk(); await assert.rejects(s.transition(r.id,0,'COMPLETED'),/INVALID_TRANSITION/);
});
test('optimistic CAS rejects stale run version', async () => {
  const {s,r}=await mk(); await s.transition(r.id,0,'RUNNING');
  await assert.rejects(s.transition(r.id,0,'WAITING'),ConflictError);
});
test('only one active step per run', async () => {
  const {s,r}=await mk(); await s.transition(r.id,0,'RUNNING');
  await s.beginStep(r.id,'MODEL',{});
  await assert.rejects(s.beginStep(r.id,'MODEL',{}),ConflictError);
});
test('finished step cannot finish twice', async () => {
  const {s,r}=await mk(); await s.transition(r.id,0,'RUNNING');
  const st=await s.beginStep(r.id,'MODEL',{}); await s.finishStep(r.id,st.id,{ok:true,output:{}});
  await assert.rejects(s.finishStep(r.id,st.id,{ok:true,output:{}}),ConflictError);
});
test('terminal state is immutable', async () => {
  const {s,r}=await mk(); const running=await s.transition(r.id,0,'RUNNING');
  const done=await s.transition(r.id,running.version,'COMPLETED');
  await assert.rejects(s.transition(r.id,done.version,'RUNNING'),/INVALID_TRANSITION/);
});
test('tool failure records failed step and failed run', async () => {
  const {s,r}=await mk(); const m=new FakeModel([{kind:'tool',callId:'c',name:'missing',args:{}}]);
  const failed=await new Kernel(s,m,new Map()).drain(r.id);
  assert.equal(failed.status,'FAILED'); assert.match(failed.error,/UNKNOWN_TOOL/);
  assert.deepEqual((await s.steps(r.id)).map(x=>x.status),['SUCCEEDED','FAILED']);
});
test('model failure records failed step and failed run', async () => {
  const {s,r}=await mk(); const failed=await new Kernel(s,new FakeModel([]),new Map()).drain(r.id);
  assert.equal(failed.status,'FAILED'); assert.equal((await s.steps(r.id))[0].status,'FAILED');
});
test('model turn budget bounds loop', async () => {
  const {s,r}=await mk(); const m=new FakeModel([{kind:'tool',callId:'c',name:'read',args:{}}]);
  const tools=new Map([['read',{name:'read',execute:async()=>({})}]]);
  const failed=await new Kernel(s,m,tools,1).drain(r.id);
  assert.equal(failed.status,'FAILED'); assert.match(failed.error,/BUDGET/);
});
