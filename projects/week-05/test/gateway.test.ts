import assert from 'node:assert/strict';
import test from 'node:test';
import { hash, MemoryApprovals, MemoryLedger, ToolGateway, type Approval, type ToolRequest } from '../src/gateway.js';
const args = { amount: 7 };
const parse = (v: unknown) => { if (!v || typeof v !== 'object' || !Number.isSafeInteger((v as any).amount) || (v as any).amount <= 0) throw Error('invalid'); return { amount: (v as any).amount as number }; };
const base: ToolRequest = { runId: 'r', callId: 'c', tool: 'refund', args, principal: { tenantId: 't', userId: 'u', scopes: ['refund:write'] }, approvalId: 'a' };
function fixture(opts: { throwOnExecute?: boolean; approval?: Partial<Approval> } = {}) {
 let calls = 0;
 const approval: Approval = { id: 'a', tenantId: 't', userId: 'u', runId: 'r', callId: 'c', tool: 'refund', argsHash: hash(args), expiresAt: Date.now() + 60000, approved: true, ...opts.approval };
 const gateway = new ToolGateway([{ name: 'refund', scope: 'refund:write', risk: 'write', parse, execute: async () => { calls++; if (opts.throwOnExecute) throw Error('timeout'); return { id: 'refund-1' }; } }], new MemoryApprovals([approval]), new MemoryLedger());
 return { gateway, calls: () => calls };
}
test('approved write executes once on duplicate call', async () => { const f = fixture(); assert.equal((await f.gateway.call(base)).status, 'ok'); assert.equal((await f.gateway.call(base)).status, 'ok'); assert.equal(f.calls(), 1); });
test('scope denial', async () => { const f = fixture(); assert.equal((await f.gateway.call({ ...base, principal: { ...base.principal, scopes: [] } })).status, 'denied'); assert.equal(f.calls(), 0); });
test('invalid schema', async () => { const f = fixture(); assert.equal((await f.gateway.call({ ...base, args: { amount: -3 } })).status, 'denied'); });
test('no approval', async () => { const f = fixture(); assert.equal((await f.gateway.call({ ...base, approvalId: undefined })).status, 'approval_required'); });
test('approval bound to args', async () => { const f = fixture(); assert.equal((await f.gateway.call({ ...base, args: { amount: 8 } })).status, 'approval_required'); });
test('expired approval', async () => { const f = fixture({ approval: { expiresAt: 0 } }); assert.equal((await f.gateway.call(base)).status, 'approval_required'); });
test('cross-tenant approval rejected', async () => { const f = fixture({ approval: { tenantId: 'other' } }); assert.equal((await f.gateway.call(base)).status, 'approval_required'); });
test('same callId different input conflict after success', async () => { const f = fixture(); await f.gateway.call(base); assert.equal((await f.gateway.call({ ...base, args: { amount: 8 } })).status, 'approval_required'); });
test('downstream error is unknown, never blindly retried', async () => { const f = fixture({ throwOnExecute: true }); assert.equal((await f.gateway.call(base)).status, 'unknown'); assert.equal((await f.gateway.call(base)).status, 'unknown'); assert.equal(f.calls(), 1); });
test('unknown tool denied', async () => { const f = fixture(); assert.equal((await f.gateway.call({ ...base, tool: 'shell.exec' })).status, 'denied'); });
test('canonical hash stable across key order', () => { assert.equal(hash({ a: 1, b: 2 }), hash({ b: 2, a: 1 })); });
test('read tool rejects reused callId with different validated input', async () => {
 const gateway = new ToolGateway([{ name: 'lookup', scope: 'lookup:read', risk: 'read', parse, execute: async v => v }], new MemoryApprovals([]), new MemoryLedger());
 const req: ToolRequest = { ...base, tool: 'lookup', principal: { ...base.principal, scopes: ['lookup:read'] }, approvalId: undefined };
 assert.equal((await gateway.call(req)).status, 'ok');
 assert.equal((await gateway.call({ ...req, args: { amount: 8 } })).status, 'conflict');
});
