// Feature CRUD routes — Kanban board management

import { Router } from 'express';
import type { Server } from 'socket.io';
import { getDatabase } from '../db/client.js';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';
import { broadcastToProject } from '../websocket/index.js';

const router = Router();

// All feature routes require authentication
router.use(requireAuth);

// List features for a project
router.get('/:projectId/features', async (req: AuthenticatedRequest, res) => {
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

    const features = await db.getFeaturesByProjectId(projectId);
    res.json({ features });
  } catch (error) {
    console.error('List features error:', error);
    res.status(500).json({ error: 'Failed to list features' });
  }
});

// Create a feature
router.post('/:projectId/features', async (req: AuthenticatedRequest, res) => {
  try {
    const db = getDatabase();
    const { projectId } = req.params;
    const { title, description } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    // Verify project exists and user has edit access
    const project = await db.getProjectById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (project.userId !== req.userId) {
      const member = await db.getProjectMember(projectId, req.userId!);
      if (!member || member.role === 'viewer') {
        return res.status(403).json({ error: 'Not authorized to create features' });
      }
    }

    const feature = await db.createFeature(projectId, title, description || '');

    // Broadcast to other users viewing this project
    const io = req.app.locals.io as Server | undefined;
    if (io) broadcastToProject(io, projectId, 'feature-update', { type: 'created', feature });

    res.status(201).json({ feature });
  } catch (error) {
    console.error('Create feature error:', error);
    res.status(500).json({ error: 'Failed to create feature' });
  }
});

// Update a feature
router.patch('/:projectId/features/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const db = getDatabase();
    const { projectId, id } = req.params;
    const { title, description, status, agentStatus, agentMessage, position, timerEnd } = req.body;

    // Verify project exists and user has edit access
    const project = await db.getProjectById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (project.userId !== req.userId) {
      const member = await db.getProjectMember(projectId, req.userId!);
      if (!member || member.role === 'viewer') {
        return res.status(403).json({ error: 'Not authorized to update features' });
      }
    }

    // Verify the feature belongs to this project
    const existing = await db.getFeatureById(id);
    if (!existing || existing.projectId !== projectId) {
      return res.status(404).json({ error: 'Feature not found' });
    }

    const updates: Record<string, unknown> = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (status !== undefined) updates.status = status;
    if (agentStatus !== undefined) updates.agentStatus = agentStatus;
    if (agentMessage !== undefined) updates.agentMessage = agentMessage;
    if (position !== undefined) updates.position = position;
    if (timerEnd !== undefined) updates.timerEnd = timerEnd ? new Date(timerEnd) : null;

    const feature = await db.updateFeature(id, updates);

    // Broadcast to other users viewing this project
    const io = req.app.locals.io as Server | undefined;
    if (io) {
      broadcastToProject(io, projectId, 'feature-update', { type: 'updated', feature });
      // Also emit agent-status if agentStatus changed
      if (agentStatus !== undefined) {
        broadcastToProject(io, projectId, 'agent-status', {
          featureId: id,
          agentStatus,
          agentMessage: agentMessage || feature?.agentMessage,
        });
      }
    }

    res.json({ feature });
  } catch (error) {
    console.error('Update feature error:', error);
    res.status(500).json({ error: 'Failed to update feature' });
  }
});

// Delete a feature
router.delete('/:projectId/features/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const db = getDatabase();
    const { projectId, id } = req.params;

    // Verify project exists and user has edit access
    const project = await db.getProjectById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (project.userId !== req.userId) {
      const member = await db.getProjectMember(projectId, req.userId!);
      if (!member || member.role === 'viewer') {
        return res.status(403).json({ error: 'Not authorized to delete features' });
      }
    }

    // Verify the feature belongs to this project
    const existing = await db.getFeatureById(id);
    if (!existing || existing.projectId !== projectId) {
      return res.status(404).json({ error: 'Feature not found' });
    }

    await db.deleteFeature(id);

    // Broadcast to other users viewing this project
    const io = req.app.locals.io as Server | undefined;
    if (io) broadcastToProject(io, projectId, 'feature-update', { type: 'deleted', featureId: id });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete feature error:', error);
    res.status(500).json({ error: 'Failed to delete feature' });
  }
});

export default router;
