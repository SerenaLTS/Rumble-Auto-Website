-- Additive: preserves the existing enquiries table and its historical records.
CREATE TABLE IF NOT EXISTS enquiry_requests (
  request_key TEXT PRIMARY KEY,
  payload_hash TEXT NOT NULL,
  event_id TEXT NOT NULL UNIQUE,
  owner_token TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS meta_capi_outbox (
  event_id TEXT PRIMARY KEY,
  payload_json TEXT,
  test_event_code TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_ms INTEGER NOT NULL,
  lease_until_ms INTEGER NOT NULL DEFAULT 0,
  lease_token TEXT,
  created_at_ms INTEGER NOT NULL,
  sent_at_ms INTEGER,
  last_error TEXT
);
CREATE INDEX IF NOT EXISTS meta_capi_due ON meta_capi_outbox(status, next_attempt_ms);
