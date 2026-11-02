-- Family Budget — полная актуальная схема (чистая БД).
-- psql ... -f sql/001_schema.sql

BEGIN;

CREATE TABLE IF NOT EXISTS schema_migrations (
  id          TEXT PRIMARY KEY,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== Пользователи ==========
CREATE TABLE IF NOT EXISTS users (
  id              BIGSERIAL PRIMARY KEY,
  email           TEXT NOT NULL,
  login           TEXT NOT NULL,
  name            TEXT NOT NULL,
  password_hash   TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT users_email_unique UNIQUE (email),
  CONSTRAINT users_login_unique UNIQUE (login),
  CONSTRAINT users_email_len CHECK (char_length(email) BETWEEN 3 AND 255),
  CONSTRAINT users_login_len CHECK (char_length(login) BETWEEN 1 AND 100),
  CONSTRAINT users_name_len  CHECK (char_length(name)  BETWEEN 1 AND 100)
);

-- ========== Категории ==========
CREATE TABLE IF NOT EXISTS categories (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  type       CHAR(1) NOT NULL CHECK (type IN ('i', 'e')),
  name       TEXT NOT NULL,
  CONSTRAINT categories_name_len CHECK (char_length(name) BETWEEN 1 AND 100)
);

CREATE INDEX IF NOT EXISTS categories_user_id_idx ON categories (user_id);

-- ========== Операции ==========
CREATE TABLE IF NOT EXISTS operations (
  id           BIGSERIAL PRIMARY KEY,
  user_id      BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  type         CHAR(1) NOT NULL CHECK (type IN ('i', 'e')),
  name         TEXT NOT NULL,
  amount       NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  currency     CHAR(3) NOT NULL CHECK (currency IN ('RUB', 'USD', 'EUR', 'KZT', 'BYN')),
  date         DATE NOT NULL,
  category_id  BIGINT NOT NULL REFERENCES categories (id) ON DELETE RESTRICT,
  note         TEXT NOT NULL DEFAULT '',
  locked       BOOLEAN NOT NULL DEFAULT FALSE,
  source_type  TEXT,
  source_id    BIGINT,
  CONSTRAINT operations_name_len CHECK (char_length(name) BETWEEN 1 AND 100),
  CONSTRAINT operations_note_len CHECK (char_length(note) <= 255),
  CONSTRAINT operations_source_type_check CHECK (source_type IS NULL OR source_type IN ('goal', 'loan'))
);

CREATE INDEX IF NOT EXISTS operations_user_id_idx ON operations (user_id);
CREATE INDEX IF NOT EXISTS operations_user_date_idx ON operations (user_id, date);
CREATE INDEX IF NOT EXISTS operations_category_id_idx ON operations (category_id);

CREATE OR REPLACE FUNCTION check_operation_category_type()
RETURNS TRIGGER AS $$
DECLARE
  cat_type CHAR(1);
  cat_user BIGINT;
BEGIN
  SELECT type, user_id INTO cat_type, cat_user
  FROM categories WHERE id = NEW.category_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'category not found' USING ERRCODE = 'foreign_key_violation';
  END IF;
  IF cat_user <> NEW.user_id THEN
    RAISE EXCEPTION 'category belongs to another user' USING ERRCODE = 'check_violation';
  END IF;
  IF cat_type <> NEW.type THEN
    RAISE EXCEPTION 'category type mismatch' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS operations_category_type_trg ON operations;
CREATE TRIGGER operations_category_type_trg
  BEFORE INSERT OR UPDATE ON operations
  FOR EACH ROW EXECUTE FUNCTION check_operation_category_type();

-- ========== Цели ==========
CREATE TABLE IF NOT EXISTS goals (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  target     NUMERIC(14, 2) NOT NULL CHECK (target > 0),
  saved      NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (saved >= 0),
  currency   CHAR(3) NOT NULL CHECK (currency IN ('RUB', 'USD', 'EUR', 'KZT', 'BYN')),
  due        DATE NOT NULL,
  CONSTRAINT goals_name_len CHECK (char_length(name) BETWEEN 1 AND 100)
);

CREATE INDEX IF NOT EXISTS goals_user_id_idx ON goals (user_id);

-- ========== Долги ==========
CREATE TABLE IF NOT EXISTS debts (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  direction   TEXT NOT NULL CHECK (direction IN ('owe', 'owed')),
  amount      NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  currency    CHAR(3) NOT NULL CHECK (currency IN ('RUB', 'USD', 'EUR', 'KZT', 'BYN')),
  due         DATE NOT NULL,
  note        TEXT NOT NULL DEFAULT '',
  CONSTRAINT debts_note_len CHECK (char_length(note) <= 255)
);

CREATE INDEX IF NOT EXISTS debts_user_id_idx ON debts (user_id);

-- ========== Кредиты (аннуитет: amount, rate, paid, start_date, term_months) ==========
CREATE TABLE IF NOT EXISTS loans (
  id           BIGSERIAL PRIMARY KEY,
  user_id      BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  amount       NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  rate         NUMERIC(6, 2) NOT NULL CHECK (rate >= 0 AND rate <= 100),
  paid         NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (paid >= 0),
  start_date   DATE NOT NULL,
  term_months  SMALLINT NOT NULL CHECK (term_months >= 1 AND term_months <= 600),
  currency     CHAR(3) NOT NULL CHECK (currency IN ('RUB', 'USD', 'EUR', 'KZT', 'BYN')),
  CONSTRAINT loans_name_len CHECK (char_length(name) BETWEEN 1 AND 100)
);

CREATE INDEX IF NOT EXISTS loans_user_id_idx ON loans (user_id);

-- ========== Коды подтверждения email ==========
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

INSERT INTO schema_migrations (id) VALUES ('001_schema')
ON CONFLICT (id) DO NOTHING;

COMMIT;
