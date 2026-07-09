-- ============================================================
-- FIFA Tournament Management System - Database Schema
-- PostgreSQL DDL
-- ============================================================

-- Clean slate (dev only — remove in production migrations)
DROP TABLE IF EXISTS user_ratings, match_comments, fantasy_scoring, fantasy_players,
  fantasy_teams, predictions, match_stats, matches, tournament_participants,
  tournaments, refresh_tokens, users CASCADE;

-- ------------------------------------------------------------
-- USERS & AUTH
-- ------------------------------------------------------------
CREATE TABLE users (
  id              SERIAL PRIMARY KEY,
  username        VARCHAR(30)  UNIQUE NOT NULL,
  email           VARCHAR(150) UNIQUE NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,
  role            VARCHAR(20)  NOT NULL DEFAULT 'player'
                  CHECK (role IN ('admin', 'organizer', 'player')),
  avatar_url      VARCHAR(255),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Refresh tokens stored server-side so they can be revoked
CREATE TABLE refresh_tokens (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  VARCHAR(255) NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- TOURNAMENTS
-- ------------------------------------------------------------
CREATE TABLE tournaments (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(150) NOT NULL,
  type            VARCHAR(20)  NOT NULL
                  CHECK (type IN ('knockout', 'round_robin', 'group_knockout')),
  status          VARCHAR(20)  NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'seeding', 'in_progress', 'completed', 'cancelled')),
  organizer_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  max_participants INTEGER NOT NULL DEFAULT 16,
  start_date      DATE,
  end_date        DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE tournament_participants (
  id             SERIAL PRIMARY KEY,
  tournament_id  INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  name           VARCHAR(100) NOT NULL,     -- team/player name (external, not necessarily a user)
  seed           INTEGER,                   -- 1 = top seed
  skill_rating   NUMERIC(6,2) DEFAULT 0,    -- used for seeding
  group_label    VARCHAR(5),                -- e.g. 'A', 'B' for group stage
  eliminated     BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (tournament_id, seed)
);

-- ------------------------------------------------------------
-- MATCHES
-- ------------------------------------------------------------
CREATE TABLE matches (
  id                SERIAL PRIMARY KEY,
  tournament_id     INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  round             INTEGER NOT NULL,               -- 1 = first round, higher = later rounds
  round_name        VARCHAR(30),                    -- 'Round of 16', 'Quarter-final', etc.
  match_index       INTEGER NOT NULL,                -- position within the round (bracket slot)
  group_label       VARCHAR(5),                      -- for round-robin/group stage
  participant1_id   INTEGER REFERENCES tournament_participants(id),
  participant2_id   INTEGER REFERENCES tournament_participants(id),
  participant1_score INTEGER,
  participant2_score INTEGER,
  winner_id         INTEGER REFERENCES tournament_participants(id),
  status            VARCHAR(20) NOT NULL DEFAULT 'scheduled'
                    CHECK (status IN ('scheduled', 'live', 'completed', 'postponed')),
  scheduled_at      TIMESTAMPTZ,
  next_match_id     INTEGER REFERENCES matches(id), -- winner advances to this match
  external_ref      VARCHAR(100),                   -- id from an external API, for syncing live data
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_matches_tournament ON matches(tournament_id);
CREATE INDEX idx_matches_next_match ON matches(next_match_id);

CREATE TABLE match_stats (
  id           SERIAL PRIMARY KEY,
  match_id     INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  participant_id INTEGER NOT NULL REFERENCES tournament_participants(id),
  goals        INTEGER DEFAULT 0,
  assists      INTEGER DEFAULT 0,
  yellow_cards INTEGER DEFAULT 0,
  red_cards    INTEGER DEFAULT 0,
  clean_sheet  BOOLEAN DEFAULT FALSE,
  raw_payload  JSONB   -- store the full external API response for auditing
);

-- ------------------------------------------------------------
-- BRACKET GUESSING GAME
-- ------------------------------------------------------------
CREATE TABLE predictions (
  id             SERIAL PRIMARY KEY,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tournament_id  INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  match_id       INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  predicted_winner_id INTEGER NOT NULL REFERENCES tournament_participants(id),
  points_awarded INTEGER DEFAULT 0,
  locked_at      TIMESTAMPTZ,        -- once match starts, prediction locks
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, match_id)         -- one prediction per user per match
);

-- ------------------------------------------------------------
-- FANTASY FOOTBALL GAME
-- ------------------------------------------------------------
CREATE TABLE fantasy_teams (
  id             SERIAL PRIMARY KEY,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tournament_id  INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  team_name      VARCHAR(100) NOT NULL,
  total_points   INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, tournament_id)
);

CREATE TABLE fantasy_players (
  id               SERIAL PRIMARY KEY,
  fantasy_team_id  INTEGER NOT NULL REFERENCES fantasy_teams(id) ON DELETE CASCADE,
  external_player_id VARCHAR(100) NOT NULL,  -- id from SoFIFA / football-data
  player_name      VARCHAR(100) NOT NULL,
  position         VARCHAR(20),
  real_team        VARCHAR(100),
  price            NUMERIC(6,2) DEFAULT 0,
  is_captain       BOOLEAN DEFAULT FALSE      -- captain scores 2x points
);

CREATE TABLE fantasy_scoring (
  id               SERIAL PRIMARY KEY,
  fantasy_player_id INTEGER NOT NULL REFERENCES fantasy_players(id) ON DELETE CASCADE,
  gameweek         INTEGER NOT NULL,
  goals            INTEGER DEFAULT 0,
  assists          INTEGER DEFAULT 0,
  clean_sheets     INTEGER DEFAULT 0,
  minutes_played   INTEGER DEFAULT 0,
  points           INTEGER NOT NULL DEFAULT 0,
  computed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (fantasy_player_id, gameweek)
);

-- ------------------------------------------------------------
-- SOCIAL FEATURES
-- ------------------------------------------------------------
CREATE TABLE match_comments (
  id          SERIAL PRIMARY KEY,
  match_id    INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_comments_match ON match_comments(match_id);

CREATE TABLE user_ratings (
  id            SERIAL PRIMARY KEY,
  rater_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  prediction_accuracy NUMERIC(5,2) DEFAULT 0,  -- cached/denormalized leaderboard stat
  total_points  INTEGER DEFAULT 0,
  rank          INTEGER,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (rater_id)
);

-- ------------------------------------------------------------
-- Helpful view: leaderboard for prediction game
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW prediction_leaderboard AS
SELECT
  u.id AS user_id,
  u.username,
  COALESCE(SUM(p.points_awarded), 0) AS total_points,
  COUNT(p.id) AS predictions_made
FROM users u
LEFT JOIN predictions p ON p.user_id = u.id
GROUP BY u.id, u.username
ORDER BY total_points DESC;
