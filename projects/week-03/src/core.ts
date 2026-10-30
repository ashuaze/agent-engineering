/** Week 03: a deterministic, in-memory teaching kernel (NOT crash-safe). */
export type RunStatus = 'CREATED' | 'RUNNING' | 'WAITING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type StepStatus = 'STARTED' | 'SUCCEEDED' | 'FAILED';
export type StepKind = 'MODEL' | 'TOOL';
export type Run = {
  id: string; tenantId: string; agentVersion: string; input: string;
  status: RunStatus; version: number; stepSeq: number; eventSeq: number;
  output?: string; error?: string;
};
export type Step = {
  id: string; runId: string; seq: number; kind: StepKind;
  status: StepStatus; input: unknown; output?: unknown; error?: string;
};
export type RuntimeEvent = {
  id: string; runId: string; seq: number; type: string;
  payload: unknown; occurredAt: string;
};
export type ModelTurn =
  | { kind: 'final'; text: string }
  | { kind: 'tool'; callId: string; name: string; args: Record<string, unknown> };
export type TranscriptItem =
  | { role: 'user'; text: string }
  | { role: 'tool'; callId: string; output: unknown };
export interface Model { next(history: TranscriptItem[]): Promise<ModelTurn>; }
export interface ReadTool {
  name: string;
  execute(args: Record<string, unknown>, tenantId: string): Promise<unknown>;
}
export interface RunStore {
  create(input: { tenantId: string; agentVersion: string; prompt: string }): Promise<Run>;
  get(id: string): Promise<Run>;
  transition(id: string, expectedVersion: number, to: RunStatus, data?: { output?: string; error?: string }): Promise<Run>;
  beginStep(id: string, kind: StepKind, input: unknown): Promise<Step>;
  finishStep(id: string, stepId: string, result: { ok: true; output: unknown } | { ok: false; error: string }): Promise<Step>;
  steps(id: string): Promise<Step[]>;
  events(id: string): Promise<RuntimeEvent[]>;
}
const transitions: Record<RunStatus, ReadonlySet<RunStatus>> = {
  CREATED: new Set(['RUNNING', 'CANCELLED']),
  RUNNING: new Set(['WAITING', 'COMPLETED', 'FAILED', 'CANCELLED']),
  WAITING: new Set(['RUNNING', 'CANCELLED']),
  COMPLETED: new Set(), FAILED: new Set(), CANCELLED: new Set()
};
const copy = <T>(v: T): T => structuredClone(v);
export class ConflictError extends Error { constructor(message = 'VERSION_CONFLICT') { super(message); } }
export class MemoryStore implements RunStore {
  private runs = new Map<string, Run>();
  private stepMap = new Map<string, Step[]>();
  private eventMap = new Map<string, RuntimeEvent[]>();
  private emit(run: Run, type: string, payload: unknown): void {
    run.eventSeq += 1;
    this.eventMap.get(run.id)!.push({
      id: crypto.randomUUID(), runId: run.id, seq: run.eventSeq,
      type, payload: copy(payload), occurredAt: new Date().toISOString()
    });
  }
  async create(input: { tenantId: string; agentVersion: string; prompt: string }): Promise<Run> {
    if (!input.tenantId || !input.agentVersion) throw new Error('INVALID_RUN_INPUT');
    const run: Run = { id: crypto.randomUUID(), tenantId: input.tenantId,
      agentVersion: input.agentVersion, input: input.prompt, status: 'CREATED',
      version: 0, stepSeq: 0, eventSeq: 0 };
    this.runs.set(run.id, run);
    this.stepMap.set(run.id, []); this.eventMap.set(run.id, []);
    this.emit(run, 'RunCreated', { agentVersion: run.agentVersion });
    return copy(run);
  }
  async get(id: string): Promise<Run> {
    const run = this.runs.get(id); if (!run) throw new Error('RUN_NOT_FOUND');
    return copy(run);
  }
  async transition(id: string, expectedVersion: number, to: RunStatus, data: { output?: string; error?: string } = {}): Promise<Run> {
    const run = this.runs.get(id); if (!run) throw new Error('RUN_NOT_FOUND');
    if (run.version !== expectedVersion) throw new ConflictError();
    if (!transitions[run.status].has(to)) throw new Error(`INVALID_TRANSITION:${run.status}->${to}`);
    if (to === 'COMPLETED' && this.stepMap.get(id)!.some(s => s.status === 'STARTED')) throw new Error('ACTIVE_STEP');
    const previous = run.status;
    run.status = to; run.version += 1;
    if (data.output !== undefined) run.output = data.output;
    if (data.error !== undefined) run.error = data.error;
    this.emit(run, 'RunStatusChanged', { from: previous, to, version: run.version });
    return copy(run);
  }
  async beginStep(id: string, kind: StepKind, input: unknown): Promise<Step> {
    const run = this.runs.get(id); if (!run) throw new Error('RUN_NOT_FOUND');
    if (run.status !== 'RUNNING') throw new Error('RUN_NOT_RUNNING');
    if (this.stepMap.get(id)!.some(s => s.status === 'STARTED')) throw new ConflictError('ACTIVE_STEP');
    const step: Step = { id: crypto.randomUUID(), runId: id, seq: ++run.stepSeq,
      kind, status: 'STARTED', input: copy(input) };
    this.stepMap.get(id)!.push(step);
    this.emit(run, 'StepStarted', { stepId: step.id, seq: step.seq, kind });
    return copy(step);
  }
  async finishStep(id: string, stepId: string, result: { ok: true; output: unknown } | { ok: false; error: string }): Promise<Step> {
    const run = this.runs.get(id); if (!run) throw new Error('RUN_NOT_FOUND');
    const step = this.stepMap.get(id)!.find(s => s.id === stepId);
    if (!step) throw new Error('STEP_NOT_FOUND');
    if (step.status !== 'STARTED') throw new ConflictError('STEP_ALREADY_FINISHED');
    step.status = result.ok ? 'SUCCEEDED' : 'FAILED';
    if (result.ok) step.output = copy(result.output); else step.error = result.error;
    this.emit(run, result.ok ? 'StepSucceeded' : 'StepFailed', { stepId, kind: step.kind });
    return copy(step);
  }
  async steps(id: string): Promise<Step[]> { await this.get(id); return copy(this.stepMap.get(id)!); }
  async events(id: string): Promise<RuntimeEvent[]> { await this.get(id); return copy(this.eventMap.get(id)!); }
}
export class FakeModel implements Model {
  constructor(private readonly turns: ModelTurn[]) {}
  async next(_history: TranscriptItem[]): Promise<ModelTurn> {
    const turn = this.turns.shift(); if (!turn) throw new Error('FAKE_MODEL_EXHAUSTED');
    return copy(turn);
  }
}
export class Kernel {
  constructor(private readonly store: RunStore, private readonly model: Model,
    private readonly tools: Map<string, ReadTool>, private readonly maxTurns = 8) {}
  async drain(runId: string): Promise<Run> {
    let run = await this.store.get(runId);
    if (run.status === 'CREATED') run = await this.store.transition(runId, run.version, 'RUNNING');
    if (run.status !== 'RUNNING') throw new Error('RUN_NOT_RUNNING');
    // Only one worker may drain a run. The in-memory store is NOT a distributed lease.
    const history: TranscriptItem[] = [{ role: 'user', text: run.input }];
    try {
      for (let i = 0; i < this.maxTurns; i++) {
        const modelStep = await this.store.beginStep(runId, 'MODEL', { history });
        let turn: ModelTurn;
        try {
          turn = await this.model.next(copy(history));
          await this.store.finishStep(runId, modelStep.id, { ok: true, output: turn });
        } catch (error) {
          await this.store.finishStep(runId, modelStep.id, { ok: false, error: String(error) });
          throw error;
        }
        if (turn.kind === 'final') {
          const latest = await this.store.get(runId);
          return this.store.transition(runId, latest.version, 'COMPLETED', { output: turn.text });
        }
        const toolStep = await this.store.beginStep(runId, 'TOOL', turn);
        try {
          const tool = this.tools.get(turn.name);
          if (!tool) throw new Error('UNKNOWN_TOOL');
          const result = await tool.execute(copy(turn.args), run.tenantId);
          await this.store.finishStep(runId, toolStep.id, { ok: true, output: result });
          history.push({ role: 'tool', callId: turn.callId, output: result });
        } catch (error) {
          await this.store.finishStep(runId, toolStep.id, { ok: false, error: String(error) });
          throw error;
        }
      }
      throw new Error('MODEL_TURN_BUDGET_EXCEEDED');
    } catch (error) {
      const latest = await this.store.get(runId);
      if (latest.status === 'RUNNING') return this.store.transition(runId, latest.version, 'FAILED', { error: String(error) });
      throw error;
    }
  }
}
