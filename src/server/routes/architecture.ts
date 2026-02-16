/**
 * Architecture routes — templates, component/connection CRUD
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import type { SessionManager } from '../state/SessionManager.js';
import {
  type ArchComponent,
  type ArchConnection,
  type ManualArchitecture,
  type ComponentType,
  indexToComponentId,
  nextComponentIndex,
} from '../state/ProjectSession.js';

const router = Router();

function getSessionManager(req: Request): SessionManager {
  return req.app.locals.sessionManager as SessionManager;
}

// ── Template loading ────────────────────────────────────────────────────

interface ArchitectureTemplate {
  name: string;
  description: string;
  tier: string;
  components: Array<{ type: string; name: string; description: string }>;
  connections: Array<{ from: string; to: string; protocol: string }>;
  scalability: string;
  source_patterns: string[];
}

interface ArchitectureTemplatesFile {
  version: string;
  templates: ArchitectureTemplate[];
}

const TEMPLATE_ICONS: Record<string, string> = {
  'two-tier': '\u{1F310}',
  'three-tier': '\u{1F537}',
  'microservices': '\u2699\uFE0F',
};

function loadArchitectureTemplates(): Record<string, { name: string; description: string; icon: string; architecture: ManualArchitecture }> {
  const templates: Record<string, { name: string; description: string; icon: string; architecture: ManualArchitecture }> = {};

  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const possiblePaths = [
      join(process.cwd(), 'data', 'architecture_templates.json'),
      join(__dirname, '..', '..', '..', '..', 'data', 'architecture_templates.json'),
      join(__dirname, '..', '..', '..', 'data', 'architecture_templates.json'),
    ];

    let templatesPath = '';
    for (const p of possiblePaths) {
      try { readFileSync(p); templatesPath = p; break; } catch {}
    }
    if (!templatesPath) throw new Error('Could not find architecture_templates.json');

    const fileContent = readFileSync(templatesPath, 'utf-8');
    const templatesData: ArchitectureTemplatesFile = JSON.parse(fileContent);

    for (const template of templatesData.templates) {
      const id = template.name.toLowerCase().replace(/\s+/g, '-');
      const components: ArchComponent[] = [];
      const componentNameToId: Record<string, string> = {};
      const numComponents = template.components.length;
      const canvasWidth = 600;
      const startY = 80;
      const rowHeight = 140;

      template.components.forEach((comp, index) => {
        const compId = String.fromCharCode(65 + index);
        componentNameToId[comp.name] = compId;
        const row = Math.floor(index / 3);
        const colCount = Math.min(3, numComponents - row * 3);
        const col = index % 3;
        const xSpacing = canvasWidth / (colCount + 1);
        const x = xSpacing * (col + 1);
        const y = startY + row * rowHeight;

        components.push({
          id: compId,
          name: comp.name,
          type: comp.type as ComponentType,
          x,
          y,
        });
      });

      const connections: ArchConnection[] = template.connections
        .filter(conn => componentNameToId[conn.from] && componentNameToId[conn.to])
        .map(conn => ({
          from: componentNameToId[conn.from],
          to: componentNameToId[conn.to],
          label: conn.protocol || undefined,
        }));

      templates[id] = {
        name: template.name,
        description: template.description,
        icon: TEMPLATE_ICONS[template.tier] || '\u{1F4E6}',
        architecture: { name: id, components, connections },
      };
    }
  } catch (error) {
    console.error('Warning: Could not load architecture templates:', error);
  }

  templates['blank'] = {
    name: 'Blank Canvas',
    description: 'Start from scratch',
    icon: '\u{1F4D0}',
    architecture: { name: 'my-app', components: [], connections: [] },
  };

  return templates;
}

const TEMPLATES = loadArchitectureTemplates();

// ── Tech stack options ──────────────────────────────────────────────────

const techStackOptions: Record<string, string[]> = {
  static_site: ['React', 'Vue.js', 'Next.js', 'Svelte', 'Angular', 'Astro', 'HTML/CSS'],
  service: ['Node.js/Express', 'Python/FastAPI', 'Go/Gin', 'Ruby/Rails', 'Java/Spring', 'Rust/Actix', '.NET/C#'],
  database: ['PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'SQLite', 'CockroachDB'],
  cache: ['Redis', 'Memcached', 'KeyDB'],
  queue: ['Redis', 'RabbitMQ', 'Kafka', 'AWS SQS'],
  worker: ['Node.js', 'Python', 'Go', 'Ruby', 'Java'],
  job: ['Node.js', 'Python', 'Go', 'Shell Script'],
  api_gateway: ['Kong', 'Nginx', 'Traefik', 'AWS API Gateway'],
  load_balancer: ['Nginx', 'HAProxy', 'Traefik', 'AWS ALB'],
  auth: ['Auth0', 'Firebase Auth', 'Keycloak', 'Custom JWT'],
  storage: ['DigitalOcean Spaces', 'AWS S3', 'Cloudflare R2', 'MinIO'],
  search: ['Elasticsearch', 'Algolia', 'Meilisearch', 'Typesense'],
  monitoring: ['Prometheus/Grafana', 'Datadog', 'New Relic', 'Sentry'],
  ml_model: ['TensorFlow Serving', 'PyTorch Serve', 'ONNX Runtime', 'Hugging Face'],
};

const templateDescriptions: Record<string, string> = {
  'scalable-web-app': 'A production-ready web application with load balancing for horizontal scaling, Redis caching for performance, and a managed database. Ideal for apps expecting growth.',
  'simple-web-app': 'A straightforward web app with a frontend, backend API, and database. Perfect for MVPs and small to medium projects.',
  'microservices-platform': 'A distributed system with multiple independent services communicating via message queues. Great for complex domains requiring team autonomy.',
  'event-sourcing-system': 'CQRS pattern with event sourcing for audit trails and complex business logic. Ideal for financial or compliance-heavy applications.',
  'real-time-application': 'WebSocket-based architecture for live updates, chat, or collaborative features. Includes Redis for pub/sub.',
  'ml-pipeline': 'Machine learning inference pipeline with model serving, feature store, and monitoring. Ready for production ML workloads.',
  'e-commerce-platform': 'Full e-commerce stack with product catalog, cart, payments, inventory, and notifications.',
  'saas-starter': 'Multi-tenant SaaS foundation with authentication, billing integration, and analytics.',
  'blank': 'Start with an empty canvas and build your architecture from scratch.',
};

// ── Routes ──────────────────────────────────────────────────────────────

// GET /api/templates
router.get('/templates', (_req: Request, res: Response) => {
  const templates = Object.entries(TEMPLATES).map(([id, t]) => ({
    id,
    name: t.name,
    description: t.description,
    icon: t.icon,
    componentCount: t.architecture.components.length,
  }));
  res.json({ templates });
});

// GET /api/templates/:id
router.get('/templates/:id', (req: Request, res: Response) => {
  const template = TEMPLATES[req.params.id];
  if (!template) {
    res.status(404).json({ error: 'Template not found' });
    return;
  }

  const components = template.architecture.components.map(c => ({
    id: c.id,
    name: c.name,
    type: c.type,
    techOptions: techStackOptions[c.type] || ['Custom'],
    defaultTech: (techStackOptions[c.type] || ['Custom'])[0],
  }));

  res.json({
    id: req.params.id,
    name: template.name,
    description: template.description,
    longDescription: templateDescriptions[req.params.id] || template.description,
    icon: template.icon,
    components,
    connections: template.architecture.connections,
  });
});

// POST /api/template — load a template
router.post('/template', (req: Request, res: Response) => {
  try {
    const session = getSessionManager(req).getActiveSession();
    const { templateId } = req.body;
    const template = TEMPLATES[templateId];
    if (!template) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }

    session.manualArchitecture = JSON.parse(JSON.stringify(template.architecture));
    session.nextComponentId = nextComponentIndex(session.manualArchitecture!.components);
    session.currentDiagram = session.manualToMermaid(session.manualArchitecture!);
    session.refreshBACFromCurrentArchitecture();

    const ir = session.manualToIR(session.manualArchitecture!);
    res.json({ architecture: session.manualArchitecture, ir, diagram: session.currentDiagram, bac: session.currentBAC });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// GET /api/architecture
router.get('/architecture', (req: Request, res: Response) => {
  const session = getSessionManager(req).getActiveSession();
  if (!session.manualArchitecture) {
    res.json({ architecture: null, bac: session.currentBAC });
    return;
  }
  const ir = session.manualToIR(session.manualArchitecture);
  session.refreshBACFromCurrentArchitecture();
  res.json({ architecture: session.manualArchitecture, ir, bac: session.currentBAC });
});

// POST /api/architecture — replace (undo/redo)
router.post('/architecture', (req: Request, res: Response) => {
  try {
    const session = getSessionManager(req).getActiveSession();
    const { architecture } = req.body;
    if (!architecture || !Array.isArray(architecture.components) || !Array.isArray(architecture.connections)) {
      res.status(400).json({ error: 'Invalid architecture payload' });
      return;
    }
    session.manualArchitecture = architecture as ManualArchitecture;
    session.nextComponentId = nextComponentIndex(session.manualArchitecture.components);
    session.currentDiagram = session.manualToMermaid(session.manualArchitecture);
    const ir = session.manualToIR(session.manualArchitecture);
    session.refreshBACFromCurrentArchitecture();
    res.json({ architecture: session.manualArchitecture, ir, bac: session.currentBAC });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// PUT /api/architecture/name
router.put('/architecture/name', (req: Request, res: Response) => {
  try {
    const session = getSessionManager(req).getActiveSession();
    const { name } = req.body;
    if (!session.manualArchitecture) {
      session.manualArchitecture = { name, components: [], connections: [] };
    } else {
      session.manualArchitecture.name = name;
    }
    session.currentDiagram = session.manualToMermaid(session.manualArchitecture);
    session.refreshBACFromCurrentArchitecture();
    res.json({ success: true, bac: session.currentBAC });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// POST /api/component — add
router.post('/component', (req: Request, res: Response) => {
  try {
    const session = getSessionManager(req).getActiveSession();
    const { type, name, x, y } = req.body;
    if (!session.manualArchitecture) {
      session.manualArchitecture = { name: 'my-app', components: [], connections: [] };
    }
    const id = indexToComponentId(session.nextComponentId++);
    const component: ArchComponent = {
      id,
      name: name || type.charAt(0).toUpperCase() + type.slice(1),
      type,
      x: x || 300,
      y: y || 200,
    };
    session.manualArchitecture.components.push(component);
    session.currentDiagram = session.manualToMermaid(session.manualArchitecture);
    const ir = session.manualToIR(session.manualArchitecture);
    session.refreshBACFromCurrentArchitecture();
    res.json({ component, architecture: session.manualArchitecture, ir, bac: session.currentBAC });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// PUT /api/component — update
router.put('/component', (req: Request, res: Response) => {
  try {
    const session = getSessionManager(req).getActiveSession();
    const { id, name, x, y } = req.body;
    if (!session.manualArchitecture) {
      res.status(400).json({ error: 'No architecture' });
      return;
    }
    const component = session.manualArchitecture.components.find(c => c.id === id);
    if (!component) {
      res.status(404).json({ error: 'Component not found' });
      return;
    }
    if (name !== undefined) component.name = name;
    if (x !== undefined) component.x = x;
    if (y !== undefined) component.y = y;
    session.currentDiagram = session.manualToMermaid(session.manualArchitecture);
    const ir = session.manualToIR(session.manualArchitecture);
    session.refreshBACFromCurrentArchitecture();
    res.json({ component, architecture: session.manualArchitecture, ir, bac: session.currentBAC });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// DELETE /api/component
router.delete('/component', (req: Request, res: Response) => {
  try {
    const session = getSessionManager(req).getActiveSession();
    const id = req.query.id as string;
    if (!session.manualArchitecture || !id) {
      res.status(400).json({ error: 'No architecture or missing id' });
      return;
    }
    session.manualArchitecture.components = session.manualArchitecture.components.filter(c => c.id !== id);
    session.manualArchitecture.connections = session.manualArchitecture.connections.filter(
      c => c.from !== id && c.to !== id
    );
    session.currentDiagram = session.manualToMermaid(session.manualArchitecture);
    const ir = session.manualToIR(session.manualArchitecture);
    session.refreshBACFromCurrentArchitecture();
    res.json({ architecture: session.manualArchitecture, ir, bac: session.currentBAC });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// POST /api/connection — add
router.post('/connection', (req: Request, res: Response) => {
  try {
    const session = getSessionManager(req).getActiveSession();
    const { from, to, label, contract } = req.body;
    if (!session.manualArchitecture || !from || !to) {
      res.status(400).json({ error: 'No architecture or missing connection endpoints' });
      return;
    }
    const existing = session.manualArchitecture.connections.find(c => c.from === from && c.to === to);
    if (!existing) {
      session.manualArchitecture.connections.push({
        from, to,
        label: typeof label === 'string' ? label : undefined,
        contract: contract || undefined,
      });
    } else {
      if (typeof label === 'string') existing.label = label;
      if (contract && typeof contract === 'object') {
        existing.contract = { ...(existing.contract || {}), ...contract };
      }
    }
    session.currentDiagram = session.manualToMermaid(session.manualArchitecture);
    const ir = session.manualToIR(session.manualArchitecture);
    session.refreshBACFromCurrentArchitecture();
    res.json({ architecture: session.manualArchitecture, ir, bac: session.currentBAC });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// PUT /api/connection — update
router.put('/connection', (req: Request, res: Response) => {
  try {
    const session = getSessionManager(req).getActiveSession();
    const { from, to, label, contract } = req.body;
    if (!session.manualArchitecture || !from || !to) {
      res.status(400).json({ error: 'No architecture or missing connection endpoints' });
      return;
    }
    const connection = session.manualArchitecture.connections.find(c => c.from === from && c.to === to);
    if (!connection) {
      res.status(404).json({ error: 'Connection not found' });
      return;
    }
    if (typeof label === 'string') connection.label = label;
    if (contract !== undefined) {
      if (typeof contract === 'string') {
        connection.contract = { ...(connection.contract || {}), notes: contract };
      } else if (contract && typeof contract === 'object') {
        connection.contract = { ...(connection.contract || {}), ...contract };
      }
    }
    session.currentDiagram = session.manualToMermaid(session.manualArchitecture);
    const ir = session.manualToIR(session.manualArchitecture);
    session.refreshBACFromCurrentArchitecture();
    res.json({ architecture: session.manualArchitecture, ir, bac: session.currentBAC });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// DELETE /api/connection
router.delete('/connection', (req: Request, res: Response) => {
  try {
    const session = getSessionManager(req).getActiveSession();
    const from = req.query.from as string;
    const to = req.query.to as string;
    if (!session.manualArchitecture || !from || !to) {
      res.status(400).json({ error: 'No architecture or missing params' });
      return;
    }
    session.manualArchitecture.connections = session.manualArchitecture.connections.filter(
      c => !(c.from === from && c.to === to)
    );
    session.currentDiagram = session.manualToMermaid(session.manualArchitecture);
    const ir = session.manualToIR(session.manualArchitecture);
    session.refreshBACFromCurrentArchitecture();
    res.json({ architecture: session.manualArchitecture, ir, bac: session.currentBAC });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

export default router;
