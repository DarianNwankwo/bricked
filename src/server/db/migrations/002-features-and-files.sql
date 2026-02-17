-- 002-features-and-files.sql — Features, messages, and project files

-- Features table for the Kanban board
CREATE TABLE IF NOT EXISTS features (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'backlog'
    CHECK (status IN ('backlog', 'in_progress', 'review', 'deployed')),
  agent_status TEXT
    CHECK (agent_status IN ('waiting', 'needs_context', 'planning', 'building', 'testing', 'complete', 'error', NULL)),
  agent_message TEXT,
  position INTEGER DEFAULT 0,
  timer_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_features_project ON features(project_id);

-- Messages table for chat history persistence
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  context_mode TEXT DEFAULT 'architecture'
    CHECK (context_mode IN ('architecture', 'code', 'docs')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_messages_project ON messages(project_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);

-- Project files table for generated code persistence
CREATE TABLE IF NOT EXISTS project_files (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  component_id TEXT,
  is_manually_edited BOOLEAN DEFAULT FALSE,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, path)
);
CREATE INDEX IF NOT EXISTS idx_project_files_project ON project_files(project_id);

-- Add preferred_model to user_preferences
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS preferred_model TEXT;
