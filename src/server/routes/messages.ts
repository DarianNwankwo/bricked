// Message CRUD routes — chat history persistence

import { Router } from 'express';
import { getDatabase } from '../db/client.js';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// All message routes require authentication
router.use(requireAuth);

// List messages for a project
router.get('/:projectId/messages', async (req: AuthenticatedRequest, res) => {
  try {
    const db = getDatabase();
    const { projectId } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;

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

    const messages = await db.getMessagesByProjectId(projectId, limit);
    res.json({ messages });
  } catch (error) {
    console.error('List messages error:', error);
    res.status(500).json({ error: 'Failed to list messages' });
  }
});

// Create a message
router.post('/:projectId/messages', async (req: AuthenticatedRequest, res) => {
  try {
    const db = getDatabase();
    const { projectId } = req.params;
    const { role, content, contextMode, metadata } = req.body;

    if (!role || !content) {
      return res.status(400).json({ error: 'Role and content are required' });
    }

    // Verify project exists and user has edit access
    const project = await db.getProjectById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (project.userId !== req.userId) {
      const member = await db.getProjectMember(projectId, req.userId!);
      if (!member || member.role === 'viewer') {
        return res.status(403).json({ error: 'Not authorized to create messages' });
      }
    }

    const message = await db.createMessage({
      projectId,
      userId: req.userId!,
      role,
      content,
      contextMode: contextMode || 'code',
      metadata: metadata || {},
    });
    res.status(201).json({ message });
  } catch (error) {
    console.error('Create message error:', error);
    res.status(500).json({ error: 'Failed to create message' });
  }
});

// Clear all messages for a project
router.delete('/:projectId/messages', async (req: AuthenticatedRequest, res) => {
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
        return res.status(403).json({ error: 'Not authorized to delete messages' });
      }
    }

    await db.deleteMessagesByProjectId(projectId);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete messages error:', error);
    res.status(500).json({ error: 'Failed to delete messages' });
  }
});

export default router;
