-- Marblume support conversations (Cloudflare D1)
CREATE TABLE IF NOT EXISTS tickets (
  id TEXT PRIMARY KEY,            -- short public id, e.g. "K7P2QX"
  token TEXT NOT NULL,            -- secret the player needs to view/answer their conversation
  name TEXT, email TEXT, topic TEXT, platform TEXT, country TEXT,
  status TEXT NOT NULL DEFAULT 'open',   -- open | answered | closed
  unread_admin INTEGER NOT NULL DEFAULT 1,
  unread_user INTEGER NOT NULL DEFAULT 0,
  created TEXT NOT NULL, updated TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', first_reply TEXT
);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id TEXT NOT NULL,
  sender TEXT NOT NULL,           -- user | admin
  body TEXT NOT NULL,
  created TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_ticket ON messages(ticket_id, id);
CREATE INDEX IF NOT EXISTS idx_tickets_updated ON tickets(updated);

-- ---- admin tools (v1.5) ----
CREATE TABLE IF NOT EXISTS saved_replies (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, body TEXT NOT NULL, created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS faq (id INTEGER PRIMARY KEY AUTOINCREMENT, q TEXT NOT NULL, a TEXT NOT NULL, position INTEGER NOT NULL DEFAULT 0, published INTEGER NOT NULL DEFAULT 1, updated TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ideas (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, details TEXT, kind TEXT NOT NULL DEFAULT 'idea', status TEXT NOT NULL DEFAULT 'new', mentions INTEGER NOT NULL DEFAULT 1, ticket_id TEXT, created TEXT NOT NULL, updated TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS releases (id INTEGER PRIMARY KEY AUTOINCREMENT, version TEXT NOT NULL, platform TEXT NOT NULL, date TEXT NOT NULL, notes TEXT);
CREATE TABLE IF NOT EXISTS checklist (key TEXT PRIMARY KEY, done INTEGER NOT NULL DEFAULT 0, note TEXT, updated TEXT);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
-- Columns added to tickets in v1.5 (already applied to the live database; run once on an older copy):
-- ALTER TABLE tickets ADD COLUMN label TEXT NOT NULL DEFAULT '';
-- ALTER TABLE tickets ADD COLUMN notes TEXT NOT NULL DEFAULT '';
-- ALTER TABLE tickets ADD COLUMN first_reply TEXT;

-- ---- v1.6: anonymous game stats (only from players who tap "Share") and short surveys ----
-- players.id is a random code made by the app on the device. No names, emails, ad IDs or locations are stored.
CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY, platform TEXT, version TEXT, lang TEXT,
  first_seen TEXT NOT NULL, last_seen TEXT NOT NULL,
  unlocked INTEGER NOT NULL DEFAULT 0, stars INTEGER NOT NULL DEFAULT 0, best_streak INTEGER NOT NULL DEFAULT 0, relaxed INTEGER NOT NULL DEFAULT 0,
  plays INTEGER NOT NULL DEFAULT 0, wins INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS plays (
  id INTEGER PRIMARY KEY AUTOINCREMENT, player_id TEXT NOT NULL, level INTEGER NOT NULL, mode TEXT, won INTEGER, moves INTEGER, par INTEGER, stars INTEGER,
  hints INTEGER, tubes INTEGER, undos INTEGER, seconds INTEGER, relaxed INTEGER, frozen INTEGER, platform TEXT, version TEXT, created TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_plays_level ON plays(level);
CREATE INDEX IF NOT EXISTS idx_plays_player ON plays(player_id, id);
CREATE INDEX IF NOT EXISTS idx_plays_created ON plays(created);
CREATE INDEX IF NOT EXISTS idx_players_seen ON players(last_seen);
CREATE TABLE IF NOT EXISTS surveys (
  id INTEGER PRIMARY KEY AUTOINCREMENT, question TEXT NOT NULL, kind TEXT NOT NULL, options TEXT, comment INTEGER NOT NULL DEFAULT 1,
  active INTEGER NOT NULL DEFAULT 0, created TEXT NOT NULL, closed TEXT
);
CREATE TABLE IF NOT EXISTS survey_answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT, survey_id INTEGER NOT NULL, answer TEXT, rating INTEGER, comment TEXT,
  player_id TEXT, platform TEXT, version TEXT, lang TEXT, created TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_answers_survey ON survey_answers(survey_id, id);
CREATE INDEX IF NOT EXISTS idx_answers_player ON survey_answers(player_id);
