# 009: Generated File Persistence

**Priority:** High
**Status:** Not Started
**Affects:** Code generation, Code editor, Deploy pipeline

## Problem

Generated code files exist in three disconnected locations with no unified persistence:

### Location 1: In-Memory Session
`session.currentProject.files` — a `Map<string, ProjectFile>` that holds all generated files during a session. This is the source for the Code Editor UI. Lost on server restart.

### Location 2: Disk Stash
`stashArtifacts()` in `src/server/services/artifacts.ts` writes files to `data/artifacts/{slug}/`. This only happens IF:
- The project was explicitly saved with a slug
- Code generation completed successfully
- The session has a `currentProjectId` that maps to a saved project

### Location 3: Database
No file storage exists in the database. The `projects` table has no `files` or `artifacts` column.

### What goes wrong:
1. User generates code → files in session memory
2. User refreshes page → files gone from UI
3. User didn't "save project" → files not stashed to disk either
4. Server restart → files lost everywhere
5. Deploy pipeline needs files → can't find them

## Implementation Approach

### Option A: Store in Database (Recommended for MVP)
Add a `project_files` table:
```sql
CREATE TABLE IF NOT EXISTS project_files (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  content TEXT NOT NULL,
  component_id TEXT,
  is_manually_edited BOOLEAN DEFAULT FALSE,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, path)
);
CREATE INDEX idx_project_files_project ON project_files(project_id);
```

### Option B: Store as JSONB in Projects Table
Simpler but less queryable. Add a `files JSONB` column to the `projects` table.

### Sync Strategy
1. After code generation completes, write all generated files to DB
2. When user edits a file in Monaco, write the edit to DB (debounced)
3. When loading a workspace, populate session files from DB
4. Keep disk stash as a secondary backup for Docker preview

### API Changes
```
GET  /api/projects/:id/files           → List files from DB
GET  /api/projects/:id/files/:path     → Get file content from DB
PUT  /api/projects/:id/files/:path     → Update file content in DB
```

(These partially overlap with existing `/api/file` and `/api/files` routes which read from the session.)

## Files to Modify

| File | Change |
|------|--------|
| `src/server/db/migrations/` | New migration for project_files table |
| `src/server/db/client.ts` | Add file CRUD methods |
| `src/server/db/postgres-client.ts` | Implement file queries |
| `src/server/routes/codegen.ts` | Write generated files to DB after generation |
| `src/server/routes/architecture.ts` | Load files from DB into session on workspace open |
| `frontend/src/components/workspace/WorkspaceView.tsx` | Load files from DB if session is empty |

## Acceptance Criteria

- [ ] Generated code persists across page reloads
- [ ] Generated code persists across server restarts
- [ ] Manual edits to code persist
- [ ] Files load when opening a project workspace
- [ ] Deploy pipeline can access generated files from DB
- [ ] File list shown in code editor tab is always up to date
