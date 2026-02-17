/**
 * Architecture routes — templates, component/connection CRUD
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import {
  type ArchComponent,
  type ArchConnection,
  type ManualArchitecture,
  type ComponentType,
  indexToComponentId,
  nextComponentIndex,
} from '../state/ProjectSession.js';
import { resolveSession } from '../state/resolveSession.js';
import { syncSessionToDb } from '../services/session-sync.js';

const router = Router();

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

/**
 * Layered graph layout (Sugiyama-style).
 * 1. BFS from source nodes to assign layers
 * 2. Barycenter heuristic to order nodes within layers (minimise crossings)
 * 3. Assign x/y with generous spacing, centered on canvas
 */
function layoutGraph(
  compIds: string[],
  edges: Array<{ from: string; to: string }>,
  compTypes?: Map<string, string>,
): Record<string, { x: number; y: number }> {
  const NODE_W = 200;
  const H_GAP = 80;       // horizontal gap between nodes
  const V_GAP = 160;      // vertical gap between layers
  const START_Y = 80;

  // Background processing types that should be pushed down when they're source nodes
  const BACKGROUND_TYPES = new Set(['worker', 'job']);

  // Build adjacency structures
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();
  for (const id of compIds) {
    outgoing.set(id, []);
    incoming.set(id, []);
  }
  for (const e of edges) {
    outgoing.get(e.from)?.push(e.to);
    incoming.get(e.from); // ensure entry
    incoming.get(e.to)?.push(e.from);
  }

  // --- Layer assignment via longest-path (gives better tier separation) ---
  const layer = new Map<string, number>();
  const visited = new Set<string>();

  function longestPath(id: string): number {
    if (layer.has(id)) return layer.get(id)!;
    if (visited.has(id)) return 0; // cycle guard
    visited.add(id);
    const parents = incoming.get(id) || [];
    let maxParent = -1;
    for (const p of parents) {
      maxParent = Math.max(maxParent, longestPath(p));
    }
    const l = maxParent + 1;
    layer.set(id, l);
    return l;
  }

  for (const id of compIds) longestPath(id);

  // --- Demote non-entry source nodes ---
  // Source nodes (layer 0) that aren't natural entry types (e.g. Worker)
  // get pushed down to the layer of their deepest outgoing target.
  if (compTypes) {
    for (const id of compIds) {
      if (layer.get(id) !== 0) continue;
      const nodeType = compTypes.get(id) || '';
      if (!BACKGROUND_TYPES.has(nodeType)) continue;
      const targets = outgoing.get(id) || [];
      if (targets.length === 0) continue;
      let maxTargetLayer = 0;
      for (const t of targets) {
        maxTargetLayer = Math.max(maxTargetLayer, layer.get(t) || 0);
      }
      if (maxTargetLayer > 0) {
        layer.set(id, maxTargetLayer + 1);
      }
    }
  }

  // Group nodes by layer
  const layers: string[][] = [];
  for (const id of compIds) {
    const l = layer.get(id) || 0;
    while (layers.length <= l) layers.push([]);
    layers[l].push(id);
  }

  // --- Barycenter ordering to reduce crossings ---
  // Helper: find connected nodes in an adjacent layer for barycenter calculation.
  // For demoted source nodes, outgoing edges may point to the layer ABOVE,
  // so we check both incoming edges from above and outgoing edges to above.
  function getNeighborsAbove(id: string, targetLayer: number): string[] {
    const parents = (incoming.get(id) || []).filter(p => layer.get(p) === targetLayer);
    if (parents.length > 0) return parents;
    // Fallback: outgoing edges pointing upward (demoted source nodes)
    return (outgoing.get(id) || []).filter(t => layer.get(t) === targetLayer);
  }
  function getNeighborsBelow(id: string, targetLayer: number): string[] {
    const children = (outgoing.get(id) || []).filter(c => layer.get(c) === targetLayer);
    if (children.length > 0) return children;
    // Fallback: incoming edges pointing downward (shouldn't normally happen, but symmetric)
    return (incoming.get(id) || []).filter(p => layer.get(p) === targetLayer);
  }

  for (let pass = 0; pass < 4; pass++) {
    // Forward sweep (top-down)
    for (let l = 1; l < layers.length; l++) {
      const bary = new Map<string, number>();
      for (const id of layers[l]) {
        const neighbors = getNeighborsAbove(id, l - 1);
        if (neighbors.length === 0) {
          bary.set(id, layers[l].indexOf(id));
        } else {
          const avg = neighbors.reduce((sum, n) => sum + layers[l - 1].indexOf(n), 0) / neighbors.length;
          bary.set(id, avg);
        }
      }
      layers[l].sort((a, b) => (bary.get(a) || 0) - (bary.get(b) || 0));
    }
    // Backward sweep (bottom-up)
    for (let l = layers.length - 2; l >= 0; l--) {
      const bary = new Map<string, number>();
      for (const id of layers[l]) {
        const neighbors = getNeighborsBelow(id, l + 1);
        if (neighbors.length === 0) {
          bary.set(id, layers[l].indexOf(id));
        } else {
          const avg = neighbors.reduce((sum, n) => sum + layers[l + 1].indexOf(n), 0) / neighbors.length;
          bary.set(id, avg);
        }
      }
      layers[l].sort((a, b) => (bary.get(a) || 0) - (bary.get(b) || 0));
    }
  }

  // --- Position assignment ---
  // Dynamic gap: compress wider layers so the diagram doesn't get too wide
  const maxLayerCount = Math.max(...layers.map(l => l.length));
  const effectiveGap = maxLayerCount <= 3 ? H_GAP : Math.max(40, H_GAP - (maxLayerCount - 3) * 12);
  const totalMaxWidth = maxLayerCount * NODE_W + (maxLayerCount - 1) * effectiveGap;

  const positions: Record<string, { x: number; y: number }> = {};
  for (let l = 0; l < layers.length; l++) {
    const count = layers[l].length;
    const layerGap = count <= 3 ? H_GAP : Math.max(40, H_GAP - (count - 3) * 12);
    const layerWidth = count * NODE_W + (count - 1) * layerGap;
    const offsetX = (totalMaxWidth - layerWidth) / 2;
    for (let i = 0; i < count; i++) {
      positions[layers[l][i]] = {
        x: offsetX + i * (NODE_W + layerGap),
        y: START_Y + l * V_GAP,
      };
    }
  }

  return positions;
}

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
      const componentNameToId: Record<string, string> = {};

      // Assign IDs first
      template.components.forEach((comp, index) => {
        componentNameToId[comp.name] = String.fromCharCode(65 + index);
      });

      // Build edges with IDs
      const edges = template.connections
        .filter(conn => componentNameToId[conn.from] && componentNameToId[conn.to])
        .map(conn => ({ from: componentNameToId[conn.from], to: componentNameToId[conn.to] }));

      const compIds = template.components.map((_, i) => String.fromCharCode(65 + i));
      const compTypes = new Map(template.components.map((comp, i) => [String.fromCharCode(65 + i), comp.type]));

      // Compute layered graph positions
      const positions = layoutGraph(compIds, edges, compTypes);

      const components: ArchComponent[] = template.components.map((comp, index) => {
        const compId = String.fromCharCode(65 + index);
        const pos = positions[compId] || { x: 100, y: 100 };
        return {
          id: compId,
          name: comp.name,
          type: comp.type as ComponentType,
          x: pos.x,
          y: pos.y,
        };
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
    const session = resolveSession(req);
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
    syncSessionToDb(session).catch(() => {});
    res.json({ architecture: session.manualArchitecture, ir, diagram: session.currentDiagram, bac: session.currentBAC });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// GET /api/architecture
router.get('/architecture', (req: Request, res: Response) => {
  const session = resolveSession(req);
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
    const session = resolveSession(req);
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
    syncSessionToDb(session).catch(() => {});
    res.json({ architecture: session.manualArchitecture, ir, bac: session.currentBAC });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// PUT /api/architecture/name
router.put('/architecture/name', (req: Request, res: Response) => {
  try {
    const session = resolveSession(req);
    const { name } = req.body;
    if (!session.manualArchitecture) {
      session.manualArchitecture = { name, components: [], connections: [] };
    } else {
      session.manualArchitecture.name = name;
    }
    session.currentDiagram = session.manualToMermaid(session.manualArchitecture);
    session.refreshBACFromCurrentArchitecture();
    syncSessionToDb(session).catch(() => {});
    res.json({ success: true, bac: session.currentBAC });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// POST /api/component — add
router.post('/component', (req: Request, res: Response) => {
  try {
    const session = resolveSession(req);
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
    syncSessionToDb(session).catch(() => {});
    res.json({ component, architecture: session.manualArchitecture, ir, bac: session.currentBAC });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// PUT /api/component — update
router.put('/component', (req: Request, res: Response) => {
  try {
    const session = resolveSession(req);
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
    syncSessionToDb(session).catch(() => {});
    res.json({ component, architecture: session.manualArchitecture, ir, bac: session.currentBAC });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// DELETE /api/component
router.delete('/component', (req: Request, res: Response) => {
  try {
    const session = resolveSession(req);
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
    syncSessionToDb(session).catch(() => {});
    res.json({ architecture: session.manualArchitecture, ir, bac: session.currentBAC });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// POST /api/connection — add
router.post('/connection', (req: Request, res: Response) => {
  try {
    const session = resolveSession(req);
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
    syncSessionToDb(session).catch(() => {});
    res.json({ architecture: session.manualArchitecture, ir, bac: session.currentBAC });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// PUT /api/connection — update
router.put('/connection', (req: Request, res: Response) => {
  try {
    const session = resolveSession(req);
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
    syncSessionToDb(session).catch(() => {});
    res.json({ architecture: session.manualArchitecture, ir, bac: session.currentBAC });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// DELETE /api/connection
router.delete('/connection', (req: Request, res: Response) => {
  try {
    const session = resolveSession(req);
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
    syncSessionToDb(session).catch(() => {});
    res.json({ architecture: session.manualArchitecture, ir, bac: session.currentBAC });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

export default router;
