import { z } from 'zod';
import { DefaultPolicy, Harness, InMemoryRunStore, ScriptedModel, type Tool } from './core.js';

const getOrder: Tool = {
  name: 'order.get', mode: 'read', requiredScope: 'order:read',
  schema: z.object({ orderId: z.string().min(1) }).strict(),
  async execute(input) {
    const { orderId } = input as { orderId: string };
    return { orderId, status: 'paid', amount: 380 };
  },
};

const model = new ScriptedModel([
  { kind: 'tool', name: 'order.get', arguments: { orderId: '123' } },
  { kind: 'final', text: '订单 #123 已支付，金额为 380。' },
]);
const harness = new Harness(model, [getOrder], new DefaultPolicy(), new InMemoryRunStore());
const run = await harness.run('查询订单 #123', {
  userId: 'u1', tenantId: 't1', scopes: ['order:read'],
});
console.log(JSON.stringify({ status: run.status, answer: run.result, events: run.events }, null, 2));
