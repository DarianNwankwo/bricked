// Brick Platform Backend Server — unified entry point
// Merges the original server/index.ts (port 4000) with routes from ui.ts

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

// Existing routes (server/routes)
import authRoutes from './routes/auth.js';
import projectRoutes from './routes/projects.js';
import deploymentRoutes from './routes/deployments.js';
import usageRoutes from './routes/usage.js';
import preferencesRoutes from './routes/preferences.js';
import inviteRoutes from './routes/invites.js';
import previewRoutes from './routes/preview.js';
import githubRoutes from './routes/github.js';
import featureRoutes from './routes/features.js';
import messageRoutes from './routes/messages.js';
import projectFileRoutes from './routes/project-files.js';

// New routes extracted from ui.ts
import agentRoutes from './routes/agent.js';
import chatRoutes from './routes/chat.js';
import bacRoutes from './routes/bac.js';
import codegenRoutes from './routes/codegen.js';
import architectureRoutes from './routes/architecture.js';
import settingsRoutes from './routes/settings.js';
import queueRoutes from './routes/queue.js';
import docsRoutes from './routes/docs.js';

import { digitalOcean } from './services/digitalocean.js';
import { seedDatabase, getDatabase } from './db/client.js';
import { setupWebSocket } from './websocket/index.js';
import { SessionManager } from './state/SessionManager.js';
import { isQueueEnabled } from './queue/index.js';

export interface StartServerOptions {
  port?: number;
}

export function createApp() {
  const app = express();

  // ── SessionManager (shared state for studio routes) ─────────────────
  const sessionManager = new SessionManager();
  app.locals.sessionManager = sessionManager;

  // ── Middleware ───────────────────────────────────────────────────────
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  // ── Health check ────────────────────────────────────────────────────
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'brick-platform',
      version: '0.2.0',
      uptime: process.uptime(),
      queue: isQueueEnabled(),
    });
  });

  // ── Existing API routes (authenticated, DB-backed) ──────────────────
  app.use('/api/auth', authRoutes);
  app.use('/api/projects', projectRoutes);
  app.use('/api/deployments', deploymentRoutes);
  app.use('/api/usage', usageRoutes);
  app.use('/api/preferences', preferencesRoutes);
  app.use('/api/invites', inviteRoutes);
  app.use('/api/preview', previewRoutes);
  app.use('/api/github', githubRoutes);
  app.use('/api/projects', featureRoutes);
  app.use('/api/projects', messageRoutes);
  app.use('/api/projects', projectFileRoutes);

  // ── Studio routes (extracted from ui.ts — in-memory session state) ──
  app.use('/api/agent', agentRoutes);
  app.use('/api', chatRoutes);        // /api/generate-stream, /api/build
  app.use('/api/bac', bacRoutes);     // /api/bac, /api/bac/from-intent, /api/bac/completeness
  app.use('/api', codegenRoutes);     // /api/generate-code, /api/files, /api/file, etc.
  app.use('/api', architectureRoutes); // /api/templates, /api/architecture, /api/component, etc.
  app.use('/api', settingsRoutes);    // /api/reset, /api/config, /api/model, /api/settings, etc.
  app.use('/api', docsRoutes);        // /api/docs, /api/docs/generate

  // ── Queue routes (only active when REDIS_URL is set) ──────────────────
  app.use('/api/queue', queueRoutes);

  // ── Platform info ───────────────────────────────────────────────────
  app.get('/api/info', async (_req, res) => {
    const doValid = await digitalOcean.validateToken();
    const usesSQLite = process.env.BRICK_DB === 'sqlite' || !!process.env.BRICK_DB_PATH;

    res.json({
      platform: 'Brick',
      version: '0.2.0',
      features: {
        deployments: doValid,
        billing: false,
        collaboration: true,
        aiUsageTracking: true,
        database: usesSQLite ? 'sqlite' : 'in-memory',
        queueMode: isQueueEnabled(),
      },
    });
  });

  // ── Landing page ────────────────────────────────────────────────────
  app.get('/landing', (_req, res) => {
    const possiblePaths = [
      join(process.cwd(), 'src', 'landing', 'index.html'),
      join(process.cwd(), 'landing', 'index.html'),
    ];
    for (const landingPath of possiblePaths) {
      try {
        const html = readFileSync(landingPath, 'utf-8');
        res.type('html').send(html);
        return;
      } catch { continue; }
    }
    res.status(404).send('Landing page not found. Make sure src/landing/index.html exists.');
  });

  // ── Serve frontend from static files ─────────────────────────────────
  // Priority: Vite build output > legacy single-file frontend
  const frontendPaths = [
    join(process.cwd(), 'frontend', 'dist'),        // Vite build output (dev)
    join(process.cwd(), 'dist', 'frontend'),         // Vite build output (Docker)
    join(process.cwd(), 'src', 'frontend'),           // Legacy single-file fallback
  ];
  for (const fp of frontendPaths) {
    app.use(express.static(fp));
  }

  // SPA fallback: serve index.html for all non-API routes (React Router)
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/health') || req.path.startsWith('/landing')) {
      return next();
    }
    for (const fp of frontendPaths) {
      try {
        const html = readFileSync(join(fp, 'index.html'), 'utf-8');
        res.type('html').send(html);
        return;
      } catch { continue; }
    }
    res.status(404).send('Frontend not found');
  });

  // ── Error handler ───────────────────────────────────────────────────
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return { app, sessionManager };
}

// Start server — called by ui.ts command or directly
export async function startServer(options: StartServerOptions = {}) {
  const port = options.port || parseInt(process.env.PORT || '3333', 10);
  const { app, sessionManager } = createApp();
  const httpServer = createServer(app);

  // Seed test data
  console.log('\n\u{1F4E6} Initializing database...');
  await seedDatabase();

  // Setup WebSocket for real-time collaboration
  const io = setupWebSocket(httpServer);
  app.locals.io = io;

  httpServer.listen(port, () => {
    const url = `http://localhost:${port}`;
    console.log(`
\u{1F9F1} Brick Studio

Running at: ${url}

Press Ctrl+C to stop
`);
  });

  return { app, httpServer, io, sessionManager };
}

// Run if executed directly
if (process.argv[1]?.includes('server')) {
  startServer();
}

export default createApp;
