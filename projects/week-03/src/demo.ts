import { FakeModel, Kernel, MemoryStore, type ReadTool } from './core.js';
const store = new MemoryStore();
const model = new FakeModel([
  {kind: 'tool', callId: 'call-1', name: 'order.get', args: {orderId: 'ORD-123'}},
  {kind: 'final', text: 'ORD-123 已支付，金额 380 元。'}
]);
const tool: ReadTool = {name: 'order.get', async execute(args, tenantId) {
  if (tenantId !== 'tenant-A' || args.orderId !== 'ORD-123') throw new Error('FORBIDDEN');
  return {status: 'paid', amount: 380};
}};
const run = await store.create({tenantId: 'tenant-A', agentVersion: 'support@v3', prompt: '查询 ORD-123'});
const result = await new Kernel(store, model, new Map([[tool.name, tool]])).drain(run.id);
console.log(JSON.stringify({run: result, steps: await store.steps(run.id), events: await store.events(run.id)}, null, 2));
