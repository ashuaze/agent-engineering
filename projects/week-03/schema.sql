-- PostgreSQL 16+ teaching schema. Not automatically applied by the in-memory demo.
CREATE TABLE agent_runs (
  id uuid PRIMARY KEY,
  tenant_id text NOT NULL,
  agent_version text NOT NULL,
  input_text text NOT NULL,
  status text NOT NULL CHECK (status IN ('CREATED','RUNNING','WAITING','COMPLETED','FAILED','CANCELLED')),
  version bigint NOT NULL DEFAULT 0,
  step_seq bigint NOT NULL DEFAULT 0,
  event_seq bigint NOT NULL DEFAULT 0,
  output_text text,
  error_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE agent_steps (
  id uuid PRIMARY KEY,
  run_id uuid NOT NULL REFERENCES agent_runs(id),
  seq bigint NOT NULL,
  kind text NOT NULL CHECK (kind IN ('MODEL','TOOL')),
  status text NOT NULL CHECK (status IN ('STARTED','SUCCEEDED','FAILED')),
  input_json jsonb NOT NULL,
  output_json jsonb,
  error_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, seq)
);
CREATE UNIQUE INDEX one_active_step_per_run ON agent_steps(run_id) WHERE status='STARTED';
CREATE TABLE agent_events (
  id uuid PRIMARY KEY,
  run_id uuid NOT NULL REFERENCES agent_runs(id),
  seq bigint NOT NULL,
  event_type text NOT NULL,
  payload_json jsonb NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, seq)
);
CREATE INDEX agent_runs_tenant_status_idx ON agent_runs(tenant_id,status,created_at);
CREATE INDEX agent_steps_run_idx ON agent_steps(run_id,seq);
-- A run transition and its event insertion MUST occur in the same transaction.
-- CAS example: UPDATE agent_runs SET status=$3, version=version+1
-- WHERE id=$1 AND version=$2 AND status=$4 RETURNING version;
-- If zero rows are updated: reject the stale transition; do not silently retry an external write.
