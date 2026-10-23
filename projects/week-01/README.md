# Agent Harness — Week 01

A dependency-injected, keyless TypeScript educational runtime. It illustrates the boundary between model decisions and execution governance.

## Requirements
Node.js 22+; npm. No API key or external service is required.

```bash
npm install
npm run typecheck
npm test
npm run demo
```

## What this demo implements
- ModelPort / ScriptedModel for deterministic model decisions
- Harness loop with model-turn, tool-call and elapsed-time budgets
- Zod tool argument validation
- A deny-by-default-for-writes policy (including when the caller has a write scope)
- Execution events and in-memory run storage
- Four unit tests

## Deliberately NOT production-ready
- State is process-local, not PostgreSQL-backed or durable.
- No concurrency coordination, transaction ledger, idempotency, approval/resume, recovery, or queue.
- No model-provider adapter, RAG, memory, tenant-isolated data access, or full security review.
- The timeout AbortSignal is advisory: tools must honor cancellation. No hard isolation for untrusted tools.
- The demo model is scripted and does not inspect messages; its output is predetermined.
- Logs avoid tool payloads, but the in-memory messages still contain tool data. Real systems need classification, retention, redaction, and access controls.

Weeks 2–5 will extend the runtime incrementally with real tool-call semantics, persisted steps, pause/resume, and idempotent side effects.
