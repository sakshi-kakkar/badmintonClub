-- ============================================================
-- BADMINTON CLUB TOURNAMENT MANAGEMENT SYSTEM
-- Database Schema v1.0
-- PostgreSQL 14+
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================
-- CORE TABLES
-- ============================================================

-- Players
CREATE TABLE players (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(150) UNIQUE,
  phone         VARCHAR(20),
  photo_url     TEXT,
  skill_level   VARCHAR(20) CHECK (skill_level IN ('beginner','intermediate','advanced','pro')) DEFAULT 'intermediate',
  wins          INT DEFAULT 0,
  losses        INT DEFAULT 0,
  active        BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Courts
CREATE TABLE courts (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(100) NOT NULL,
  location      VARCHAR(200),
  surface_type  VARCHAR(50) DEFAULT 'synthetic',
  is_available  BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Teams
CREATE TABLE teams (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(100) NOT NULL UNIQUE,
  logo_url      TEXT,
  color         VARCHAR(7) DEFAULT '#3B82F6',
  active        BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Team Members (players belonging to teams)
CREATE TABLE team_members (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id    UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  player_id  UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  role       VARCHAR(20) DEFAULT 'player' CHECK (role IN ('captain','player')),
  joined_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (team_id, player_id)
);

-- ============================================================
-- TOURNAMENT TABLES
-- ============================================================

-- Tournaments
CREATE TABLE tournaments (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                VARCHAR(200) NOT NULL,
  format              VARCHAR(20) NOT NULL CHECK (format IN ('round_robin','knockout','playoff')),
  status              VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft','active','completed','cancelled')),
  num_groups          INT DEFAULT 1,
  teams_per_group     INT,
  playoff_teams       INT DEFAULT 4,   -- top N from groups go to playoffs
  sets_per_match      INT DEFAULT 3,   -- 1, 3, or 5
  points_per_set      INT DEFAULT 21,
  court_ids           UUID[],          -- assigned courts
  start_date          DATE,
  end_date            DATE,
  description         TEXT,
  winner_team_id      UUID REFERENCES teams(id),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Tournament Teams (teams participating in a tournament)
CREATE TABLE tournament_teams (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  team_id       UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  group_name    VARCHAR(10),           -- e.g. 'A', 'B', 'C'
  seeding       INT,
  UNIQUE (tournament_id, team_id)
);

-- Rounds
CREATE TABLE rounds (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  round_number  INT NOT NULL,
  round_type    VARCHAR(30) NOT NULL CHECK (round_type IN (
    'league','group_stage','knockout',
    'quarterfinal','semifinal','final','third_place',
    'qualifier1','eliminator','qualifier2'
  )),
  group_name    VARCHAR(10),
  status        VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','active','completed')),
  scheduled_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Matches
CREATE TABLE matches (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id   UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  round_id        UUID NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  court_id        UUID REFERENCES courts(id),
  team1_id        UUID REFERENCES teams(id),
  team2_id        UUID REFERENCES teams(id),
  team1_score     INT DEFAULT 0,
  team2_score     INT DEFAULT 0,
  set_scores      JSONB DEFAULT '[]', -- [{t1:21,t2:15},{t1:18,t2:21},{t1:21,t2:19}]
  status          VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled','ongoing','completed','walkover')),
  winner_team_id  UUID REFERENCES teams(id),
  match_number    INT,
  scheduled_at    TIMESTAMPTZ,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Standings (materialized per tournament per group)
CREATE TABLE standings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id   UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  team_id         UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  group_name      VARCHAR(10),
  played          INT DEFAULT 0,
  won             INT DEFAULT 0,
  lost            INT DEFAULT 0,
  sets_for        INT DEFAULT 0,
  sets_against    INT DEFAULT 0,
  points_for      INT DEFAULT 0,
  points_against  INT DEFAULT 0,
  points          INT DEFAULT 0,   -- 2 per win
  rank            INT,
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tournament_id, team_id)
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_matches_tournament ON matches(tournament_id);
CREATE INDEX idx_matches_round ON matches(round_id);
CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_standings_tournament ON standings(tournament_id);
CREATE INDEX idx_tournament_teams_tournament ON tournament_teams(tournament_id);
CREATE INDEX idx_team_members_team ON team_members(team_id);
CREATE INDEX idx_team_members_player ON team_members(player_id);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_players_updated    BEFORE UPDATE ON players    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_courts_updated     BEFORE UPDATE ON courts     FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_teams_updated      BEFORE UPDATE ON teams      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_tournaments_updated BEFORE UPDATE ON tournaments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_matches_updated    BEFORE UPDATE ON matches    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- SEED DATA (Sample)
-- ============================================================
INSERT INTO courts (name, location, surface_type) VALUES
  ('Court 1', 'Main Hall', 'synthetic'),
  ('Court 2', 'Main Hall', 'synthetic'),
  ('Court 3', 'Annex', 'wooden'),
  ('Court 4', 'Annex', 'wooden');

INSERT INTO players (name, email, skill_level) VALUES
  ('Rahul Sharma',   'rahul@example.com',   'advanced'),
  ('Priya Patel',    'priya@example.com',   'intermediate'),
  ('Amit Kumar',     'amit@example.com',    'pro'),
  ('Sneha Reddy',    'sneha@example.com',   'advanced'),
  ('Vikram Singh',   'vikram@example.com',  'intermediate'),
  ('Ananya Gupta',   'ananya@example.com',  'beginner'),
  ('Kiran Joshi',    'kiran@example.com',   'advanced'),
  ('Deepak Nair',    'deepak@example.com',  'pro'),
  ('Meera Iyer',     'meera@example.com',   'intermediate'),
  ('Rohan Mehta',    'rohan@example.com',   'advanced'),
  ('Pooja Desai',    'pooja@example.com',   'intermediate'),
  ('Suresh Babu',    'suresh@example.com',  'pro');

INSERT INTO teams (name, color) VALUES
  ('Smash Kings',    '#EF4444'),
  ('Net Masters',    '#3B82F6'),
  ('Shuttle Hawks',  '#10B981'),
  ('Rally Force',    '#F59E0B'),
  ('Drop Shots',     '#8B5CF6'),
  ('Ace Strikers',   '#EC4899');
