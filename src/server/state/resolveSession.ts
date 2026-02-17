/**
 * resolveSession — resolves the correct ProjectSession from a request.
 *
 * Uses the X-Project-Id header and userId (from auth middleware) to look up
 * or create a user+project-scoped session. This ensures multiple users
 * editing the same project get isolated sessions.
 *
 * Falls back to the global active session for backward compatibility.
 */

import type { Request } from 'express';
import type { SessionManager } from './SessionManager.js';
import type { ProjectSession } from './ProjectSession.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

export function getSessionManager(req: Request): SessionManager {
  return req.app.locals.sessionManager as SessionManager;
}

/**
 * Resolve the ProjectSession for the current request.
 *
 * Precedence:
 * 1. userId + X-Project-Id → session keyed by "userId:projectId" (multi-user safe)
 * 2. X-Project-Id only → session keyed by projectId (unauthenticated fallback)
 * 3. Fall back to the global active session
 */
export function resolveSession(req: Request): ProjectSession {
  const sm = getSessionManager(req);
  const projectId = req.headers['x-project-id'] as string | undefined;
  const userId = (req as AuthenticatedRequest).userId;

  if (projectId) {
    // Key by userId:projectId when authenticated for multi-user isolation
    const sessionKey = userId ? `${userId}:${projectId}` : projectId;
    return sm.getSession(sessionKey, projectId);
  }
  return sm.getActiveSession();
}
