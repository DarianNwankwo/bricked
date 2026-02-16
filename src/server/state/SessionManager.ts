/**
 * SessionManager — manages ProjectSession instances by project ID.
 *
 * During migration there is a single "active" session (backward compat with
 * the original single-user, single-project model in ui.ts). In the future
 * each authenticated user + project pair gets its own session.
 */

import { ProjectSession, type SavedProject } from './ProjectSession.js';

export class SessionManager {
  private sessions: Map<string, ProjectSession> = new Map();
  private active: ProjectSession = new ProjectSession();

  /** In-memory saved-project store (moves to Postgres in Phase 4). */
  readonly savedProjects: Map<string, SavedProject> = new Map();

  /**
   * Get or create a session for a given project ID.
   * Returns the active session if no projectId is provided.
   */
  getSession(projectId?: string): ProjectSession {
    if (!projectId) return this.active;
    let session = this.sessions.get(projectId);
    if (!session) {
      session = new ProjectSession();
      session.currentProjectId = projectId;
      this.sessions.set(projectId, session);
    }
    return session;
  }

  /**
   * Create a fresh session for a project.
   */
  createSession(projectId: string): ProjectSession {
    const session = new ProjectSession();
    session.currentProjectId = projectId;
    this.sessions.set(projectId, session);
    return session;
  }

  /**
   * Remove a session (e.g. when a project is deleted).
   */
  deleteSession(projectId: string): void {
    this.sessions.delete(projectId);
  }

  /**
   * Get the current active session (backward compat).
   * During the migration period the active session is the single global session
   * that ui.ts used before extraction.
   */
  getActiveSession(): ProjectSession {
    return this.active;
  }

  /**
   * Promote a project session to the active session.
   * Called when a project is loaded.
   */
  setActiveSession(projectId: string): ProjectSession {
    const session = this.getSession(projectId);
    this.active = session;
    return session;
  }
}
