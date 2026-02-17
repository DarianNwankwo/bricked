/**
 * Settings routes — model selection, config, suggestions, cost estimation,
 * project management (in-memory), reset
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { getLLMConfig, POPULAR_MODELS } from '../../llm/config.js';
import { estimateCostFromComponents } from '../../deployer/cost-estimator.js';
import { optionalAuth, type AuthenticatedRequest } from '../middleware/auth.js';
import { getDatabase } from '../db/client.js';
import { resolveSession, getSessionManager } from '../state/resolveSession.js';

const router = Router();

// POST /api/reset
router.post('/reset', optionalAuth, (req: AuthenticatedRequest, res: Response) => {
  const { projectId } = req.body || {};
  if (projectId) {
    // Create a fresh session keyed by userId:projectId (or just projectId if unauthenticated)
    const sm = getSessionManager(req);
    const sessionKey = req.userId ? `${req.userId}:${projectId}` : projectId;
    const session = sm.createSession(sessionKey, projectId);
    sm.setActiveSession(sessionKey, projectId);
    session.reset();
    session.currentProjectId = projectId;
  } else {
    const session = resolveSession(req);
    session.reset();
  }
  import('../../agent/claude-code.js').then(m => m.clearConversation()).catch(() => {});
  res.json({ success: true });
});

// GET /api/config
router.get('/config', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  const session = resolveSession(req);
  try {
    const config = getLLMConfig();

    // Load preferred model from DB if authenticated and no session model set
    let model = session.selectedModel;
    if (!model && req.userId) {
      const db = getDatabase();
      const prefs = await db.getUserPreferences(req.userId);
      if (prefs?.preferredModel) {
        model = prefs.preferredModel;
        session.selectedModel = model; // hydrate session
      }
    }

    res.json({
      model: model || config.model,
      provider: config.provider,
      models: POPULAR_MODELS,
    });
  } catch (error) {
    res.json({
      model: session.selectedModel || 'Not configured',
      provider: 'None',
      models: POPULAR_MODELS,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// POST /api/model
router.post('/model', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const session = resolveSession(req);
    const { model } = req.body;
    session.selectedModel = model;

    // Persist to user preferences if authenticated
    if (req.userId) {
      const db = getDatabase();
      await db.upsertUserPreferences(req.userId, { preferredModel: model });
    }

    res.json({ success: true, model: session.selectedModel });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// GET /api/settings
router.get('/settings', (req: Request, res: Response) => {
  const session = resolveSession(req);
  try {
    const config = getLLMConfig();
    res.json({
      model: session.selectedModel || config.model,
      provider: config.provider,
    });
  } catch (error) {
    res.json({
      model: session.selectedModel || 'Not configured',
      provider: 'None',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/suggestions
router.get('/suggestions', (req: Request, res: Response) => {
  try {
    const session = resolveSession(req);
    if (!session.manualArchitecture || session.manualArchitecture.components.length === 0) {
      res.json({ suggestions: [] });
      return;
    }

    const components = session.manualArchitecture.components;
    const connections = session.manualArchitecture.connections;
    const suggestions: Array<{ id: string; type: string; title: string; description: string; action?: string }> = [];

    const hasDatabase = components.some(c => c.type === 'database');
    const hasCache = components.some(c => c.type === 'cache');
    const hasQueue = components.some(c => c.type === 'queue');
    const hasWorker = components.some(c => c.type === 'worker');
    const hasStaticSite = components.some(c => c.type === 'static_site');
    const hasService = components.some(c => c.type === 'service');
    const hasAuth = components.some(c => c.type === 'auth');
    const hasLoadBalancer = components.some(c => c.type === 'load_balancer');
    const hasCdn = components.some(c => c.type === 'cdn');
    const hasMonitoring = components.some(c => c.type === 'monitoring');

    if (hasDatabase && !hasCache) {
      suggestions.push({ id: 'add-cache', type: 'performance', title: 'Add a caching layer', description: 'Redis or Memcached can reduce database load and improve response times by 10-100x for repeated queries.', action: 'Add Redis cache' });
    }
    if (components.filter(c => c.type === 'service').length > 1 && !hasLoadBalancer) {
      suggestions.push({ id: 'add-lb', type: 'scalability', title: 'Add a load balancer', description: 'Distribute traffic across multiple services for better availability and horizontal scaling.', action: 'Add Load Balancer' });
    }
    if (hasStaticSite && !hasCdn) {
      suggestions.push({ id: 'add-cdn', type: 'performance', title: 'Add a CDN', description: 'Serve static assets from edge locations to reduce latency for global users.', action: 'Add CDN' });
    }
    if (hasService && !hasQueue && !hasWorker) {
      suggestions.push({ id: 'add-queue', type: 'reliability', title: 'Add async processing', description: 'Use a message queue with workers for long-running tasks to prevent request timeouts and improve UX.', action: 'Add message queue' });
    }
    if ((hasService || hasStaticSite) && !hasAuth) {
      suggestions.push({ id: 'add-auth', type: 'security', title: 'Add authentication', description: 'Protect your APIs and user data with a dedicated authentication service.', action: 'Add Auth service' });
    }
    if (components.length >= 3 && !hasMonitoring) {
      suggestions.push({ id: 'add-monitoring', type: 'observability', title: 'Add monitoring', description: 'Track performance, errors, and usage patterns across your services.', action: 'Add Monitoring' });
    }

    const connectedIds = new Set([...connections.map(c => c.from), ...connections.map(c => c.to)]);
    const isolated = components.filter(c => !connectedIds.has(c.id));
    if (isolated.length > 0) {
      suggestions.push({ id: 'connect-isolated', type: 'architecture', title: 'Connect isolated components', description: `${isolated.map(c => c.name).join(', ')} ${isolated.length === 1 ? 'is' : 'are'} not connected to any other components.` });
    }

    res.json({ suggestions: suggestions.slice(0, 5) });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// POST /api/cost
router.post('/cost', (req: Request, res: Response) => {
  try {
    const { components } = req.body;
    const cost = estimateCostFromComponents(components || []);
    res.json({ cost });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// ── Preview verification ───────────────────────────────────────────────

// POST /api/preview/:id/verify
router.post('/studio/preview/:id/verify', async (req: Request, res: Response) => {
  const projectId = req.params.id;
  try {
    const puppeteer = await import('puppeteer');
    const { getPreviewUrls } = await import('../services/preview.js');
    const { mkdir, writeFile: fsWriteFile } = await import('fs/promises');
    const { join: pathJoin } = await import('path');

    const urls = getPreviewUrls(projectId);
    if (urls.length === 0) {
      res.status(400).json({ error: 'No running preview found for this project' });
      return;
    }

    const screenshotDir = pathJoin(process.cwd(), 'data', 'screenshots', projectId);
    await mkdir(screenshotDir, { recursive: true });

    const browser = await puppeteer.default.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const checks: Array<{
      name: string; url: string; passed: boolean;
      httpStatus?: number; consoleErrors?: string[];
      screenshotPath?: string; error?: string;
    }> = [];

    for (let i = 0; i < urls.length; i++) {
      const serviceUrl = urls[i];
      const checkName = `service-${i}`;
      const consoleErrors: string[] = [];

      try {
        const page = await browser.newPage();
        page.on('console', msg => {
          if (msg.type() === 'error') consoleErrors.push(msg.text());
        });

        const response = await page.goto(serviceUrl, { waitUntil: 'networkidle2', timeout: 15000 });
        const status = response?.status() || 0;
        const screenshotPath = pathJoin(screenshotDir, `${checkName}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });

        checks.push({
          name: checkName, url: serviceUrl,
          passed: status >= 200 && status < 400 && consoleErrors.length === 0,
          httpStatus: status, consoleErrors,
          screenshotPath: `/api/studio/preview/${projectId}/screenshots/${checkName}`,
        });
        await page.close();
      } catch (err) {
        checks.push({
          name: checkName, url: serviceUrl, passed: false,
          consoleErrors, error: (err as Error).message,
        });
      }
    }

    await browser.close();
    res.json({ passed: checks.every(c => c.passed), checks, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/preview/:id/screenshots/:name
router.get('/studio/preview/:id/screenshots/:name', async (req: Request, res: Response) => {
  try {
    const { join: pathJoin } = await import('path');
    const { readFile: fsReadFile } = await import('fs/promises');
    const { existsSync } = await import('fs');
    const screenshotPath = pathJoin(process.cwd(), 'data', 'screenshots', req.params.id, `${req.params.name}.png`);
    if (!existsSync(screenshotPath)) {
      res.status(404).end('Screenshot not found');
      return;
    }
    const data = await fsReadFile(screenshotPath);
    res.setHeader('Content-Type', 'image/png');
    res.end(data);
  } catch {
    res.status(500).end('Error reading screenshot');
  }
});

export default router;
