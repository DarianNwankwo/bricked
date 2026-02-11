// Brick Platform Backend Server

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import authRoutes from './routes/auth.js';
import projectRoutes from './routes/projects.js';
import deploymentRoutes from './routes/deployments.js';
import usageRoutes from './routes/usage.js';
import preferencesRoutes from './routes/preferences.js';
import inviteRoutes from './routes/invites.js';
import previewRoutes from './routes/preview.js';
import githubRoutes from './routes/github.js';
import { digitalOcean } from './services/digitalocean.js';
import { seedDatabase, getDatabase } from './db/client.js';
import { setupWebSocket } from './websocket/index.js';

const app = express();
const PORT = process.env.PORT || 4000;

// Create HTTP server (needed for WebSocket)
const httpServer = createServer(app);

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'brick-platform' });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/deployments', deploymentRoutes);
app.use('/api/usage', usageRoutes);
app.use('/api/preferences', preferencesRoutes);
app.use('/api/invites', inviteRoutes);
app.use('/api/preview', previewRoutes);
app.use('/api/github', githubRoutes);

// Platform info
app.get('/api/info', async (req, res) => {
  const doValid = await digitalOcean.validateToken();
  const db = getDatabase();
  const usesSQLite = process.env.BRICK_DB === 'sqlite' || !!process.env.BRICK_DB_PATH;

  res.json({
    platform: 'Brick',
    version: '0.2.0',
    features: {
      deployments: doValid,
      billing: false, // TODO: Stripe integration
      collaboration: true,
      aiUsageTracking: true,
      database: usesSQLite ? 'sqlite' : 'in-memory',
    },
  });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
export async function startServer() {
  // Seed test data
  console.log('\n📦 Initializing database...');
  await seedDatabase();

  // Setup WebSocket for real-time collaboration
  const io = setupWebSocket(httpServer);

  httpServer.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════╗
║                                                   ║
║   🧱 Brick Platform Server                        ║
║                                                   ║
║   Running on: http://localhost:${PORT}              ║
║                                                   ║
║   Test Login:                                     ║
║   • Email:    test@brick.studio                   ║
║   • Password: password123                         ║
║                                                   ║
║   Endpoints:                                      ║
║   • POST /api/auth/login                          ║
║   • GET  /api/projects                            ║
║   WebSocket: Enabled for real-time collaboration  ║
║                                                   ║
╚═══════════════════════════════════════════════════╝
`);
  });

  return { app, httpServer, io };
}

// Run if executed directly
if (process.argv[1]?.includes('server')) {
  startServer();
}

export default app;
