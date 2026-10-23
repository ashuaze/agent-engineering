import { randomUUID } from 'node:crypto';
import { z } from 'zod';

export type Principal = { userId: string; tenantId: string; scopes: string[] };
export type Message =
  | { role: 'user' | 'assistant'; content: string }
  | { role: 'tool'; name: string; content: string };
export type Decision =
  | { kind: 'tool'; name: string; arguments: unknown }
  | { kind: 'final'; text: string };
export interface ModelPort {
  decide(messages: ReadonlyArray<Message>, availableTools: ReadonlyArray<string>): Promise<Decision>;
}
export interface Tool {
  name: string;
  schema: z.ZodType;
  requiredScope: string;
  mode: 'read' | 'write';
  execute(input: unknown, principal: Principal, signal: AbortSignal): Promise<unknown>;
}
export interface PolicyPort {
  allow(principal: Principal, tool: Tool, parsedInput: unknown): Promise<boolean>;
}
export type Event = {
  at: string;
  type: 'model.decision' | 'tool.denied' | 'tool.invalid' | 'tool.started' | 'tool.completed' | 'run.completed' | 'run.failed';
  detail: Record<string, string | number | boolean>;
};
export type Run = {
  id: string;
  status: 'running' | 'completed' | 'failed';
  messages: Message[];
  events: Event[];
  modelTurns: number;
  toolCalls: number;
  result?: string;
  error?: string;
};
export type Limits = { maxModelTurns: number; maxToolCalls: number; maxDurationMs: number };

// Educational, process-local store. Replace with durable storage in Week 3/4.
export class InMemoryRunStore {
  private readonly runs = new Map<string, Run>();
  put(run: Run): void { this.runs.set(run.id, run); }
  get(id: string): Run | undefined { return this.runs.get(id); }
}

export class DefaultPolicy implements PolicyPort {
  async allow(principal: Principal, tool: Tool): Promise<boolean> {
    // Fail closed for writes. Future lessons introduce approvals and business policy.
    return tool.mode === 'read' && principal.scopes.includes(tool.requiredScope);
  }
}

export class Harness {
  private readonly tools = new Map<string, Tool>();
  constructor(
    private readonly model: ModelPort,
    tools: Tool[],
    private readonly policy: PolicyPort,
    private readonly store: InMemoryRunStore,
    private readonly limits: Limits = { maxModelTurns: 6, maxToolCalls: 4, maxDurationMs: 5_000 },
  ) {
    for (const tool of tools) {
      if (this.tools.has(tool.name)) throw new Error(`Duplicate tool: ${tool.name}`);
      this.tools.set(tool.name, tool);
    }
  }

  async run(goal: string, principal: Principal): Promise<Run> {
    const run: Run = {
      id: randomUUID(), status: 'running', messages: [{ role: 'user', content: goal }],
      events: [], modelTurns: 0, toolCalls: 0,
    };
    this.store.put(run);
    const startedAt = Date.now();
    const emit = (type: Event['type'], detail: Event['detail'] = {}) => {
      run.events.push({ at: new Date().toISOString(), type, detail });
    };
    try {
      while (run.status === 'running') {
        if (Date.now() - startedAt >= this.limits.maxDurationMs) throw new Error('TIME_BUDGET_EXCEEDED');
        if (run.modelTurns >= this.limits.maxModelTurns) throw new Error('MODEL_TURN_BUDGET_EXCEEDED');
        run.modelTurns++;
        const decision = await this.model.decide(run.messages, [...this.tools.keys()]);
        emit('model.decision', { kind: decision.kind });

        if (decision.kind === 'final') {
          run.result = decision.text;
          run.messages.push({ role: 'assistant', content: decision.text });
          run.status = 'completed';
          emit('run.completed', { modelTurns: run.modelTurns, toolCalls: run.toolCalls });
          break;
        }

        if (run.toolCalls >= this.limits.maxToolCalls) throw new Error('TOOL_CALL_BUDGET_EXCEEDED');
        run.toolCalls++;
        const tool = this.tools.get(decision.name);
        if (!tool) {
          emit('tool.denied', { tool: decision.name, reason: 'UNKNOWN_TOOL' });
          run.messages.push({ role: 'tool', name: decision.name, content: JSON.stringify({ error: 'UNKNOWN_TOOL' }) });
          continue;
        }
        const parsed = tool.schema.safeParse(decision.arguments);
        if (!parsed.success) {
          emit('tool.invalid', { tool: tool.name });
          run.messages.push({ role: 'tool', name: tool.name, content: JSON.stringify({ error: 'INVALID_ARGUMENTS' }) });
          continue;
        }
        if (!(await this.policy.allow(principal, tool, parsed.data))) {
          emit('tool.denied', { tool: tool.name, reason: 'POLICY_DENIED' });
          run.messages.push({ role: 'tool', name: tool.name, content: JSON.stringify({ error: 'POLICY_DENIED' }) });
          continue;
        }

        emit('tool.started', { tool: tool.name });
        const remainingMs = Math.max(1, this.limits.maxDurationMs - (Date.now() - startedAt));
        const result = await tool.execute(parsed.data, principal, AbortSignal.timeout(remainingMs));
        // Tool data is visible to the model but intentionally omitted from the trace.
        run.messages.push({ role: 'tool', name: tool.name, content: JSON.stringify(result) });
        emit('tool.completed', { tool: tool.name });
      }
    } catch (error) {
      run.status = 'failed';
      run.error = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
      emit('run.failed', { reason: run.error });
    }
    this.store.put(run);
    return run;
  }
}

export class ScriptedModel implements ModelPort {
  constructor(private readonly script: Decision[]) {}
  async decide(): Promise<Decision> {
    const next = this.script.shift();
    if (!next) throw new Error('SCRIPT_EXHAUSTED');
    return next;
  }
}
