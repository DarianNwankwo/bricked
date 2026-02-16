# 006: Multi-User Session Isolation

**Priority:** High
**Status:** Not Started
**Affects:** SessionManager, all routes using sessions

## Problem

The `SessionManager` is a single global instance stored in `app.locals.sessionManager`. It has one "active" session and a Map of sessions keyed by project ID — but no user isolation.

### Current code:
```typescript
// SessionManager.ts
class SessionManager {
  private active: ProjectSession;
  private sessions: Map<string, ProjectSession> = new Map();

  getSession(projectId?: string): ProjectSession {
    if (!projectId) return this.active;  // ← Global singleton
    // No userId parameter, no access control
  }
}
```

### What goes wrong:
- User A opens Project X → session created for project X
- User B opens Project Y on the same server → creates session for Y
- Both users call `getSession()` without projectId → both get the SAME `active` session
- User A's architecture edits may be visible to User B
- Race conditions: concurrent requests from different users can corrupt shared session state

### The auth layer (JWT) correctly identifies users, but the session layer ignores user identity entirely.

## Implementation Approach

### Phase 1: User-Scoped Sessions
Change the session key from `projectId` to `userId:projectId`:

```typescript
class SessionManager {
  private sessions: Map<string, ProjectSession> = new Map();

  getSession(userId: string, projectId: string): ProjectSession {
    const key = `${userId}:${projectId}`;
    if (!this.sessions.has(key)) {
      this.sessions.set(key, new ProjectSession());
    }
    return this.sessions.get(key)!;
  }
}
```

### Phase 2: Update All Routes
Every route that calls `getSessionManager(req)` needs to also pass `req.userId`:
```typescript
// Before
const session = sm.getSession(projectId);

// After
const session = sm.getSession(req.userId!, projectId);
```

### Phase 3: Session Cleanup
- Add TTL-based eviction (sessions idle >30 min get cleaned up)
- Or use Redis-backed sessions for horizontal scaling

### Phase 4: Permission Enforcement
Currently the project routes check ownership via `db.getProjectsByUser()`. The session layer should similarly verify that the user has access to the project before creating a session.

## Files to Modify

| File | Change |
|------|--------|
| `src/server/state/SessionManager.ts` | Add userId to session key, remove global active |
| `src/server/routes/architecture.ts` | Pass userId to getSession |
| `src/server/routes/bac.ts` | Pass userId to getSession |
| `src/server/routes/chat.ts` | Pass userId to getSession |
| `src/server/routes/codegen.ts` | Pass userId to getSession |
| `src/server/routes/settings.ts` | Pass userId to getSession |
| `src/server/routes/agent.ts` | Pass userId to getSession |
| All route files using `getSessionManager` | Same pattern update |

## Acceptance Criteria

- [ ] Two users editing different projects don't see each other's architecture
- [ ] Two users editing the SAME project get separate sessions (or a shared collaborative session — TBD)
- [ ] No global "active" session singleton
- [ ] Session key includes user identity
- [ ] Idle sessions are cleaned up after 30 minutes
