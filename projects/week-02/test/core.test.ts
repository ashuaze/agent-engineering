import test from "node:test";
import assert from "node:assert/strict";
import { demoRegistry, runAgent, type ModelTurn } from "../src/core.js";
import { ScriptedModel } from "../src/fake-model.js";

const principal = { tenantId: "t1", userId: "u1", scopes: ["order:read", "customer:read", "order:refund"] };
const final: ModelTurn = { kind: "final", text: "done" };
function call(callId: string, name: string, argumentsJson: string) {
  return { callId, name, argumentsJson };
}

test("two read tools return matching call ids in stable order", async () => {
  const model = new ScriptedModel([
    { kind: "calls", calls: [call("a", "order_get", '{"orderId":"1"}'), call("b", "customer_get", '{"customerId":"2"}')] }, final
  ]);
  const result = await runAgent(model, demoRegistry(), principal, "check");
  assert.equal(result.toolCalls, 2);
  const outputs = model.seenInputs[1];
  assert.ok(Array.isArray(outputs));
  assert.deepEqual(outputs.map(o => o.callId), ["a", "b"]);
  assert.ok(outputs.every(o => JSON.parse(o.output).ok));
});

test("invalid JSON returns structured error and no execution", async () => {
  const model = new ScriptedModel([{ kind: "calls", calls: [call("a", "order_get", "{broken")] }, final]);
  await runAgent(model, demoRegistry(), principal, "check");
  const outputs = model.seenInputs[1];
  assert.ok(Array.isArray(outputs));
  assert.equal(JSON.parse(outputs[0].output).error.code, "INVALID_JSON");
});

test("invalid schema returns structured error", async () => {
  const model = new ScriptedModel([{ kind: "calls", calls: [call("a", "order_get", '{"other":"x"}')] }, final]);
  await runAgent(model, demoRegistry(), principal, "check");
  const outputs = model.seenInputs[1];
  assert.ok(Array.isArray(outputs));
  assert.equal(JSON.parse(outputs[0].output).error.code, "INVALID_ARGUMENTS");
});

test("write tool never executes even with scope", async () => {
  const model = new ScriptedModel([{ kind: "calls", calls: [call("a", "order_refund", '{"orderId":"1"}')] }, final]);
  await runAgent(model, demoRegistry(), principal, "refund");
  const outputs = model.seenInputs[1];
  assert.ok(Array.isArray(outputs));
  assert.equal(JSON.parse(outputs[0].output).error.code, "APPROVAL_REQUIRED");
});

test("missing scope is forbidden", async () => {
  const model = new ScriptedModel([{ kind: "calls", calls: [call("a", "customer_get", '{"customerId":"2"}')] }, final]);
  await runAgent(model, demoRegistry(), { ...principal, scopes: [] }, "check");
  const outputs = model.seenInputs[1];
  assert.ok(Array.isArray(outputs));
  assert.equal(JSON.parse(outputs[0].output).error.code, "FORBIDDEN");
});

test("duplicate call IDs are rejected", async () => {
  const model = new ScriptedModel([{ kind: "calls", calls: [call("a", "order_get", '{}'), call("a", "order_get", '{}')] }]);
  await assert.rejects(() => runAgent(model, demoRegistry(), principal, "check"), /DUPLICATE_CALL_ID/);
});

test("tool budget terminates batch before side effects", async () => {
  const model = new ScriptedModel([{ kind: "calls", calls: [call("a", "order_get", '{}'), call("b", "order_get", '{}')] }]);
  await assert.rejects(() => runAgent(model, demoRegistry(), principal, "check", {
    maxModelTurns: 2, maxToolCalls: 1, parallelReads: 2
  }), /MAX_TOOL_CALLS/);
});
