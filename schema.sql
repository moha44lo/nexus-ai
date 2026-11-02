CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY, title TEXT NOT NULL DEFAULT 'Neuer Chat', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL, created_at TEXT NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at DESC);

-- Semantic memory: only explicit user-approved facts are stored.
CREATE TABLE IF NOT EXISTS memory_facts (
  id TEXT PRIMARY KEY, fact TEXT NOT NULL, category TEXT NOT NULL DEFAULT 'general',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_memory_facts_category ON memory_facts(category);

-- Episodic memory and step-level audit history.
CREATE TABLE IF NOT EXISTS agent_runs (
  id TEXT PRIMARY KEY, conversation_id TEXT, task TEXT NOT NULL, goal TEXT, plan_json TEXT NOT NULL,
  status TEXT NOT NULL, summary TEXT, result_json TEXT, error TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_agent_runs_created ON agent_runs(created_at DESC);
CREATE TABLE IF NOT EXISTS agent_run_steps (
  id TEXT PRIMARY KEY, run_id TEXT NOT NULL, step_id TEXT, tool TEXT, status TEXT NOT NULL,
  detail_json TEXT, created_at TEXT NOT NULL,
  FOREIGN KEY (run_id) REFERENCES agent_runs(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_agent_steps_run ON agent_run_steps(run_id, created_at);

-- Procedural memory: reusable workflows.
CREATE TABLE IF NOT EXISTS skills (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL, version TEXT NOT NULL,
  definition_json TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, run_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
-- Schedule definitions; a cron trigger can execute due tasks.
CREATE TABLE IF NOT EXISTS schedules (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, task TEXT NOT NULL, cron TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Europe/Zurich', interval_minutes INTEGER NOT NULL DEFAULT 60, enabled INTEGER NOT NULL DEFAULT 1,
  next_run_at TEXT, last_run_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

-- Login abuse protection: only a one-way hash of the client IP is stored.
CREATE TABLE IF NOT EXISTS login_attempts (
  ip_hash TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0,
  window_started_at TEXT NOT NULL,
  blocked_until TEXT,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_login_attempts_updated ON login_attempts(updated_at);

-- Social autopilot: AI-generated content packages and a human-reviewed publishing queue.
CREATE TABLE IF NOT EXISTS social_posts (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL CHECK (platform IN ('tiktok', 'instagram', 'youtube')),
  niche TEXT NOT NULL,
  objective TEXT NOT NULL DEFAULT 'growth',
  language TEXT NOT NULL DEFAULT 'de',
  title TEXT NOT NULL,
  hook TEXT NOT NULL,
  script TEXT NOT NULL,
  scenes_json TEXT NOT NULL DEFAULT '[]',
  caption TEXT NOT NULL,
  hashtags_json TEXT NOT NULL DEFAULT '[]',
  cta TEXT NOT NULL DEFAULT '',
  cover_text TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'queued', 'published', 'failed')),
  scheduled_for TEXT,
  published_at TEXT,
  provider_post_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  video_url TEXT,
  video_status TEXT,
  video_duration INTEGER,
  video_prompt TEXT,
  video_storage_key TEXT,
  video_bytes INTEGER,
  privacy_level TEXT DEFAULT 'SELF_ONLY',
  publish_status TEXT,
  publish_error TEXT,
  provider_video_id TEXT,
  published_url TEXT,
  approved_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_social_posts_status_created ON social_posts(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_posts_platform ON social_posts(platform, created_at DESC);

CREATE TABLE IF NOT EXISTS social_accounts (
  platform TEXT PRIMARY KEY, open_id TEXT NOT NULL, username TEXT, display_name TEXT,
  access_token_encrypted TEXT NOT NULL, refresh_token_encrypted TEXT NOT NULL,
  access_expires_at TEXT, refresh_expires_at TEXT, scope TEXT,
  privacy_options_json TEXT DEFAULT '[]', creator_info_json TEXT,
  connected_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS social_oauth_states (
  state TEXT PRIMARY KEY, expires_at TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS social_analytics (
  video_id TEXT PRIMARY KEY, title TEXT NOT NULL DEFAULT '', views INTEGER NOT NULL DEFAULT 0,
  likes INTEGER NOT NULL DEFAULT 0, comments INTEGER NOT NULL DEFAULT 0, shares INTEGER NOT NULL DEFAULT 0,
  video_created_at TEXT, fetched_at TEXT NOT NULL
);
