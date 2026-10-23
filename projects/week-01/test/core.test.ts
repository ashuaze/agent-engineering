import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { DefaultPolicy, Harness, InMemoryRunStore, ScriptedModel, type Tool, type Decision } from '../src/core.js';

let executions = 0;
const readTool: Tool = {
  name: 'order.get', mode: 'read', requiredScope: 'order:read',
  schema: z.object({ orderId: z.string() }).strict(),
  async execute(input) { executions++; return input; },
};
const writeTool: Tool = {
  ...readTool, name: 'order.refund', mode: 'write', requiredScope: 'order:refund',
};
const principal = { userId: 'u1', tenantId: 't1', scopes: ['order:read', 'order:refund'] };
function build(script: Decision[], tools: Tool[] = [readTool, writeTool], limits = { maxModelTurns: 6, maxToolCalls: 4, maxDurationMs: 5_000 }) {
  return new Harness(new ScriptedModel(script), tools, new DefaultPolicy(), new InMemoryRunStore(), limits);
}

test('read tool executes and produces final answer', async () => {
  executions = 0;
  const run = await build([
    { kind: 'tool', name: 'order.get', arguments: { orderId: '123' } },
    { kind: 'final', text: 'done' },
  ]).run('check order', principal);
  assert.equal(run.status, 'completed');
  assert.equal(run.result, 'done');
  assert.equal(executions, 1);
});

test('write action is denied even with matching scope', async () => {
  executions = 0;
  const run = await build([
    { kind: 'tool', name: 'order.refund', arguments: { orderId: '123' } },
    { kind: 'final', text: 'not executed' },
  ]).run('refund order', principal);
  assert.equal(run.status, 'completed');
  assert.equal(executions, 0);
  assert.ok(run.events.some(e => e.type === 'tool.denied'));
});

test('schema rejects invalid tool arguments', async () => {
  executions = 0;
  const run = await build([
    { kind: 'tool', name: 'order.get', arguments: { unexpected: true } },
    { kind: 'final', text: 'invalid' },
  ]).run('check order', principal);
  assert.equal(executions, 0);
  assert.ok(run.events.some(e => e.type === 'tool.invalid'));
});

test('run terminates when model turn budget is exhausted', async () => {
  const run = await build([
    { kind: 'tool', name: 'order.get', arguments: { orderId: '1' } },
  ], [readTool], { maxModelTurns: 1, maxToolCalls: 5, maxDurationMs: 5_000 }).run('check', principal);
  assert.equal(run.status, 'failed');
  assert.equal(run.error, 'MODEL_TURN_BUDGET_EXCEEDED');
});
