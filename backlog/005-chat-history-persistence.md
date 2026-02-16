# 005: Chat History Persistence

**Priority:** Medium
**Status:** Not Started
**Affects:** ChatPanel, WorkspaceView

## Problem

Chat messages are stored in React component state (`useState<ChatMessage[]>`) in `WorkspaceView.tsx`. The session also stores conversation history (`session.currentProject.conversationHistory`), but this is in-memory and not written to the database.

### Current behavior:
- User sends message → stored in React state + session memory
- Refreshing the page → all messages lost from UI
- Server restart → all messages lost from session
- Opening the same project in a new tab → no chat history

### What works:
- The LLM does receive conversation history during the session (via `session.currentProject.conversationHistory`), so follow-up messages have context within a single session
- Chat streaming works end-to-end via `streamGenerate()`

## Implementation Approach

### Option A: Store in Project (Recommended)
Add a `chat_history JSONB` column to the `projects` table. Sync chat messages alongside architecture data.

Pros: Simple, tied to project lifecycle, no new table needed.
Cons: JSONB column could grow large for long conversations.

### Option B: Separate Messages Table
```sql
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  role TEXT NOT NULL,   -- 'user' | 'assistant' | 'system'
  content TEXT NOT NULL,
  metadata JSONB,       -- diagram, cost, etc.
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_messages_project ON messages(project_id);
```

Pros: Better for querying, pagination, large histories.
Cons: More infrastructure.

### Frontend Changes
1. Load chat history when workspace mounts (from DB via API)
2. After each message exchange, persist to DB
3. Show "Loading conversation..." state while fetching history

### API
```
GET  /api/projects/:projectId/messages        → Paginated message list
POST /api/projects/:projectId/messages         → Append message
DELETE /api/projects/:projectId/messages        → Clear history
```

## Files to Modify

| File | Change |
|------|--------|
| `src/server/db/migrations/` | New migration (if using messages table) |
| `src/server/db/client.ts` | Add message persistence methods |
| `src/server/routes/chat.ts` | Persist messages after streaming |
| `frontend/src/api/client.ts` | Add message API methods |
| `frontend/src/components/workspace/WorkspaceView.tsx` | Load messages on mount, persist on send |

## Acceptance Criteria

- [ ] Chat history loads when opening a project
- [ ] New messages persist immediately after sending/receiving
- [ ] Refreshing the page shows previous conversation
- [ ] LLM context includes persisted history (not just current session)
- [ ] Chat history is scoped to a project
