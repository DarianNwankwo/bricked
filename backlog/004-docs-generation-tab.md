# 004: Documentation Generation Tab

**Priority:** Medium
**Status:** Not Started
**Affects:** WorkspaceView (Docs tab)

## Problem

The Docs tab in the workspace is a placeholder. It currently renders:
```html
<div className="empty-state">
  <iconify-icon icon="solar:document-text-linear" width={40} />
  <p>Documentation will be generated alongside your code.</p>
</div>
```

The backend has documentation infrastructure — the `docs-agent.ts` exists, and `ProjectSession` stores a `documentation` field — but nothing is wired to the UI.

## Backend Infrastructure (Already Exists)

### Docs Agent (`src/agent/docs-agent.ts`)
- Extends `BaseAgent`
- Has a `generateDocs()` method that reads BAC and generates markdown documentation
- Uses LLM to produce: README, API docs, architecture overview, setup guide
- Returns structured documentation blocks

### Session Storage
- `ProjectSession.currentProject.documentation` stores generated docs
- `saveCurrentProject()` includes documentation in the saved project

### Queue Integration
- `POST /api/queue/docs/generate` dispatches a background docs generation job
- Worker processor exists but may need verification

## Implementation Approach

### Docs Viewer Component
Create `frontend/src/components/workspace/DocsPanel.tsx`:
- Render markdown content using `react-markdown` (already a dependency)
- Tab sub-navigation: README, API Reference, Architecture, Setup Guide
- "Generate Docs" button that triggers docs generation
- Loading state during generation
- Edit mode to manually modify generated docs

### API Wiring
1. Add `getDocs()` method to API client → `GET /api/docs` (may need new route)
2. Add `generateDocs()` method → `POST /api/docs/generate` or use the queue route
3. Add `updateDocs()` method → `PUT /api/docs` for manual edits

### Backend Route (if needed)
If `/api/docs` doesn't exist, create it:
```
GET  /api/docs              → Returns session.currentProject.documentation
POST /api/docs/generate     → Triggers docs generation (sync or via queue)
PUT  /api/docs              → Manual doc edits
```

### Streaming Support
Documentation generation could be streamed (SSE) like code generation, showing sections as they're generated. The queue/events SSE endpoint already exists.

## Files to Create/Modify

| File | Change |
|------|--------|
| `frontend/src/components/workspace/DocsPanel.tsx` | New — markdown viewer/editor |
| `frontend/src/components/workspace/DocsPanel.css` | New — styling |
| `frontend/src/components/workspace/WorkspaceView.tsx` | Replace placeholder with DocsPanel |
| `frontend/src/api/client.ts` | Add docs API methods |
| `src/server/routes/` | Add docs route if not exists |

## Acceptance Criteria

- [ ] Docs tab shows generated documentation (not placeholder)
- [ ] "Generate Docs" button triggers documentation generation
- [ ] Generated docs render as formatted markdown
- [ ] Docs include: README, API reference, architecture overview
- [ ] Docs update when architecture changes (re-generate)
- [ ] Manual edits to docs persist
