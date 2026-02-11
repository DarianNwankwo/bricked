// Local preview routes

import { Router } from 'express';
import { getDatabase } from '../db/client.js';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';
import {
  startPreview,
  stopPreview,
  getPreviewStatus,
  streamPreviewLogs,
  refreshPreviewStatus,
} from '../services/preview.js';
import { generateDockerComposeYAML } from '../../generator/docker-compose-generator.js';

const router = Router();

// All preview routes require authentication
router.use(requireAuth);

// Generate docker-compose.yml (without starting preview)
router.post('/:projectId/generate', async (req: AuthenticatedRequest, res) => {
  try {
    const db = getDatabase();
    const project = await db.getProjectById(req.params.projectId);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check authorization
    if (project.userId !== req.userId) {
      const member = await db.getProjectMember(project.id, req.userId!);
      if (!member || member.role === 'viewer') {
        return res.status(403).json({ error: 'Not authorized' });
      }
    }

    const dockerCompose = generateDockerComposeYAML(project);

    res.json({
      dockerCompose,
      fileName: 'docker-compose.yml',
    });
  } catch (error) {
    console.error('Generate docker-compose error:', error);
    res.status(500).json({ error: 'Failed to generate docker-compose.yml' });
  }
});

// Start local preview
router.post('/:projectId/start', async (req: AuthenticatedRequest, res) => {
  try {
    const db = getDatabase();
    const project = await db.getProjectById(req.params.projectId);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check authorization
    if (project.userId !== req.userId) {
      const member = await db.getProjectMember(project.id, req.userId!);
      if (!member || member.role === 'viewer') {
        return res.status(403).json({ error: 'Not authorized' });
      }
    }

    const session = await startPreview(project);

    res.json({
      status: session.status,
      services: session.services,
      startedAt: session.startedAt,
    });
  } catch (error) {
    console.error('Start preview error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to start preview',
    });
  }
});

// Stop local preview
router.post('/:projectId/stop', async (req: AuthenticatedRequest, res) => {
  try {
    const db = getDatabase();
    const project = await db.getProjectById(req.params.projectId);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check authorization
    if (project.userId !== req.userId) {
      const member = await db.getProjectMember(project.id, req.userId!);
      if (!member || member.role === 'viewer') {
        return res.status(403).json({ error: 'Not authorized' });
      }
    }

    await stopPreview(project.id);

    res.json({ status: 'stopped' });
  } catch (error) {
    console.error('Stop preview error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to stop preview',
    });
  }
});

// Get preview status
router.get('/:projectId/status', async (req: AuthenticatedRequest, res) => {
  try {
    const db = getDatabase();
    const project = await db.getProjectById(req.params.projectId);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check authorization
    if (project.userId !== req.userId) {
      const member = await db.getProjectMember(project.id, req.userId!);
      if (!member) {
        return res.status(403).json({ error: 'Not authorized' });
      }
    }

    // Refresh and get current status
    let session = await refreshPreviewStatus(project.id);

    if (!session) {
      session = getPreviewStatus(project.id);
    }

    if (!session) {
      return res.json({
        status: 'not_started',
        services: [],
      });
    }

    res.json({
      status: session.status,
      services: session.services,
      startedAt: session.startedAt,
      error: session.error,
    });
  } catch (error) {
    console.error('Get preview status error:', error);
    res.status(500).json({ error: 'Failed to get preview status' });
  }
});

// Stream preview logs (SSE)
router.get('/:projectId/logs', async (req: AuthenticatedRequest, res) => {
  try {
    const db = getDatabase();
    const project = await db.getProjectById(req.params.projectId);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check authorization
    if (project.userId !== req.userId) {
      const member = await db.getProjectMember(project.id, req.userId!);
      if (!member) {
        return res.status(403).json({ error: 'Not authorized' });
      }
    }

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Create abort controller for cleanup
    const abortController = new AbortController();

    req.on('close', () => {
      abortController.abort();
    });

    // Stream logs
    try {
      for await (const chunk of streamPreviewLogs(project.id, abortController.signal)) {
        res.write(`data: ${JSON.stringify({ log: chunk })}\n\n`);
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        res.write(`data: ${JSON.stringify({ error: 'Log streaming ended' })}\n\n`);
      }
    }

    res.end();
  } catch (error) {
    console.error('Stream logs error:', error);
    res.status(500).json({ error: 'Failed to stream logs' });
  }
});

export default router;
