// ProjectFile CRUD routes — generated code persistence

import { Router } from 'express';
import { getDatabase } from '../db/client.js';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// All project file routes require authentication
router.use(requireAuth);

// List files for a project
router.get('/:projectId/files', async (req: AuthenticatedRequest, res) => {
  try {
    const db = getDatabase();
    const { projectId } = req.params;

    // Verify project exists and user has access
    const project = await db.getProjectById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check ownership or membership
    if (project.userId !== req.userId) {
      const member = await db.getProjectMember(projectId, req.userId!);
      if (!member) {
        return res.status(404).json({ error: 'Project not found' });
      }
    }

    const files = await db.getProjectFilesByProjectId(projectId);
    res.json({ files });
  } catch (error) {
    console.error('List project files error:', error);
    res.status(500).json({ error: 'Failed to list project files' });
  }
});

// Get a single file by path
router.get('/:projectId/file', async (req: AuthenticatedRequest, res) => {
  try {
    const db = getDatabase();
    const { projectId } = req.params;
    const path = req.query.path as string;

    if (!path) {
      return res.status(400).json({ error: 'Path query parameter is required' });
    }

    // Verify project exists and user has access
    const project = await db.getProjectById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (project.userId !== req.userId) {
      const member = await db.getProjectMember(projectId, req.userId!);
      if (!member) {
        return res.status(404).json({ error: 'Project not found' });
      }
    }

    const file = await db.getProjectFile(projectId, path);
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.json({ file });
  } catch (error) {
    console.error('Get project file error:', error);
    res.status(500).json({ error: 'Failed to get project file' });
  }
});

// Upsert a file
router.put('/:projectId/file', async (req: AuthenticatedRequest, res) => {
  try {
    const db = getDatabase();
    const { projectId } = req.params;
    const { path, content, componentId } = req.body;

    if (!path || content === undefined) {
      return res.status(400).json({ error: 'Path and content are required' });
    }

    // Verify project exists and user has edit access
    const project = await db.getProjectById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (project.userId !== req.userId) {
      const member = await db.getProjectMember(projectId, req.userId!);
      if (!member || member.role === 'viewer') {
        return res.status(403).json({ error: 'Not authorized to modify files' });
      }
    }

    const file = await db.upsertProjectFile(projectId, path, content, componentId);
    res.json({ file });
  } catch (error) {
    console.error('Upsert project file error:', error);
    res.status(500).json({ error: 'Failed to upsert project file' });
  }
});

// Delete all files for a project
router.delete('/:projectId/files', async (req: AuthenticatedRequest, res) => {
  try {
    const db = getDatabase();
    const { projectId } = req.params;

    // Verify project exists and user has edit access
    const project = await db.getProjectById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (project.userId !== req.userId) {
      const member = await db.getProjectMember(projectId, req.userId!);
      if (!member || member.role === 'viewer') {
        return res.status(403).json({ error: 'Not authorized to delete files' });
      }
    }

    await db.deleteProjectFilesByProjectId(projectId);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete project files error:', error);
    res.status(500).json({ error: 'Failed to delete project files' });
  }
});

export default router;
