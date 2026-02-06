-- Migration 003: Audit Log System
-- Tracks all create/update/delete operations for auditing and traceability

CREATE TABLE IF NOT EXISTS audit_log (
    id          BIGSERIAL PRIMARY KEY,
    timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_id     INTEGER REFERENCES users(id),
    username    VARCHAR(100) NOT NULL,
    action      VARCHAR(20) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id   VARCHAR(50) NOT NULL,
    entity_name VARCHAR(200),
    changes     JSONB,
    metadata    JSONB,
    ip_address  VARCHAR(45)
);

CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log (action);

-- Rollback:
-- DROP TABLE IF EXISTS audit_log;
