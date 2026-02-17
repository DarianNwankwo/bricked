# 014: Supabase Real-Time Integration

**Priority:** High
**Status:** Not Started
**Affects:** Feature board, agent system, all real-time UI updates

## Problem

The app currently uses SSE (Server-Sent Events) for streaming LLM responses and code generation, and has no real-time push mechanism for other state changes. When an agent moves a feature or updates its status, the UI has no way to know without polling.

## Requirements

### Supabase Setup
- Add @supabase/supabase-js to frontend dependencies
- Add Supabase configuration (SUPABASE_URL, SUPABASE_ANON_KEY env vars)
- For local development: Supabase Cloud free tier or supabase CLI local stack
- For production: hosted Supabase project

### Real-Time Channels
1. **Feature Board Channel** (per-project):
   - Feature status changes (agent moved feature to new column)
   - Agent status updates (planning → building → testing)
   - New features added by other users
   - Feature edits/deletes

2. **Agent Progress Channel** (per-project):
   - Agent started working on a feature
   - Agent progress percentage
   - Agent completed or errored
   - Agent requesting more context

3. **Architecture Channel** (per-project, future):
   - Real-time collaborative editing
   - Node/edge changes from other users

### Backend Integration
- When agent updates a feature status, publish to Supabase channel
- Use Supabase Postgres triggers OR application-level publish
- Backend writes to features table → Supabase detects change → pushes to subscribers

### Frontend Integration
- Subscribe to project-specific channels on workspace mount
- Unsubscribe on unmount
- Update React state from Supabase events
- Optimistic UI: update locally first, then confirm from server

## Environment Variables

| Variable | Description |
|----------|-------------|
| SUPABASE_URL | Supabase project URL |
| SUPABASE_ANON_KEY | Supabase anonymous/public key |
| SUPABASE_SERVICE_KEY | Supabase service role key (backend only) |

## Acceptance Criteria

- [ ] Supabase client configured in frontend
- [ ] Feature board subscribes to real-time channel
- [ ] Agent status updates appear in real time
- [ ] Multiple browser tabs see same feature board state
- [ ] Clean subscription lifecycle (subscribe on mount, unsubscribe on unmount)
