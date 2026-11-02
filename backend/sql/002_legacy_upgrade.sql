-- Обновление старых БД (созданных до актуальной схемы).
-- Идемпотентно: можно запускать повторно.
-- Чистая БД: достаточно только 001_schema.sql

BEGIN;

CREATE TABLE IF NOT EXISTS schema_migrations (
  id          TEXT PRIMARY KEY,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- --- email_verifications ---
CREATE TABLE IF NOT EXISTS email_verifications (
  id              BIGSERIAL PRIMARY KEY,
  email           TEXT NOT NULL,
  login           TEXT NOT NULL,
  name            TEXT NOT NULL,
  password_hash   TEXT NOT NULL,
  code_hash       TEXT NOT NULL,
  expires_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT email_verifications_email_unique UNIQUE (email)
);

CREATE INDEX IF NOT EXISTS email_verifications_expires_idx ON email_verifications (expires_at);

-- --- operations.locked ---
ALTER TABLE operations ADD COLUMN IF NOT EXISTS locked BOOLEAN NOT NULL DEFAULT FALSE;

-- --- loans: новая модель ---
ALTER TABLE loans ADD COLUMN IF NOT EXISTS amount NUMERIC(14, 2);
ALTER TABLE loans ADD COLUMN IF NOT EXISTS paid NUMERIC(14, 2);
ALTER TABLE loans ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS term_months SMALLINT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'loans' AND column_name = 'initial'
  ) THEN
    UPDATE loans SET
      amount = COALESCE(amount, initial),
      paid = COALESCE(paid, GREATEST(0, initial - COALESCE(current, 0))),
      start_date = COALESCE(start_date, CURRENT_DATE - 30),
      term_months = COALESCE(term_months, 12)
    WHERE amount IS NULL OR paid IS NULL OR start_date IS NULL OR term_months IS NULL;
  END IF;

  UPDATE loans SET
    amount = COALESCE(amount, 1),
    paid = COALESCE(paid, 0),
    start_date = COALESCE(start_date, CURRENT_DATE),
    term_months = COALESCE(term_months, 12)
  WHERE amount IS NULL OR paid IS NULL OR start_date IS NULL OR term_months IS NULL;
END $$;

-- NOT NULL только если колонка ещё nullable
DO $$
BEGIN
  ALTER TABLE loans ALTER COLUMN amount SET NOT NULL;
  ALTER TABLE loans ALTER COLUMN paid SET NOT NULL;
  ALTER TABLE loans ALTER COLUMN start_date SET NOT NULL;
  ALTER TABLE loans ALTER COLUMN term_months SET NOT NULL;
EXCEPTION WHEN others THEN
  NULL; -- уже NOT NULL или таблица пустая с дефолтами
END $$;

ALTER TABLE loans DROP COLUMN IF EXISTS initial;
ALTER TABLE loans DROP COLUMN IF EXISTS current;
ALTER TABLE loans DROP COLUMN IF EXISTS payment;
ALTER TABLE loans DROP COLUMN IF EXISTS day;

-- старые CHECK
ALTER TABLE loans DROP CONSTRAINT IF EXISTS loans_initial_pos;
ALTER TABLE loans DROP CONSTRAINT IF EXISTS loans_current_nonneg;
ALTER TABLE loans DROP CONSTRAINT IF EXISTS loans_payment_pos;
ALTER TABLE loans DROP CONSTRAINT IF EXISTS loans_day_range;
ALTER TABLE loans DROP CONSTRAINT IF EXISTS loans_current_le_initial;
ALTER TABLE loans DROP CONSTRAINT IF EXISTS loans_paid_le_amount;

ALTER TABLE loans DROP CONSTRAINT IF EXISTS loans_amount_pos;
ALTER TABLE loans DROP CONSTRAINT IF EXISTS loans_paid_nonneg;
ALTER TABLE loans DROP CONSTRAINT IF EXISTS loans_term_range;

ALTER TABLE loans ADD CONSTRAINT loans_amount_pos CHECK (amount > 0);
ALTER TABLE loans ADD CONSTRAINT loans_paid_nonneg CHECK (paid >= 0);
ALTER TABLE loans ADD CONSTRAINT loans_term_range CHECK (term_months >= 1 AND term_months <= 600);
-- paid может быть > amount (проценты аннуитета) — отдельного paid <= amount НЕТ

INSERT INTO schema_migrations (id) VALUES ('002_legacy_upgrade')
ON CONFLICT (id) DO NOTHING;

COMMIT;
