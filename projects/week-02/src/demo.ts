import { demoRegistry, runAgent } from "./core.js";
import { ScriptedModel } from "./fake-model.js";

const model = new ScriptedModel([
  { kind: "calls", calls: [
    { callId: "call_order", name: "order_get", argumentsJson: '{"orderId":"ORD-123"}' },
    { callId: "call_customer", name: "customer_get", argumentsJson: '{"customerId":"C-7"}' }
  ] },
  { kind: "final", text: "订单 ORD-123 已支付，客户 C-7 是金牌客户。" }
]);
const result = await runAgent(model, demoRegistry(), {
  tenantId: "tenant-a", userId: "user-1", scopes: ["order:read", "customer:read"]
}, "查询 ORD-123 及客户 C-7");
console.log(JSON.stringify({ result, toolOutputs: model.seenInputs[1] }, null, 2));
