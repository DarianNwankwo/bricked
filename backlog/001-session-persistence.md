# 001: Session-to-Database Persistence

**Priority:** Critical
**Status:** Not Started
**Affects:** Architecture, Component Specs, BAC, Chat History

## Problem

All architecture design work lives exclusively in the in-memory `ProjectSession` class (`src/server/state/ProjectSession.ts`). Nothing is automatically written to the PostgreSQL database when a user modifies their architecture. If the server restarts, all active work is lost.

### What's in-memory only (lost on restart):
- `session.manualArchitecture` — all nodes, connections, positions
- `session.currentProject.componentSpecs` — descriptions, input/output contracts, notes
- `session.currentProject.bac` — the entire Brick App Contract
- `session.currentProject.conversationHistory` — chat messages
- `session.currentProject.files` — all generated code files

### What IS in the database:
- `projects.architecture` column (JSONB) — exists but is only written at project creation with `{"components":[],"connections":[]}` and never updated during editing
- `projects.component_specs` column (JSONB) — column exists in the migration schema but no route ever writes to it

## Current Data Flow

```
User edits component in canvas
  → Frontend calls PUT /api/component
  → Backend updates session.manualArchitecture (in-memory)
  → Backend returns updated architecture to frontend
  → STOP — no database write happens
```

## Expected Data Flow

```
User edits component in canvas
  → Frontend calls PUT /api/component
  → Backend updates session.manualArchitecture (in-memory)
  → Backend debounced-writes architecture to projects table (database)
  → Backend returns updated architecture to frontend
```

## Implementation Approach

### Option A: Debounced Auto-Sync (Recommended)
After any mutation to the session (add/update/delete component, connection, spec), schedule a debounced write (2-3 seconds) to the database:

```typescript
// In ProjectSession or a new SyncService
private syncTimer: NodeJS.Timeout | null = null;

scheduleSync(db: DatabaseClient, projectId: string) {
  if (this.syncTimer) clearTimeout(this.syncTimer);
  this.syncTimer = setTimeout(async () => {
    await db.updateProject(projectId, {
      architecture: this.manualArchitecture,
      componentSpecs: Object.fromEntries(this.currentProject.componentSpecs),
      bac: this.currentProject.bac,
    });
  }, 2000);
}
```

### Option B: Save-on-Navigate
Write to DB when the user navigates away from the workspace (back to dashboard, close tab). Less ideal because crashes still lose data.

### Option C: Hybrid
Auto-sync critical data (architecture, specs) on every change. Chat history and files sync less frequently or on explicit save.

## Files to Modify

| File | Change |
|------|--------|
| `src/server/state/ProjectSession.ts` | Add `scheduleSync()` method and DB reference |
| `src/server/routes/architecture.ts` | Call `scheduleSync()` after every mutation |
| `src/server/routes/codegen.ts` | Call `scheduleSync()` after code generation |
| `src/server/routes/bac.ts` | Call `scheduleSync()` after BAC updates |
| `src/server/routes/settings.ts` | Call `scheduleSync()` on spec updates |
| `src/server/db/client.ts` | Ensure `updateProject()` accepts architecture, specs, BAC fields |
| `src/server/db/postgres-client.ts` | Implement the SQL for updating JSONB columns |

## Database Schema Changes

The `projects` table already has `architecture JSONB`. Need to verify and potentially add:
- `component_specs JSONB` (may already exist in migration)
- `bac JSONB`
- `conversation_history JSONB` (optional, lower priority)

## Acceptance Criteria

- [ ] Modifying architecture in the canvas persists to DB within 3 seconds
- [ ] Filling in component specs persists to DB within 3 seconds
- [ ] BAC is synced to DB after any architecture/spec change
- [ ] Server restart preserves all architecture work
- [ ] Loading a project from the dashboard restores full session state from DB
- [ ] No noticeable UI lag from sync operations (must be async/non-blocking)
