# 008: GitHub Integration

**Priority:** Low
**Status:** Partially Started
**Affects:** SettingsView, deployment pipeline

## Problem

The Settings page has a "Connect GitHub" button, and the backend has a full GitHub OAuth route file (`src/server/routes/github.ts`) with OAuth flow, repo listing, and file pushing. However, the frontend only opens an OAuth popup — there is no callback handler, no token storage in the UI, and no GitHub-connected features exposed in the workspace.

## Backend (Already Exists)

### Routes in `src/server/routes/github.ts`:
- `GET /api/github/auth` — Redirects to GitHub OAuth
- `GET /api/github/callback` — Handles OAuth callback, stores token
- `GET /api/github/repos` — Lists user's repositories
- `GET /api/github/repos/:owner/:repo/branches` — Lists branches
- `POST /api/github/push` — Pushes generated files to a repo/branch
- `GET /api/github/status` — Returns connection status

### What's missing:
- CSRF state is stored in an in-memory Map (should use Redis)
- OAuth callback URL needs to be configured per environment
- `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` env vars needed

## Frontend Gaps

### Settings Page
- Button opens OAuth but no callback handling
- No display of connected GitHub account
- No disconnect button

### Workspace Integration
- No "Push to GitHub" button in the code editor
- No repo/branch selector
- No commit message input
- No push status/progress feedback

## Implementation Approach

### Phase 1: Complete OAuth Flow
1. Settings page opens GitHub OAuth in popup
2. Callback page closes popup and notifies parent window
3. Settings page shows connected account name
4. Disconnect button clears GitHub token

### Phase 2: Push to GitHub
Add a "Push to GitHub" action in the Code tab:
1. User clicks "Push to GitHub"
2. Modal shows: repo selector (from `GET /api/github/repos`), branch selector, commit message
3. Confirm → `POST /api/github/push` with selected repo, branch, and generated files
4. Show success/error feedback

### Phase 3: Pull from GitHub (future)
Import existing project files from a GitHub repo to seed the architecture.

## Environment Variables Needed

| Variable | Description |
|----------|-------------|
| `GITHUB_CLIENT_ID` | GitHub OAuth App client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App client secret |
| `GITHUB_CALLBACK_URL` | OAuth redirect URL (e.g., `http://localhost:3333/api/github/callback`) |

## Files to Modify

| File | Change |
|------|--------|
| `frontend/src/components/settings/SettingsView.tsx` | Complete OAuth flow, show connected account |
| `frontend/src/components/workspace/CodeEditor.tsx` | Add "Push to GitHub" button |
| `frontend/src/api/client.ts` | Add GitHub API methods (repos, push, status) |
| `src/server/routes/github.ts` | Move CSRF state to Redis, verify callback URL handling |
| `docker-compose.yml` | Add GitHub env vars |

## Acceptance Criteria

- [ ] Users can connect their GitHub account via OAuth
- [ ] Connected account displayed in settings with disconnect option
- [ ] Users can push generated code to a selected repo/branch
- [ ] Push shows progress and success/error feedback
- [ ] OAuth tokens stored securely (not in-memory Map in production)
