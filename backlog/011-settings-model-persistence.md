# 011: LLM Model Selection Persistence

**Priority:** Low
**Status:** Not Started
**Affects:** SettingsView, LLM client

## Problem

When a user selects an LLM model in Settings, it's stored in the session (`session.selectedModel`) but NOT written to the database. Opening a new browser tab or restarting the server reverts to the default model.

### Current flow:
1. User selects model in Settings → `POST /api/model` → sets `session.selectedModel`
2. LLM calls use `session.selectedModel` → works within the session
3. Server restart → model reverts to default
4. New tab → no model preference loaded

### Backend has the infrastructure:
- `user_preferences` table exists with theme, custom icons, etc.
- Preferences routes exist (`src/server/routes/preferences.ts`)
- But `selectedModel` is not included in preferences

## Implementation

### Simple Fix
Add `preferred_model` to user preferences:

1. Add column: `ALTER TABLE user_preferences ADD COLUMN preferred_model TEXT;`
2. In `POST /api/model`: also write to `user_preferences.preferred_model`
3. On session init: read `preferred_model` from DB and set as default

### Alternative: Per-Project Model Selection
Store model choice per project instead of per user. Some projects might use cheaper models (Haiku) while others need powerful ones (Opus).

## Files to Modify

| File | Change |
|------|--------|
| `src/server/db/migrations/` | Add preferred_model column |
| `src/server/routes/settings.ts` | Write model to preferences on change |
| `src/server/state/ProjectSession.ts` | Load preferred model from DB on init |

## Acceptance Criteria

- [ ] Model selection persists across page reloads
- [ ] Model selection persists across server restarts
- [ ] New tabs use the user's preferred model
