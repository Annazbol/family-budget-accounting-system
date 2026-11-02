-- Связь системных операций с целью/кредитом
BEGIN;

CREATE TABLE IF NOT EXISTS schema_migrations (
  id          TEXT PRIMARY KEY,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE operations ADD COLUMN IF NOT EXISTS source_type TEXT;
ALTER TABLE operations ADD COLUMN IF NOT EXISTS source_id BIGINT;

-- мягкая проверка значений
ALTER TABLE operations DROP CONSTRAINT IF EXISTS operations_source_type_check;
ALTER TABLE operations ADD CONSTRAINT operations_source_type_check
  CHECK (source_type IS NULL OR source_type IN ('goal', 'loan'));

INSERT INTO schema_migrations (id) VALUES ('003_operations_source')
ON CONFLICT (id) DO NOTHING;

COMMIT;
