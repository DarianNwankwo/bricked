/**
 * Queue routes — job dispatch and SSE progress streaming
 *
 * Provides endpoints to:
 * - Dispatch jobs to the worker queue
 * - Stream job progress events via SSE
 * - Get queue status
 *
 * These routes only activate when REDIS_URL is configured (queue mode).
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import {
  isQueueEnabled,
  getQueueStats,
  dispatchBACGenerate,
  dispatchCodegenGenerate,
  dispatchCodegenEdit,
  dispatchDeploy,
  dispatchDocsGenerate,
} from '../queue/index.js';
import { getJobEventSubscriber } from '../queue/events.js';

const router = Router();

// ── Guard middleware — all queue routes require REDIS_URL ────────────────────

router.use((_req: Request, res: Response, next) => {
  if (!isQueueEnabled()) {
    res.status(503).json({
      error: 'Queue mode not available. Set REDIS_URL to enable background job processing.',
    });
    return;
  }
  next();
});

// ── POST /api/queue/bac/generate — dispatch BAC generation job ──────────────

router.post('/bac/generate', async (req: Request, res: Response) => {
  try {
    const { projectId, userId, description, existingBAC, model } = req.body;
    if (!projectId || !userId || !description) {
      res.status(400).json({ error: 'projectId, userId, and description are required' });
      return;
    }

    const job = await dispatchBACGenerate({ projectId, userId, description, existingBAC, model });
    res.json({ jobId: job.id, queue: 'bac', name: job.name });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to dispatch job' });
  }
});

// ── POST /api/queue/codegen/generate — dispatch code generation job ─────────

router.post('/codegen/generate', async (req: Request, res: Response) => {
  try {
    const { projectId, userId, bac, componentSpecs, model } = req.body;
    if (!projectId || !userId || !bac) {
      res.status(400).json({ error: 'projectId, userId, and bac are required' });
      return;
    }

    const job = await dispatchCodegenGenerate({ projectId, userId, bac, componentSpecs, model });
    res.json({ jobId: job.id, queue: 'codegen', name: job.name });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to dispatch job' });
  }
});

// ── POST /api/queue/codegen/edit — dispatch file edit job ───────────────────

router.post('/codegen/edit', async (req: Request, res: Response) => {
  try {
    const { projectId, userId, filePath, editRequest, existingContent, bac, model } = req.body;
    if (!projectId || !userId || !filePath || !editRequest || !existingContent) {
      res.status(400).json({
        error: 'projectId, userId, filePath, editRequest, and existingContent are required',
      });
      return;
    }

    const job = await dispatchCodegenEdit({
      projectId, userId, filePath, editRequest, existingContent, bac, model,
    });
    res.json({ jobId: job.id, queue: 'codegen', name: job.name });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to dispatch job' });
  }
});

// ── POST /api/queue/deploy — dispatch deployment job ────────────────────────

router.post('/deploy', async (req: Request, res: Response) => {
  try {
    const { projectId, userId, environmentName } = req.body;
    if (!projectId || !userId || !environmentName) {
      res.status(400).json({ error: 'projectId, userId, and environmentName are required' });
      return;
    }

    const job = await dispatchDeploy({ projectId, userId, environmentName });
    res.json({ jobId: job.id, queue: 'deploy', name: job.name });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to dispatch job' });
  }
});

// ── POST /api/queue/docs/generate — dispatch docs generation job ────────────

router.post('/docs/generate', async (req: Request, res: Response) => {
  try {
    const { projectId, userId, bac, existingDocs, model } = req.body;
    if (!projectId || !userId) {
      res.status(400).json({ error: 'projectId and userId are required' });
      return;
    }

    const job = await dispatchDocsGenerate({ projectId, userId, bac, existingDocs, model });
    res.json({ jobId: job.id, queue: 'docs', name: job.name });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to dispatch job' });
  }
});

// ── GET /api/queue/events/:projectId — SSE stream of job events ─────────────

router.get('/events/:projectId', async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const subscriber = getJobEventSubscriber();

  if (!subscriber) {
    res.status(503).json({ error: 'Event subscriber not available' });
    return;
  }

  // SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  // Send initial keepalive
  res.write(': connected\n\n');

  const unsubscribe = await subscriber.subscribeProject(projectId, (event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  });

  // Heartbeat every 30s to keep connection alive
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 30_000);

  // Cleanup on disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

// ── GET /api/queue/status — queue statistics ────────────────────────────────

router.get('/status', async (_req: Request, res: Response) => {
  try {
    const stats = await getQueueStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get queue status' });
  }
});

export default router;
