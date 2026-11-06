-- PostgreSQL 16+ DESIGN SKETCH; not wired to FileStore and not migration-tested.
CREATE TABLE agent_runs (
  run_id text PRIMARY KEY,
  version bigint NOT NULL CHECK (version >= 1),
  status text NOT NULL CHECK (status IN ('RUNNING','WAITING_APPROVAL','COMPLETED','FAILED')),
  cursor bigint NOT NULL DEFAULT 0,
  snapshot jsonb NOT NULL,
  lease_owner text,
  lease_epoch bigint NOT NULL DEFAULT 0,
  lease_expires_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE agent_events (
  run_id text NOT NULL REFERENCES agent_runs(run_id),
  seq bigint NOT NULL,
  kind text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(run_id,seq)
);
CREATE TABLE tool_operations (
  operation_id text PRIMARY KEY,
  run_id text NOT NULL REFERENCES agent_runs(run_id),
  state text NOT NULL CHECK (state IN ('PREPARED','SENT','CONFIRMED','UNKNOWN')),
  idempotency_key text NOT NULL UNIQUE,
  external_reference text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Inside ONE transaction: UPDATE agent_runs SET version=version+1, ... WHERE run_id=$1 AND version=$2 RETURNING version;
-- Abort if 0 rows; INSERT agent_events; COMMIT. Lease epoch fencing must be checked for worker writes.