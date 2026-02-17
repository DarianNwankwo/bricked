/**
 * SessionManager — manages ProjectSession instances.
 *
 * Sessions are keyed by a composite string (typically "userId:projectId" for
 * authenticated users, or just "projectId" for unauthenticated fallback).
 * This ensures multiple users editing the same project get isolated sessions.
 */

import { ProjectSession } from './ProjectSession.js';

export class SessionManager {
  private sessions: Map<string, ProjectSession> = new Map();
  private active: ProjectSession = new ProjectSession();

  /**
   * Get or create a session for a given key.
   * @param sessionKey - Composite key (e.g. "userId:projectId" or "projectId")
   * @param projectId - The actual project ID to set on new sessions (defaults to sessionKey)
   * Returns the active session if no key is provided.
   */
  getSession(sessionKey?: string, projectId?: string): ProjectSession {
    if (!sessionKey) return this.active;
    let session = this.sessions.get(sessionKey);
    if (!session) {
      session = new ProjectSession();
      session.currentProjectId = projectId || sessionKey;
      this.sessions.set(sessionKey, session);
    }
    return session;
  }

  /**
   * Create a fresh session for a project.
   * @param sessionKey - Composite key (e.g. "userId:projectId" or "projectId")
   * @param projectId - The actual project ID (defaults to sessionKey)
   */
  createSession(sessionKey: string, projectId?: string): ProjectSession {
    const session = new ProjectSession();
    session.currentProjectId = projectId || sessionKey;
    this.sessions.set(sessionKey, session);
    return session;
  }

  /**
   * Remove a session (e.g. when a project is deleted).
   */
  deleteSession(sessionKey: string): void {
    this.sessions.delete(sessionKey);
  }

  /**
   * Get the current active session (backward compat).
   */
  getActiveSession(): ProjectSession {
    return this.active;
  }

  /**
   * Promote a project session to the active session.
   * @param sessionKey - Composite key (e.g. "userId:projectId" or "projectId")
   * @param projectId - The actual project ID (defaults to sessionKey)
   */
  setActiveSession(sessionKey: string, projectId?: string): ProjectSession {
    const session = this.getSession(sessionKey, projectId);
    this.active = session;
    return session;
  }
}
