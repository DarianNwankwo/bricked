/**
 * session-sync.ts — Syncs in-memory ProjectSession state to the database.
 * Called after architecture/BAC/spec mutations when a DB project exists.
 */

import type { ProjectSession } from '../state/ProjectSession.js';
import { getDatabase } from '../db/client.js';

/**
 * Sync the session's architecture, BAC, componentSpecs, and diagram
 * to the database project. No-op if no currentProjectId is set.
 */
export async function syncSessionToDb(session: ProjectSession): Promise<void> {
  const projectId = session.currentProjectId;
  if (!projectId) return;

  try {
    const db = getDatabase();
    const project = await db.getProjectById(projectId);
    if (!project) return;

    await db.updateProject(projectId, {
      architecture: session.manualArchitecture
        ? {
            components: session.manualArchitecture.components.map(c => ({
              id: c.id,
              name: c.name,
              type: c.type as 'service' | 'static_site' | 'database' | 'worker' | 'job',
            })),
            connections: session.manualArchitecture.connections.map(c => ({
              from: c.from,
              to: c.to,
              label: c.label,
            })),
          }
        : project.architecture,
      bac: session.currentBAC as Record<string, unknown> | null,
      componentSpecs: session.currentProject.componentSpecs as Record<string, Record<string, unknown>>,
      diagram: session.currentDiagram,
    });
  } catch (err) {
    // Log but don't fail the request — sync is best-effort
    console.error('[session-sync] Failed to sync session to DB:', err);
  }
}
