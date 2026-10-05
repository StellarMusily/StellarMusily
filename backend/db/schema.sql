-- Postgres schema for when the in-memory store is replaced (see docs/STARTER_ISSUES.md).

CREATE TABLE courses (
  id            INTEGER PRIMARY KEY,           -- same id as on-chain course_payment
  title         TEXT NOT NULL,
  instrument    TEXT NOT NULL,
  instructor    TEXT NOT NULL,                 -- Stellar G... address
  price_usdc    NUMERIC(12, 2) NOT NULL,
  level         TEXT NOT NULL DEFAULT 'beginner',
  description   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE lessons (
  id            TEXT PRIMARY KEY,
  course_id     INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  position      INTEGER NOT NULL,
  title         TEXT NOT NULL,
  video_url     TEXT,
  challenge     JSONB NOT NULL,                -- e.g. {"type":"note","note":"E2","hz":82.41}
  UNIQUE (course_id, position)
);

CREATE TABLE learners (
  address           TEXT PRIMARY KEY,
  display_name      TEXT NOT NULL,
  xp                INTEGER NOT NULL DEFAULT 0,
  weekly_xp         INTEGER NOT NULL DEFAULT 0,
  streak            INTEGER NOT NULL DEFAULT 0,
  last_practice_day DATE,
  best_accuracy     INTEGER NOT NULL DEFAULT 0,
  total_minutes     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE practice_sessions (
  id          BIGSERIAL PRIMARY KEY,
  learner     TEXT NOT NULL REFERENCES learners(address),
  lesson_id   TEXT NOT NULL REFERENCES lessons(id),
  accuracy    INTEGER NOT NULL CHECK (accuracy BETWEEN 0 AND 100),
  minutes     INTEGER NOT NULL CHECK (minutes > 0),
  xp_earned   INTEGER NOT NULL,
  passed      BOOLEAN NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE lesson_passes (
  learner    TEXT NOT NULL REFERENCES learners(address),
  lesson_id  TEXT NOT NULL REFERENCES lessons(id),
  passed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (learner, lesson_id)
);

CREATE TABLE learner_badges (
  learner    TEXT NOT NULL REFERENCES learners(address),
  badge_id   TEXT NOT NULL,
  earned_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (learner, badge_id)
);

CREATE INDEX idx_learners_weekly_xp ON learners (weekly_xp DESC);
