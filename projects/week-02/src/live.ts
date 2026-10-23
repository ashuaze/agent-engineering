import OpenAI from "openai";
import { demoRegistry, runAgent } from "./core.js";
import { OpenAIModelSession } from "./openai-model.js";

if (!process.env.OPENAI_API_KEY) throw new Error("Set OPENAI_API_KEY first");
const registry = demoRegistry();
const session = new OpenAIModelSession(
  new OpenAI(),
  process.env.OPENAI_MODEL ?? "gpt-5.4-mini",
  registry.list(),
  "你是订单助理。需要订单事实时使用工具；不要编造。不要尝试退款。"
);
const result = await runAgent(session, registry, {
  tenantId: "tenant-demo", userId: "demo-user", scopes: ["order:read", "customer:read"]
}, "请查询订单 ORD-123 与客户 C-7 并总结。", { maxModelTurns: 6, maxToolCalls: 12, parallelReads: 3 });
console.log(result);
