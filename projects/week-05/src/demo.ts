import { hash, MemoryApprovals, MemoryLedger, ToolGateway } from './gateway.js';
const args = { invoiceId: 'inv-17', amount: 100 };
const parse = (v: unknown) => {
  if (!v || typeof v !== 'object') throw Error('bad');
  const a = v as Record<string, unknown>;
  if (typeof a.invoiceId !== 'string' || !Number.isSafeInteger(a.amount) || Number(a.amount) <= 0) throw Error('bad');
  return { invoiceId: a.invoiceId, amount: a.amount };
};
let executions = 0;
const gateway = new ToolGateway([{ name: 'billing.refund', scope: 'billing:refund', risk: 'write', parse, execute: async (v, c) => ({ refundId: `fake-${++executions}`, request: v, key: c.idempotencyKey }) }],
  new MemoryApprovals([{ id: 'approval-1', tenantId: 'acme', userId: 'alice', runId: 'run-1', callId: 'call-1', tool: 'billing.refund', argsHash: hash(args), expiresAt: Date.now() + 60000, approved: true }]), new MemoryLedger());
const request = { runId: 'run-1', callId: 'call-1', tool: 'billing.refund', args, principal: { tenantId: 'acme', userId: 'alice', scopes: ['billing:refund'] }, approvalId: 'approval-1' };
console.log('first:', await gateway.call(request));
console.log('retry:', await gateway.call(request));
console.log('downstream executions:', executions);
