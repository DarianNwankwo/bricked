# 003: Feature Board Backend Persistence

**Priority:** Medium
**Status:** Not Started
**Affects:** FeatureBoard, WorkspaceView

## Problem

The Kanban/feature board UI (`FeatureBoard.tsx`) is fully functional with drag-and-drop via `@dnd-kit`, four columns (Backlog, In Progress, Review, Deployed), and feature cards. However, all state is purely React component state in `WorkspaceView.tsx` — there is no backend persistence.

### Current behavior:
- Adding a feature stores it in `useState<Feature[]>` in WorkspaceView
- Dragging a feature between columns updates React state only
- Refreshing the page loses all features
- Features are not shared between users
- No API calls are made from the feature board

### Relevant code:
```typescript
// WorkspaceView.tsx
const [features, setFeatures] = useState<Feature[]>([]);

const handleAddFeature = useCallback((title: string, description: string) => {
  const newFeature: Feature = {
    id: crypto.randomUUID(),
    title,
    description,
    status: 'backlog',
    projectId: projectId || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  setFeatures(prev => [...prev, newFeature]);
  // ← No API call, no persistence
}, [projectId]);
```

## Implementation Approach

### Database Schema
Add a `features` table:
```sql
CREATE TABLE IF NOT EXISTS features (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'backlog',
  position INTEGER DEFAULT 0,
  agent_status TEXT,
  agent_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_features_project ON features(project_id);
```

### API Routes
Add to `src/server/routes/` (new file `features.ts` or extend existing):
```
GET    /api/projects/:projectId/features           → List features for project
POST   /api/projects/:projectId/features           → Create feature
PATCH  /api/projects/:projectId/features/:id        → Update feature (status, title, description, position)
DELETE /api/projects/:projectId/features/:id        → Delete feature
PATCH  /api/projects/:projectId/features/reorder    → Bulk reorder within a column
```

### Frontend Changes
- Add API client methods for features
- Load features on workspace mount
- Call API on add, move, edit, delete

### Agent Integration (future)
The Feature type already has `agentStatus` and `agentMessage` fields. Eventually features could trigger agent workflows:
- Moving to "In Progress" could kick off a BAC agent to plan the feature
- Agent updates `agentStatus` as it works
- Moving to "Review" could trigger test generation

## Files to Modify

| File | Change |
|------|--------|
| `src/server/db/migrations/` | New migration for features table |
| `src/server/db/client.ts` | Add feature CRUD methods to DatabaseClient interface |
| `src/server/db/postgres-client.ts` | Implement feature queries |
| `src/server/routes/features.ts` | New route file with feature CRUD |
| `src/server/index.ts` | Mount features router |
| `frontend/src/api/client.ts` | Add feature API methods |
| `frontend/src/api/types.ts` | Feature type already exists |
| `frontend/src/components/workspace/WorkspaceView.tsx` | Wire features to API |
| `frontend/src/components/workspace/FeatureBoard.tsx` | Call handlers that hit API |

## Acceptance Criteria

- [ ] Features persist across page reloads
- [ ] Features persist across server restarts
- [ ] Features are scoped to a project
- [ ] Drag-and-drop status changes persist
- [ ] Features load when opening a workspace
- [ ] Delete feature works with persistence
