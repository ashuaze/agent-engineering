import * as z from "zod";

export type FunctionCall = {
  callId: string;
  name: string;
  argumentsJson: string;
};
export type FunctionOutput = { callId: string; output: string };
export type ModelTurn =
  | { kind: "calls"; calls: FunctionCall[] }
  | { kind: "final"; text: string };
export interface ModelSession {
  next(input: string | FunctionOutput[]): Promise<ModelTurn>;
}
export type Principal = {
  tenantId: string;
  userId: string;
  scopes: string[];
};
export type ToolContext = {
  principal: Principal;
  signal: AbortSignal;
};
export type Tool = {
  name: string;
  description: string;
  schema: z.ZodType;
  mode: "read" | "write";
  requiredScope: string;
  execute: (args: any, ctx: ToolContext) => Promise<unknown>;
};
export type ToolErrorCode =
  | "UNKNOWN_TOOL"
  | "INVALID_JSON"
  | "INVALID_ARGUMENTS"
  | "FORBIDDEN"
  | "APPROVAL_REQUIRED"
  | "TOOL_TIMEOUT"
  | "TOOL_FAILED";

export class ToolRegistry {
  private readonly tools = new Map<string, Tool>();
  register(tool: Tool): void {
    if (this.tools.has(tool.name)) throw new Error(`DUPLICATE_TOOL:${tool.name}`);
    this.tools.set(tool.name, tool);
  }
  get(name: string): Tool | undefined { return this.tools.get(name); }
  list(): Tool[] { return [...this.tools.values()]; }
}

function errorOutput(callId: string, code: ToolErrorCode): FunctionOutput {
  return { callId, output: JSON.stringify({ ok: false, error: { code } }) };
}

export async function executeCall(
  call: FunctionCall,
  registry: ToolRegistry,
  principal: Principal,
  timeoutMs = 3000
): Promise<FunctionOutput> {
  const tool = registry.get(call.name);
  if (!tool) return errorOutput(call.callId, "UNKNOWN_TOOL");

  let parsedJson: unknown;
  try { parsedJson = JSON.parse(call.argumentsJson); }
  catch { return errorOutput(call.callId, "INVALID_JSON"); }

  const parsed = tool.schema.safeParse(parsedJson);
  if (!parsed.success) return errorOutput(call.callId, "INVALID_ARGUMENTS");
  if (!principal.scopes.includes(tool.requiredScope)) {
    return errorOutput(call.callId, "FORBIDDEN");
  }
  // Demo is deliberately read-only: write tools need an approval + durable ledger.
  if (tool.mode === "write") return errorOutput(call.callId, "APPROVAL_REQUIRED");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const data = await tool.execute(parsed.data, { principal, signal: controller.signal });
    return { callId: call.callId, output: JSON.stringify({ ok: true, data }) };
  } catch (e) {
    // The tool is expected to cooperate with AbortSignal. This is NOT a hard kill.
    return errorOutput(call.callId, controller.signal.aborted ? "TOOL_TIMEOUT" : "TOOL_FAILED");
  } finally {
    clearTimeout(timer);
  }
}

async function parallelMapLimit<T, R>(
  items: T[], limit: number, worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await worker(items[index]);
    }
  }));
  return results;
}

export type RunResult = { answer: string; modelTurns: number; toolCalls: number };
export async function runAgent(
  model: ModelSession,
  registry: ToolRegistry,
  principal: Principal,
  userInput: string,
  limits = { maxModelTurns: 6, maxToolCalls: 12, parallelReads: 3 }
): Promise<RunResult> {
  let input: string | FunctionOutput[] = userInput;
  let totalCalls = 0;
  for (let turn = 1; turn <= limits.maxModelTurns; turn++) {
    const response = await model.next(input);
    if (response.kind === "final") {
      return { answer: response.text, modelTurns: turn, toolCalls: totalCalls };
    }
    const calls = response.calls;
    if (calls.length === 0) throw new Error("EMPTY_TOOL_BATCH");
    if (new Set(calls.map(c => c.callId)).size !== calls.length) {
      throw new Error("DUPLICATE_CALL_ID");
    }
    totalCalls += calls.length;
    if (totalCalls > limits.maxToolCalls) throw new Error("MAX_TOOL_CALLS");

    // Parallelize only an explicitly independent, read-only batch.
    // Model output in this demo has no dependency graph, so a mixed batch is sequential.
    const safeParallel = calls.every(c => registry.get(c.name)?.mode === "read");
    const exec = (call: FunctionCall) => executeCall(call, registry, principal);
    input = safeParallel
      ? await parallelMapLimit(calls, limits.parallelReads, exec)
      : await parallelMapLimit(calls, 1, exec);
    // All outputs preserve their corresponding call IDs and model call order.
  }
  throw new Error("MAX_MODEL_TURNS");
}

export const orderSchema = z.strictObject({ orderId: z.string() });
export const customerSchema = z.strictObject({ customerId: z.string() });

export function demoRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  registry.register({
    name: "order_get",
    description: "Read an order belonging to the current tenant; do not modify it.",
    schema: orderSchema,
    mode: "read", requiredScope: "order:read",
    async execute({ orderId }: z.infer<typeof orderSchema>, { principal }) {
      return { orderId, tenantId: principal.tenantId, status: "paid", amount: 380 };
    }
  });
  registry.register({
    name: "customer_get",
    description: "Read a customer belonging to the current tenant.",
    schema: customerSchema,
    mode: "read", requiredScope: "customer:read",
    async execute({ customerId }: z.infer<typeof customerSchema>, { principal }) {
      return { customerId, tenantId: principal.tenantId, tier: "gold" };
    }
  });
  registry.register({
    name: "order_refund",
    description: "High-risk write operation. Requires explicit approval.",
    schema: orderSchema,
    mode: "write", requiredScope: "order:refund",
    async execute() { throw new Error("should never run in this demo"); }
  });
  return registry;
}
