# 002: Unified Project Save/Load System

**Priority:** Critical
**Status:** Not Started
**Affects:** Dashboard, Workspace, Project lifecycle

## Problem

Two conflicting project systems exist:

### System 1: Database Projects (new)
```
GET    /api/projects          → List from PostgreSQL
POST   /api/projects          → Create in PostgreSQL
GET    /api/projects/:id      → Get from PostgreSQL
PATCH  /api/projects/:id      → Update in PostgreSQL
DELETE /api/projects/:id      → Delete from PostgreSQL
```

### System 2: In-Memory Studio Projects (legacy)
```
GET    /api/settings/projects          → List from SessionManager.savedProjects Map
POST   /api/settings/save              → Save to SessionManager.savedProjects Map
POST   /api/settings/load/:id          → Load from SessionManager.savedProjects Map
DELETE /api/settings/project/:id       → Delete from SessionManager.savedProjects Map
```

### The conflict:
- **Dashboard** shows projects from the database (`/api/projects`)
- **Workspace** reads/writes architecture from the in-memory session (via `/api/architecture`, `/api/component-specs`, etc.)
- **Save** goes to the in-memory `savedProjects` Map (System 2), NOT the database
- **Load** restores from in-memory Map, not the database
- Data diverges: dashboard shows one name, workspace shows another

## Current Behavior

1. User creates project → DB record created with empty architecture
2. User loads template, designs architecture → session updated (in-memory)
3. User navigates to dashboard → sees project from DB (empty architecture)
4. User clicks project → session may or may not have their work (depends on server state)
5. Server restart → all session work lost, DB still has empty architecture

## Expected Behavior

1. User creates project → DB record created
2. User loads template, designs architecture → session updated AND DB synced
3. User navigates to dashboard → sees project from DB with real architecture data
4. User clicks project → session populated from DB (always has latest data)
5. Server restart → DB has full architecture, session rebuilds from DB on next load

## Implementation Approach

### Phase 1: Eliminate System 2
- Remove `/api/settings/projects`, `/api/settings/save`, `/api/settings/load/:id`, `/api/settings/project/:id` routes
- Remove `SessionManager.savedProjects` Map
- Remove `ProjectSession.saveCurrentProject()` and `loadFromSavedProject()` methods
- Update any frontend code that calls these legacy routes

### Phase 2: Load Session from DB
When user opens a workspace (`/workspace/:projectId`):
1. Frontend calls `GET /api/projects/:id` to get DB project
2. Backend populates the session from the DB project data (architecture, specs, BAC)
3. If session already exists for this project, use it (hot cache)

### Phase 3: Sync Session to DB
Tie into the auto-sync from backlog item 001 — every session mutation schedules a DB write.

## Files to Modify

| File | Change |
|------|--------|
| `src/server/routes/settings.ts` | Remove legacy save/load routes |
| `src/server/state/SessionManager.ts` | Remove `savedProjects` Map |
| `src/server/state/ProjectSession.ts` | Remove `saveCurrentProject()`, `loadFromSavedProject()` |
| `frontend/src/api/client.ts` | Remove `getSavedProjects`, `saveProject`, `loadProject`, `deleteProject` from studio object |
| `frontend/src/components/workspace/WorkspaceView.tsx` | Load project from DB on mount, remove legacy save logic |

## Acceptance Criteria

- [ ] Only one project system exists (database-backed)
- [ ] Opening a project always loads architecture from DB
- [ ] No data divergence between dashboard and workspace
- [ ] Legacy studio save/load routes removed
- [ ] All project data roundtrips through PostgreSQL
