import { createHash } from 'node:crypto';

export type Principal = { tenantId: string; userId: string; scopes: readonly string[] };
export type ToolRequest = { runId: string; callId: string; tool: string; args: unknown; principal: Principal; approvalId?: string };
export type ToolResult = { status: 'ok'; value: unknown } | { status: 'denied' | 'approval_required' | 'unknown' | 'conflict'; reason: string };
export type ToolDefinition = {
  name: string; scope: string; risk: 'read' | 'write';
  parse: (input: unknown) => unknown;
  execute: (input: unknown, context: { tenantId: string; userId: string; idempotencyKey: string }) => Promise<unknown>;
};
export type Approval = { id: string; tenantId: string; userId: string; runId: string; callId: string; tool: string; argsHash: string; expiresAt: number; approved: boolean };
export interface ApprovalStore { find(id: string): Approval | undefined }
export type LedgerEntry = { fingerprint: string; state: 'pending' | 'done' | 'unknown'; result?: ToolResult };
export interface Ledger { get(key: string): LedgerEntry | undefined; putIfAbsent(key: string, entry: LedgerEntry): boolean; set(key: string, entry: LedgerEntry): void }
export class MemoryLedger implements Ledger {
  private readonly entries = new Map<string, LedgerEntry>();
  get(key: string) { return this.entries.get(key); }
  putIfAbsent(key: string, entry: LedgerEntry) { if (this.entries.has(key)) return false; this.entries.set(key, entry); return true; }
  set(key: string, entry: LedgerEntry) { this.entries.set(key, entry); }
}
export class MemoryApprovals implements ApprovalStore {
  constructor(private readonly approvals: Approval[]) {}
  find(id: string) { return this.approvals.find(a => a.id === id); }
}
export const stableStringify = (v: unknown): string => {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  return `{${Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, val]) => `${JSON.stringify(k)}:${stableStringify(val)}`).join(',')}}`;
};
export const hash = (v: unknown) => createHash('sha256').update(stableStringify(v)).digest('hex');
export class ToolGateway {
  private readonly registry = new Map<string, ToolDefinition>();
  constructor(tools: ToolDefinition[], private readonly approvals: ApprovalStore, private readonly ledger: Ledger, private readonly now = () => Date.now()) {
    for (const tool of tools) { if (this.registry.has(tool.name)) throw Error('duplicate tool'); this.registry.set(tool.name, tool); }
  }
  async call(req: ToolRequest): Promise<ToolResult> {
    const tool = this.registry.get(req.tool);
    if (!tool) return { status: 'denied', reason: 'unregistered tool' };
    if (!req.principal.scopes.includes(tool.scope)) return { status: 'denied', reason: 'missing scope' };
    let parsed: unknown;
    try { parsed = tool.parse(req.args); } catch { return { status: 'denied', reason: 'invalid arguments' }; }
    const argsHash = hash(parsed);
    if (tool.risk === 'write') {
      const approval = req.approvalId && this.approvals.find(req.approvalId);
      if (!approval || !approval.approved || approval.expiresAt <= this.now() ||
          approval.tenantId !== req.principal.tenantId || approval.userId !== req.principal.userId ||
          approval.runId !== req.runId || approval.callId !== req.callId || approval.tool !== req.tool || approval.argsHash !== argsHash) {
        return { status: 'approval_required', reason: 'valid bound approval required' };
      }
    }
    const key = `${req.principal.tenantId}:${req.runId}:${req.callId}`;
    const fingerprint = hash({ tool: req.tool, args: parsed, principal: req.principal.userId });
    const existing = this.ledger.get(key);
    if (existing) {
      if (existing.fingerprint !== fingerprint) return { status: 'conflict', reason: 'callId reused with different input' };
      if (existing.state === 'done') return existing.result!;
      return { status: 'unknown', reason: 'in-flight or uncertain outcome: reconcile before retry' };
    }
    if (!this.ledger.putIfAbsent(key, { fingerprint, state: 'pending' })) return { status: 'unknown', reason: 'concurrent claim' };
    try {
      const value = await tool.execute(parsed, { tenantId: req.principal.tenantId, userId: req.principal.userId, idempotencyKey: key });
      const result: ToolResult = { status: 'ok', value };
      this.ledger.set(key, { fingerprint, state: 'done', result });
      return result;
    } catch {
      this.ledger.set(key, { fingerprint, state: 'unknown' });
      return { status: 'unknown', reason: 'downstream may have committed; reconcile first' };
    }
  }
}
