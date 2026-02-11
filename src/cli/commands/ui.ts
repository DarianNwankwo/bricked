import { Command } from 'commander';
import { createServer } from 'http';
import { readFileSync, readdirSync, statSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import { parse } from '../../parser/index.js';
import { transform } from '../../transformer/index.js';
import { generate } from '../../generator/index.js';
import { validate } from '../../validator/index.js';
import { estimateCost, estimateCostFromComponents } from '../../deployer/cost-estimator.js';
import { chatStream, getConfiguredModel, getConfiguredProvider, POPULAR_MODELS, type Message, type ChatMessage } from '../../llm/index.js';
import { SYSTEM_PROMPT } from '../../llm/prompts/system.js';
import { formatExamplesForPrompt } from '../../llm/prompts/examples.js';
import { getLLMConfig, OPENROUTER_BASE_URL } from '../../llm/config.js';
import { planCodeStructure, generateFile, type Component, type FilePlan, type GeneratedFile } from '../../codegen/index.js';
import { stashArtifacts, loadArtifacts, hasStashedArtifacts, deleteArtifacts, slugify } from '../../server/services/artifacts.js';
import YAML from 'yaml';

// Project file storage (in-memory for now)
interface ProjectFile {
  path: string;
  content: string;
  componentId: string | null;
  generatedAt: Date;
  isManuallyEdited: boolean;
}

interface ProjectData {
  files: Map<string, ProjectFile>;
  componentSpecs: Record<string, { description?: string; inputs?: string; outputs?: string; notes?: string }>;
}

// Saved project metadata
interface SavedProject {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  editedAt: Date;
  architecture: ManualArchitecture | null;
  componentSpecs: Record<string, { description?: string; inputs?: string; outputs?: string; notes?: string }>;
  diagram: string | null;
  documentation: string;
}

// In-memory project storage (in production, this would be a database)
const savedProjects: Map<string, SavedProject> = new Map();

// Architecture component for manual editing
// Comprehensive component types for infrastructure design
type ComponentType =
  // Compute
  | 'service'        // Backend service / API
  | 'static_site'    // Frontend / SPA / static assets
  | 'worker'         // Background worker process
  | 'job'            // Scheduled job / cron
  | 'function'       // Serverless function (Lambda, Cloud Functions)
  | 'container'      // Container / Kubernetes pod
  // Data
  | 'database'       // Relational database (Postgres, MySQL)
  | 'cache'          // In-memory cache (Redis, Memcached)
  | 'queue'          // Message queue (RabbitMQ, SQS, Kafka)
  | 'storage'        // Object storage (S3, R2, Spaces)
  | 'search'         // Search engine (Elasticsearch, Algolia)
  // Infrastructure
  | 'api_gateway'    // API Gateway / reverse proxy
  | 'load_balancer'  // Load balancer
  | 'cdn'            // Content delivery network
  | 'dns'            // DNS service
  | 'firewall'       // WAF / firewall
  // Platform Services
  | 'auth'           // Authentication service (Auth0, Cognito)
  | 'monitoring'     // Monitoring / observability
  | 'logging'        // Log aggregation
  | 'secrets'        // Secret management (Vault)
  | 'registry'       // Container registry
  // External / Third-party
  | 'email'          // Email service (SES, SendGrid)
  | 'payment'        // Payment processor (Stripe)
  | 'analytics'      // Analytics (Segment, Mixpanel)
  | 'ml_model'       // ML model / AI service
  | 'third_party';   // Generic external service

interface ArchComponent {
  id: string;
  name: string;
  type: ComponentType;
  x: number;
  y: number;
}

interface ArchConnection {
  from: string;
  to: string;
  label?: string; // Connection label (e.g., "ML Features", "auth data")
}

interface ManualArchitecture {
  name: string;
  components: ArchComponent[];
  connections: ArchConnection[];
}

// Template interface for architecture_templates.json
interface ArchitectureTemplate {
  name: string;
  description: string;
  tier: string;
  components: Array<{
    type: string;
    name: string;
    description: string;
  }>;
  connections: Array<{
    from: string;
    to: string;
    protocol: string;
  }>;
  scalability: string;
  source_patterns: string[];
}

interface ArchitectureTemplatesFile {
  version: string;
  templates: ArchitectureTemplate[];
}

// Icon mapping based on template tier
const TEMPLATE_ICONS: Record<string, string> = {
  'two-tier': '🌐',
  'three-tier': '🔷',
  'microservices': '⚙️',
};

// Load and transform templates from architecture_templates.json
function loadArchitectureTemplates(): Record<string, { name: string; description: string; icon: string; architecture: ManualArchitecture }> {
  const templates: Record<string, { name: string; description: string; icon: string; architecture: ManualArchitecture }> = {};

  try {
    // Get the directory of the current module and resolve to data folder
    // Try multiple paths to support both dev (tsx) and compiled (dist) modes
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);

    // Try paths in order: cwd/data, 4 levels up (compiled), 3 levels up (dev)
    const possiblePaths = [
      join(process.cwd(), 'data', 'architecture_templates.json'),
      join(__dirname, '..', '..', '..', '..', 'data', 'architecture_templates.json'),
      join(__dirname, '..', '..', '..', 'data', 'architecture_templates.json'),
    ];

    let templatesPath = '';
    for (const p of possiblePaths) {
      try {
        readFileSync(p);
        templatesPath = p;
        break;
      } catch {}
    }

    if (!templatesPath) {
      throw new Error('Could not find architecture_templates.json');
    }

    const fileContent = readFileSync(templatesPath, 'utf-8');
    const templatesData: ArchitectureTemplatesFile = JSON.parse(fileContent);

    for (const template of templatesData.templates) {
      // Generate a slug ID from the template name
      const id = template.name.toLowerCase().replace(/\s+/g, '-');

      // Build component list with positions
      // Use a grid layout algorithm to position components
      const components: ArchComponent[] = [];
      const componentNameToId: Record<string, string> = {};

      // Calculate positions based on number of components
      // Arrange in a flow pattern: top to bottom, with horizontal distribution at each level
      const numComponents = template.components.length;
      const canvasWidth = 600;
      const canvasHeight = 500;
      const startY = 80;
      const rowHeight = 140;

      // Group components by their rough "layer" based on connections
      // For simplicity, we'll use the order they appear and distribute evenly
      template.components.forEach((comp, index) => {
        const compId = String.fromCharCode(65 + index); // A, B, C, ...
        componentNameToId[comp.name] = compId;

        // Calculate row and column for positioning
        const row = Math.floor(index / 3);
        const colCount = Math.min(3, numComponents - row * 3);
        const col = index % 3;

        // Center components horizontally within their row
        const xSpacing = canvasWidth / (colCount + 1);
        const x = xSpacing * (col + 1);
        const y = startY + row * rowHeight;

        // Map component type - architecture_templates.json uses static_site, service, database, worker
        // which matches our ArchComponent type definition
        const type = comp.type as ArchComponent['type'];

        components.push({
          id: compId,
          name: comp.name,
          type,
          x,
          y,
        });
      });

      // Build connections using component name to ID mapping
      const connections: ArchConnection[] = template.connections
        .filter(conn => componentNameToId[conn.from] && componentNameToId[conn.to])
        .map(conn => ({
          from: componentNameToId[conn.from],
          to: componentNameToId[conn.to],
        }));

      templates[id] = {
        name: template.name,
        description: template.description,
        icon: TEMPLATE_ICONS[template.tier] || '📦',
        architecture: {
          name: id,
          components,
          connections,
        },
      };
    }
  } catch (error) {
    // If we can't load the file, log a warning but don't crash
    console.error('Warning: Could not load architecture templates:', error);
  }

  // Always include blank canvas template
  templates['blank'] = {
    name: 'Blank Canvas',
    description: 'Start from scratch',
    icon: '📐',
    architecture: {
      name: 'my-app',
      components: [],
      connections: [],
    },
  };

  return templates;
}

// Load templates from JSON file
const TEMPLATES = loadArchitectureTemplates();

export const uiCommand = new Command('ui')
  .description('Launch the visual architecture designer in your browser')
  .option('-p, --port <port>', 'Port to run the server on', '3333')
  .option('--no-open', 'Do not automatically open the browser')
  .action(async (options: { port: string; open: boolean }) => {
    const port = parseInt(options.port, 10);

    let conversationHistory: Message[] = [];
    let currentDiagram: string | null = null;
    let selectedModel: string | null = null;
    let currentProject: ProjectData = {
      files: new Map(),
      componentSpecs: {},
    };
    let currentProjectId: string | null = null;
    let isGeneratingCode = false;
    let manualArchitecture: ManualArchitecture | null = null;
    let nextComponentId = 1;

    // Helper to generate unique IDs
    function generateId(): string {
      return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // Helper to save current project state (used internally, docs passed via API)
    function saveCurrentProject(name?: string, documentation?: string) {
      if (!currentProjectId) {
        currentProjectId = generateId();
      }
      const projectName = name || manualArchitecture?.name || 'Untitled Project';
      const project: SavedProject = {
        id: currentProjectId,
        name: projectName,
        slug: savedProjects.get(currentProjectId)?.slug || slugify(projectName),
        createdAt: savedProjects.get(currentProjectId)?.createdAt || new Date(),
        editedAt: new Date(),
        architecture: manualArchitecture,
        componentSpecs: currentProject.componentSpecs,
        diagram: currentDiagram,
        documentation: documentation || savedProjects.get(currentProjectId)?.documentation || '',
      };
      savedProjects.set(currentProjectId, project);
      return project;
    }

    // Helper to convert manual architecture to IR format
    function manualToIR(arch: ManualArchitecture) {
      return {
        name: arch.name,
        components: arch.components.map(c => ({
          id: c.id,
          name: c.name,
          type: c.type,
          connections: arch.connections
            .filter(conn => conn.from === c.id)
            .map(conn => conn.to),
        })),
      };
    }

    // Helper to generate Mermaid from manual architecture
    function manualToMermaid(arch: ManualArchitecture): string {
      const lines = ['flowchart TD'];
      lines.push(`    %% brick:name=${arch.name}`);

      const shapes: Record<string, [string, string]> = {
        service: ['[', ']'],
        static_site: ['([', '])'],
        database: ['[(', ')]'],
        worker: ['((', '))'],
        job: ['{{', '}}'],
      };

      for (const c of arch.components) {
        const [open, close] = shapes[c.type] || ['[', ']'];
        lines.push(`    ${c.id}${open}${c.name}${close}`);
      }

      for (const conn of arch.connections) {
        lines.push(`    ${conn.from} --> ${conn.to}`);
      }

      return lines.join('\n');
    }

    const server = createServer(async (req, res) => {
      const url = new URL(req.url || '/', `http://localhost:${port}`);

      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      if (url.pathname === '/' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(getHtmlPage());
        return;
      }

      // Landing page preview
      if (url.pathname === '/landing' && req.method === 'GET') {
        try {
          // Try multiple paths to handle both dev (tsx) and compiled (node) modes
          const possiblePaths = [
            join(process.cwd(), 'src', 'landing', 'index.html'),
            join(process.cwd(), 'landing', 'index.html'),
          ];
          let landingHtml = '';
          for (const landingPath of possiblePaths) {
            try {
              landingHtml = readFileSync(landingPath, 'utf-8');
              break;
            } catch {
              continue;
            }
          }
          if (!landingHtml) {
            throw new Error('Landing page not found');
          }
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(landingHtml);
          return;
        } catch (error) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Landing page not found. Make sure src/landing/index.html exists.');
          return;
        }
      }

      // Claude Code agent — SSE stream
      if (url.pathname === '/api/agent/claude-code' && req.method === 'POST') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        });

        try {
          const body = await getRequestBody(req);
          const { instruction } = JSON.parse(body);

          if (!instruction || typeof instruction !== 'string') {
            res.write(`data: ${JSON.stringify({ type: 'error', content: 'Missing instruction' })}\n\n`);
            res.end();
            return;
          }

          const { executeClaudeCode, cancelClaudeCode } = await import('../../agent/claude-code.js');

          // Cancel on client disconnect
          req.on('close', () => {
            cancelClaudeCode();
          });

          // Stream Claude Code events
          for await (const event of executeClaudeCode(instruction, process.cwd())) {
            res.write(`data: ${JSON.stringify(event)}\n\n`);
          }
        } catch (error) {
          res.write(`data: ${JSON.stringify({ type: 'error', content: (error as Error).message })}\n\n`);
        }

        res.end();
        return;
      }

      // Claude Code agent — cancel
      if (url.pathname === '/api/agent/claude-code/cancel' && req.method === 'POST') {
        const { cancelClaudeCode } = await import('../../agent/claude-code.js');
        const cancelled = cancelClaudeCode();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ cancelled }));
        return;
      }

      // Streaming generate endpoint
      if (url.pathname === '/api/generate-stream' && req.method === 'POST') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        });

        try {
          const body = await getRequestBody(req);
          const { message, reset } = JSON.parse(body);

          if (reset) {
            conversationHistory = [];
            currentDiagram = null;
          }

          const systemPrompt = currentDiagram
            ? `${SYSTEM_PROMPT}\n\n## Current Architecture\n\`\`\`mermaid\n${currentDiagram}\n\`\`\`\n\nModify the architecture based on the user's request. Output the complete updated diagram.`
            : `${SYSTEM_PROMPT}\n\n## Few-Shot Examples\n\n${formatExamplesForPrompt()}`;

          const messages: ChatMessage[] = [
            ...conversationHistory.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
            { role: 'user' as const, content: message }
          ];

          // Get config with selected model override
          let config;
          try {
            config = getLLMConfig();
            if (selectedModel) {
              config = { ...config, model: selectedModel };
            }
          } catch (e) {
            res.write(`data: ${JSON.stringify({ error: (e as Error).message })}\n\n`);
            res.end();
            return;
          }

          let fullContent = '';

          for await (const chunk of chatStream(systemPrompt, messages, config)) {
            fullContent += chunk;
            res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
          }

          // Extract diagram from full response
          const diagram = extractMermaidBlock(fullContent);
          const explanation = extractExplanation(fullContent, diagram);

          conversationHistory.push({ role: 'user', content: message });
          conversationHistory.push({ role: 'assistant', content: fullContent });

          if (diagram) {
            currentDiagram = diagram;
          }

          // Calculate cost and IR
          let costEstimate = null;
          let ir = null;
          if (currentDiagram) {
            try {
              const ast = parse(currentDiagram);
              ir = transform(ast);
              const yaml = generate(ir);
              const appspec = YAML.parse(yaml);
              costEstimate = estimateCost(appspec);
            } catch {
              // Ignore
            }
          }

          res.write(`data: ${JSON.stringify({ done: true, diagram: currentDiagram, explanation, cost: costEstimate, ir })}\n\n`);
          res.end();
        } catch (error) {
          res.write(`data: ${JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' })}\n\n`);
          res.end();
        }
        return;
      }

      if (url.pathname === '/api/build' && req.method === 'POST') {
        try {
          const body = await getRequestBody(req);
          const { componentSpecs: specs } = body ? JSON.parse(body) : {};

          if (!currentDiagram) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'No diagram to build' }));
            return;
          }

          const ast = parse(currentDiagram);
          const ir = transform(ast);
          const yaml = generate(ir);
          const appspec = YAML.parse(yaml);
          const validation = validate(appspec);
          const cost = estimateCost(appspec);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ yaml, validation, cost, ir, componentSpecs: specs }));
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }));
        }
        return;
      }

      if (url.pathname === '/api/reset' && req.method === 'POST') {
        conversationHistory = [];
        currentDiagram = null;
        currentProject = { files: new Map(), componentSpecs: {} };
        manualArchitecture = null;
        nextComponentId = 1;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
      }

      if (url.pathname === '/api/config' && req.method === 'GET') {
        try {
          const config = getLLMConfig();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            model: selectedModel || config.model,
            provider: config.provider,
            models: POPULAR_MODELS,
          }));
        } catch (error) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            model: selectedModel || 'Not configured',
            provider: 'None',
            models: POPULAR_MODELS,
            error: error instanceof Error ? error.message : 'Unknown error',
          }));
        }
        return;
      }

      if (url.pathname === '/api/model' && req.method === 'POST') {
        try {
          const body = await getRequestBody(req);
          const { model } = JSON.parse(body);
          selectedModel = model;
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, model: selectedModel }));
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }));
        }
        return;
      }

      // Code generation endpoint (streaming)
      if (url.pathname === '/api/generate-code' && req.method === 'POST') {
        if (isGeneratingCode) {
          res.writeHead(429, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Code generation already in progress' }));
          return;
        }

        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        });

        try {
          isGeneratingCode = true;
          const body = await getRequestBody(req);
          const { componentSpecs } = body ? JSON.parse(body) : {};

          if (!currentDiagram) {
            res.write(`data: ${JSON.stringify({ error: 'No architecture to generate code from' })}\n\n`);
            res.end();
            isGeneratingCode = false;
            return;
          }

          // Parse architecture to get components
          const ast = parse(currentDiagram);
          const ir = transform(ast);

          // Merge component specs
          const components: Component[] = ir.components.map((c: { id: string; name: string; type: string; connections?: string[] }) => ({
            id: c.id,
            name: c.name,
            type: c.type,
            connections: c.connections || [],
            spec: componentSpecs?.[c.id] || {},
          }));

          // Store specs
          currentProject.componentSpecs = componentSpecs || {};

          // Get LLM config
          let config;
          try {
            config = getLLMConfig();
            if (selectedModel) {
              config = { ...config, model: selectedModel };
            }
          } catch (e) {
            res.write(`data: ${JSON.stringify({ error: (e as Error).message })}\n\n`);
            res.end();
            isGeneratingCode = false;
            return;
          }

          // Step 1: Plan the file structure
          res.write(`data: ${JSON.stringify({ status: 'planning', message: 'Planning file structure...' })}\n\n`);

          const plan = await planCodeStructure(components, ir.name || 'app', config);

          res.write(`data: ${JSON.stringify({ status: 'planned', files: plan.files.map(f => f.path) })}\n\n`);

          // Step 2: Generate files one by one
          const existingFiles = new Map<string, string>();
          const generatedFiles: GeneratedFile[] = [];

          for (let i = 0; i < plan.files.length; i++) {
            const file = plan.files[i];
            res.write(`data: ${JSON.stringify({
              status: 'generating',
              file: file.path,
              progress: i,
              total: plan.files.length
            })}\n\n`);

            try {
              const generated = await generateFile({
                file,
                components,
                existingFiles,
                config,
              });

              generatedFiles.push(generated);
              existingFiles.set(file.path, generated.content);

              // Store in project
              currentProject.files.set(file.path, {
                path: file.path,
                content: generated.content,
                componentId: file.componentId,
                generatedAt: new Date(),
                isManuallyEdited: false,
              });

              res.write(`data: ${JSON.stringify({
                status: 'file_complete',
                file: file.path,
                content: generated.content,
                componentId: file.componentId,
              })}\n\n`);
            } catch (error) {
              res.write(`data: ${JSON.stringify({
                status: 'file_error',
                file: file.path,
                error: error instanceof Error ? error.message : 'Unknown error',
              })}\n\n`);
            }
          }

          // Stash artifacts to disk for persistence
          const savedProject = currentProjectId ? savedProjects.get(currentProjectId) : null;
          if (savedProject) {
            const artifactSlug = savedProject.slug;
            const hasExisting = await hasStashedArtifacts(artifactSlug);
            if (!hasExisting) {
              const artifactFiles = Array.from(currentProject.files.values()).map(f => ({
                path: f.path,
                content: f.content,
                componentId: f.componentId,
              }));
              await stashArtifacts(artifactSlug, savedProject.id, artifactFiles);
            }
          }

          res.write(`data: ${JSON.stringify({ status: 'complete', fileCount: generatedFiles.length })}\n\n`);
          res.end();
        } catch (error) {
          res.write(`data: ${JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' })}\n\n`);
          res.end();
        } finally {
          isGeneratingCode = false;
        }
        return;
      }

      // Get all project files
      if (url.pathname === '/api/files' && req.method === 'GET') {
        const files = Array.from(currentProject.files.values()).map(f => ({
          path: f.path,
          componentId: f.componentId,
          isManuallyEdited: f.isManuallyEdited,
        }));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ files }));
        return;
      }

      // Get single file content
      if (url.pathname === '/api/file' && req.method === 'GET') {
        const filePath = url.searchParams.get('path');
        if (!filePath) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing path parameter' }));
          return;
        }

        const file = currentProject.files.get(filePath);
        if (!file) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'File not found' }));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(file));
        return;
      }

      // Update file content
      if (url.pathname === '/api/file' && req.method === 'PUT') {
        try {
          const body = await getRequestBody(req);
          const { path: filePath, content } = JSON.parse(body);

          const file = currentProject.files.get(filePath);
          if (!file) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'File not found' }));
            return;
          }

          file.content = content;
          file.isManuallyEdited = true;
          currentProject.files.set(filePath, file);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }));
        }
        return;
      }

      // Download project as zip
      if (url.pathname === '/api/download' && req.method === 'GET') {
        // For now, return a JSON with all files (proper zip would need a library)
        const files = Array.from(currentProject.files.values()).map(f => ({
          path: f.path,
          content: f.content,
        }));
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Content-Disposition': 'attachment; filename="project.json"',
        });
        res.end(JSON.stringify({ files }, null, 2));
        return;
      }

      // Source files - read real project files from filesystem
      if (url.pathname === '/api/source-files' && req.method === 'GET') {
        const sourceDir = join(process.cwd(), 'src');
        const allowedExts = new Set(['.ts', '.js', '.json', '.md', '.html', '.css']);
        const skipDirs = new Set(['node_modules', '.git', 'dist', '.next', '__pycache__']);
        const maxFileSize = 100 * 1024; // 100KB

        function walkDir(dir: string, prefix = ''): Array<{ path: string; content: string }> {
          const results: Array<{ path: string; content: string }> = [];
          try {
            const entries = readdirSync(dir);
            for (const entry of entries) {
              if (skipDirs.has(entry)) continue;
              const fullPath = join(dir, entry);
              try {
                const stat = statSync(fullPath);
                if (stat.isDirectory()) {
                  results.push(...walkDir(fullPath, prefix ? prefix + '/' + entry : entry));
                } else if (stat.isFile() && stat.size <= maxFileSize) {
                  const ext = entry.slice(entry.lastIndexOf('.'));
                  if (allowedExts.has(ext)) {
                    const relPath = prefix ? prefix + '/' + entry : entry;
                    results.push({ path: relPath, content: readFileSync(fullPath, 'utf-8') });
                  }
                }
              } catch { continue; }
            }
          } catch { /* dir not readable */ }
          return results;
        }

        const files: Array<{ path: string; content: string; componentId: string | null }> = walkDir(sourceDir).map(f => ({
          path: 'src/' + f.path,
          content: f.content,
          componentId: null,
        }));

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ files }));
        return;
      }

      // === TEMPLATE & MANUAL ARCHITECTURE ENDPOINTS ===

      // Get available templates
      if (url.pathname === '/api/templates' && req.method === 'GET') {
        const templates = Object.entries(TEMPLATES).map(([id, t]) => ({
          id,
          name: t.name,
          description: t.description,
          icon: t.icon,
          componentCount: t.architecture.components.length,
        }));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ templates }));
        return;
      }

      // Get single template details for preview
      if (url.pathname.startsWith('/api/templates/') && req.method === 'GET') {
        const templateId = url.pathname.replace('/api/templates/', '');
        const template = TEMPLATES[templateId];
        if (!template) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Template not found' }));
          return;
        }

        // Define tech stack options for each component type
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

        // Build detailed component info
        const components = template.architecture.components.map(c => ({
          id: c.id,
          name: c.name,
          type: c.type,
          techOptions: techStackOptions[c.type] || ['Custom'],
          defaultTech: (techStackOptions[c.type] || ['Custom'])[0],
        }));

        // Generate template description based on type
        const descriptions: Record<string, string> = {
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

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          id: templateId,
          name: template.name,
          description: template.description,
          longDescription: descriptions[templateId] || template.description,
          icon: template.icon,
          components,
          connections: template.architecture.connections,
        }));
        return;
      }

      // Load a template
      if (url.pathname === '/api/template' && req.method === 'POST') {
        try {
          const body = await getRequestBody(req);
          const { templateId } = JSON.parse(body);

          const template = TEMPLATES[templateId];
          if (!template) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Template not found' }));
            return;
          }

          // Deep clone the template architecture
          manualArchitecture = JSON.parse(JSON.stringify(template.architecture));
          nextComponentId = Math.max(...manualArchitecture!.components.map(c => {
            const num = parseInt(c.id.replace(/\D/g, '')) || 0;
            return num;
          }), 0) + 1;

          // Generate Mermaid and IR
          currentDiagram = manualToMermaid(manualArchitecture!);
          const ir = manualToIR(manualArchitecture!);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ architecture: manualArchitecture, ir, diagram: currentDiagram }));
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }));
        }
        return;
      }

      // Get current manual architecture
      if (url.pathname === '/api/architecture' && req.method === 'GET') {
        if (!manualArchitecture) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ architecture: null }));
          return;
        }

        const ir = manualToIR(manualArchitecture);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ architecture: manualArchitecture, ir }));
        return;
      }

      // Add a component
      if (url.pathname === '/api/component' && req.method === 'POST') {
        try {
          const body = await getRequestBody(req);
          const { type, name, x, y } = JSON.parse(body);

          if (!manualArchitecture) {
            manualArchitecture = { name: 'my-app', components: [], connections: [] };
          }

          const id = String.fromCharCode(65 + nextComponentId++); // A, B, C, ...
          const component: ArchComponent = {
            id,
            name: name || type.charAt(0).toUpperCase() + type.slice(1),
            type,
            x: x || 300,
            y: y || 200,
          };

          manualArchitecture.components.push(component);
          currentDiagram = manualToMermaid(manualArchitecture);
          const ir = manualToIR(manualArchitecture);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ component, architecture: manualArchitecture, ir }));
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }));
        }
        return;
      }

      // Update a component (position, name)
      if (url.pathname === '/api/component' && req.method === 'PUT') {
        try {
          const body = await getRequestBody(req);
          const { id, name, x, y } = JSON.parse(body);

          if (!manualArchitecture) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'No architecture' }));
            return;
          }

          const component = manualArchitecture.components.find(c => c.id === id);
          if (!component) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Component not found' }));
            return;
          }

          if (name !== undefined) component.name = name;
          if (x !== undefined) component.x = x;
          if (y !== undefined) component.y = y;

          currentDiagram = manualToMermaid(manualArchitecture);
          const ir = manualToIR(manualArchitecture);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ component, architecture: manualArchitecture, ir }));
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }));
        }
        return;
      }

      // Delete a component
      if (url.pathname === '/api/component' && req.method === 'DELETE') {
        try {
          const id = url.searchParams.get('id');

          if (!manualArchitecture || !id) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'No architecture or missing id' }));
            return;
          }

          manualArchitecture.components = manualArchitecture.components.filter(c => c.id !== id);
          manualArchitecture.connections = manualArchitecture.connections.filter(
            c => c.from !== id && c.to !== id
          );

          currentDiagram = manualToMermaid(manualArchitecture);
          const ir = manualToIR(manualArchitecture);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ architecture: manualArchitecture, ir }));
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }));
        }
        return;
      }

      // Add a connection
      if (url.pathname === '/api/connection' && req.method === 'POST') {
        try {
          const body = await getRequestBody(req);
          const { from, to } = JSON.parse(body);

          if (!manualArchitecture) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'No architecture' }));
            return;
          }

          // Check if connection already exists
          const exists = manualArchitecture.connections.some(
            c => c.from === from && c.to === to
          );

          if (!exists) {
            manualArchitecture.connections.push({ from, to });
            currentDiagram = manualToMermaid(manualArchitecture);
          }

          const ir = manualToIR(manualArchitecture);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ architecture: manualArchitecture, ir }));
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }));
        }
        return;
      }

      // Delete a connection
      if (url.pathname === '/api/connection' && req.method === 'DELETE') {
        try {
          const from = url.searchParams.get('from');
          const to = url.searchParams.get('to');

          if (!manualArchitecture || !from || !to) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'No architecture or missing params' }));
            return;
          }

          manualArchitecture.connections = manualArchitecture.connections.filter(
            c => !(c.from === from && c.to === to)
          );

          currentDiagram = manualToMermaid(manualArchitecture);
          const ir = manualToIR(manualArchitecture);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ architecture: manualArchitecture, ir }));
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }));
        }
        return;
      }

      // Update architecture name
      if (url.pathname === '/api/architecture/name' && req.method === 'PUT') {
        try {
          const body = await getRequestBody(req);
          const { name } = JSON.parse(body);

          if (!manualArchitecture) {
            manualArchitecture = { name, components: [], connections: [] };
          } else {
            manualArchitecture.name = name;
          }

          currentDiagram = manualToMermaid(manualArchitecture);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }));
        }
        return;
      }

      // Get AI suggestions for current architecture
      if (url.pathname === '/api/suggestions' && req.method === 'GET') {
        try {
          if (!manualArchitecture || manualArchitecture.components.length === 0) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ suggestions: [] }));
            return;
          }

          // Analyze architecture and generate contextual suggestions
          const components = manualArchitecture.components;
          const connections = manualArchitecture.connections;
          const suggestions: Array<{ id: string; type: string; title: string; description: string; action?: string }> = [];

          // Check for common patterns and missing components
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

          // Performance suggestions
          if (hasDatabase && !hasCache) {
            suggestions.push({
              id: 'add-cache',
              type: 'performance',
              title: 'Add a caching layer',
              description: 'Redis or Memcached can reduce database load and improve response times by 10-100x for repeated queries.',
              action: 'Add Redis cache'
            });
          }

          // Scalability suggestions
          if (components.filter(c => c.type === 'service').length > 1 && !hasLoadBalancer) {
            suggestions.push({
              id: 'add-lb',
              type: 'scalability',
              title: 'Add a load balancer',
              description: 'Distribute traffic across multiple services for better availability and horizontal scaling.',
              action: 'Add Load Balancer'
            });
          }

          if (hasStaticSite && !hasCdn) {
            suggestions.push({
              id: 'add-cdn',
              type: 'performance',
              title: 'Add a CDN',
              description: 'Serve static assets from edge locations to reduce latency for global users.',
              action: 'Add CDN'
            });
          }

          // Reliability suggestions
          if (hasService && !hasQueue && !hasWorker) {
            suggestions.push({
              id: 'add-queue',
              type: 'reliability',
              title: 'Add async processing',
              description: 'Use a message queue with workers for long-running tasks to prevent request timeouts and improve UX.',
              action: 'Add message queue'
            });
          }

          // Security suggestions
          if ((hasService || hasStaticSite) && !hasAuth) {
            suggestions.push({
              id: 'add-auth',
              type: 'security',
              title: 'Add authentication',
              description: 'Protect your APIs and user data with a dedicated authentication service.',
              action: 'Add Auth service'
            });
          }

          // Observability suggestions
          if (components.length >= 3 && !hasMonitoring) {
            suggestions.push({
              id: 'add-monitoring',
              type: 'observability',
              title: 'Add monitoring',
              description: 'Track performance, errors, and usage patterns across your services.',
              action: 'Add Monitoring'
            });
          }

          // Connection suggestions - find isolated components
          const connectedIds = new Set([
            ...connections.map(c => c.from),
            ...connections.map(c => c.to)
          ]);
          const isolated = components.filter(c => !connectedIds.has(c.id));
          if (isolated.length > 0) {
            suggestions.push({
              id: 'connect-isolated',
              type: 'architecture',
              title: 'Connect isolated components',
              description: `${isolated.map(c => c.name).join(', ')} ${isolated.length === 1 ? 'is' : 'are'} not connected to any other components.`
            });
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ suggestions: suggestions.slice(0, 5) })); // Limit to top 5
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }));
        }
        return;
      }

      // === PROJECT MANAGEMENT ENDPOINTS ===

      // List all projects
      if (url.pathname === '/api/projects' && req.method === 'GET') {
        const projects = Array.from(savedProjects.values()).map(p => ({
          id: p.id,
          name: p.name,
          createdAt: p.createdAt,
          editedAt: p.editedAt,
          componentCount: p.architecture?.components.length || 0,
        })).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ projects }));
        return;
      }

      // Save current project
      if (url.pathname === '/api/projects' && req.method === 'POST') {
        try {
          const body = await getRequestBody(req);
          const { name, documentation } = body ? JSON.parse(body) : {};

          if (!currentProjectId) {
            currentProjectId = generateId();
          }
          const projectName = name || manualArchitecture?.name || 'Untitled Project';
          const project: SavedProject = {
            id: currentProjectId,
            name: projectName,
            slug: savedProjects.get(currentProjectId)?.slug || slugify(projectName),
            createdAt: savedProjects.get(currentProjectId)?.createdAt || new Date(),
            editedAt: new Date(),
            architecture: manualArchitecture,
            componentSpecs: currentProject.componentSpecs,
            diagram: currentDiagram,
            documentation: documentation || savedProjects.get(currentProjectId)?.documentation || '',
          };
          savedProjects.set(currentProjectId, project);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ project: { ...project, componentCount: project.architecture?.components.length || 0 } }));
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }));
        }
        return;
      }

      // Load a project
      if (url.pathname.startsWith('/api/projects/') && req.method === 'GET') {
        const projectId = url.pathname.replace('/api/projects/', '');
        const project = savedProjects.get(projectId);

        if (!project) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Project not found' }));
          return;
        }

        // Load the project into current state
        currentProjectId = project.id;
        manualArchitecture = project.architecture;
        currentProject.componentSpecs = project.componentSpecs;
        currentDiagram = project.diagram;
        conversationHistory = [];

        // Restore files from stashed artifacts
        currentProject.files.clear();
        const stashed = await loadArtifacts(project.slug);
        if (stashed) {
          for (const file of stashed.files) {
            currentProject.files.set(file.path, {
              path: file.path,
              content: file.content,
              componentId: file.componentId,
              generatedAt: new Date(stashed.manifest.generatedAt),
              isManuallyEdited: file.isManuallyEdited,
            });
          }
        }

        // Recalculate nextComponentId
        if (manualArchitecture?.components.length) {
          nextComponentId = Math.max(...manualArchitecture.components.map(c => {
            const num = parseInt(c.id.replace(/\D/g, '')) || 0;
            return num;
          }), 0) + 1;
        } else {
          nextComponentId = 1;
        }

        const ir = manualArchitecture ? manualToIR(manualArchitecture) : null;

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          project: { ...project, componentCount: project.architecture?.components.length || 0 },
          architecture: manualArchitecture,
          ir,
          diagram: currentDiagram,
          documentation: project.documentation || '',
          hasFiles: currentProject.files.size > 0,
        }));
        return;
      }

      // Delete a project
      if (url.pathname.startsWith('/api/projects/') && req.method === 'DELETE') {
        const projectId = url.pathname.replace('/api/projects/', '');
        const projectToDelete = savedProjects.get(projectId);

        if (!projectToDelete) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Project not found' }));
          return;
        }

        // Clean up stashed artifacts
        await deleteArtifacts(projectToDelete.slug);

        savedProjects.delete(projectId);

        // If we deleted the current project, clear state
        if (currentProjectId === projectId) {
          currentProjectId = null;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
      }

      // === COST ESTIMATION ENDPOINT ===

      // Estimate cost from components (for real-time pricing)
      if (url.pathname === '/api/cost' && req.method === 'POST') {
        try {
          const body = await getRequestBody(req);
          const { components } = JSON.parse(body);

          const cost = estimateCostFromComponents(components || []);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ cost }));
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }));
        }
        return;
      }

      // === SETTINGS ENDPOINTS ===

      // Get settings
      if (url.pathname === '/api/settings' && req.method === 'GET') {
        try {
          const config = getLLMConfig();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            model: selectedModel || config.model,
            provider: config.provider,
            projectCount: savedProjects.size,
          }));
        } catch (error) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            model: selectedModel || 'Not configured',
            provider: 'None',
            projectCount: savedProjects.size,
            error: error instanceof Error ? error.message : 'Unknown error',
          }));
        }
        return;
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    });

    server.listen(port, () => {
      const url = `http://localhost:${port}`;
      console.log(chalk.bold('\n🧱 Brick Studio\n'));
      console.log(chalk.dim(`Running at: ${chalk.cyan(url)}`));
      console.log(chalk.dim('\nPress Ctrl+C to stop\n'));

      if (options.open) {
        const openCommand = process.platform === 'darwin' ? 'open' :
          process.platform === 'win32' ? 'start' : 'xdg-open';
        import('child_process').then(({ exec }) => {
          exec(`${openCommand} ${url}`);
        });
      }
    });
  });

function extractMermaidBlock(content: string): string | null {
  const mermaidMatch = content.match(/```mermaid\n([\s\S]*?)```/);
  if (mermaidMatch) return mermaidMatch[1].trim();

  const genericMatch = content.match(/```\n?(flowchart[\s\S]*?)```/);
  if (genericMatch) return genericMatch[1].trim();

  return null;
}

function extractExplanation(content: string, diagram: string | null): string {
  if (!diagram) return content.trim();
  let explanation = content;
  explanation = explanation.replace(/```mermaid[\s\S]*?```/g, '');
  explanation = explanation.replace(/```[\s\S]*?```/g, '');
  return explanation.trim();
}

function getRequestBody(req: import('http').IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function getHtmlPage(): string {
  return `<!DOCTYPE html>
<html lang="en" class="antialiased">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Brick Studio | Visual Cloud Architect</title>
  <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  <script src="https://unpkg.com/dagre@0.8.5/dist/dagre.min.js"></script>
  <script src="https://unpkg.com/reactflow@11.10.1/dist/umd/index.js"></script>
  <link href="https://unpkg.com/reactflow@11.10.1/dist/style.css" rel="stylesheet">
  <script src="https://code.iconify.design/iconify-icon/1.0.7/iconify-icon.min.js"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" data-name="vs/editor/editor.main" href="https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs/editor/editor.main.css">
  <script>var require = { paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs' } };<\/script>
  <script src="https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs/loader.js"><\/script>
  <script src="https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs/editor/editor.main.nls.js"><\/script>
  <script src="https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs/editor/editor.main.js"><\/script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg-primary: #050505;
      --bg-secondary: #0a0a0a;
      --bg-tertiary: #171717;
      --bg-card: #171717;
      --border-color: #2a2a2a;
      --text-primary: #e5e5e5;
      --text-secondary: #737373;
      --accent: #6366f1;
      --accent-light: #818cf8;
      --success: #22c55e;
      --warning: #f59e0b;
      --error: #ef4444;
      --service: #6366f1;
      --static: #a855f7;
      --database: #22c55e;
      --worker: #f59e0b;
      --job: #ec4899;
    }

    /* Light theme */
    :root.light {
      --bg-primary: #ffffff;
      --bg-secondary: #f8fafc;
      --bg-tertiary: #f1f5f9;
      --bg-card: #ffffff;
      --border-color: #e2e8f0;
      --text-primary: #1e293b;
      --text-secondary: #64748b;
      --accent: #6366f1;
      --accent-light: #818cf8;
    }

    :root.light ::-webkit-scrollbar-thumb { background: #cbd5e1; }
    :root.light ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
    :root.light button { color: var(--text-primary); }
    :root.light button:hover { background: #e2e8f0; }
    :root.light button.primary { color: white; }
    :root.light .panel-header { color: var(--text-secondary); }
    :root.light .message-content { color: var(--text-primary); }
    :root.light .welcome h2 { color: var(--text-primary); }
    :root.light .welcome p { color: var(--text-secondary); }
    :root.light input, :root.light textarea {
      background: var(--bg-card);
      color: var(--text-primary);
      border-color: var(--border-color);
    }

    /* Auto theme (follows system preference) */
    @media (prefers-color-scheme: light) {
      :root.auto {
        --bg-primary: #ffffff;
        --bg-secondary: #f8fafc;
        --bg-tertiary: #f1f5f9;
        --bg-card: #ffffff;
        --border-color: #e2e8f0;
        --text-primary: #1e293b;
        --text-secondary: #64748b;
      }
      :root.auto ::-webkit-scrollbar-thumb { background: #cbd5e1; }
      :root.auto ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      :root.auto button { color: var(--text-primary); }
      :root.auto button:hover { background: #e2e8f0; }
      :root.auto button.primary { color: white; }
    }

    /* Custom Scrollbar */
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: #444; }

    /* Dot Pattern for Canvas */
    .bg-grid-pattern {
      background-color: #FAFAFA;
      background-image: radial-gradient(#D4D4D4 1px, transparent 1px);
      background-size: 24px 24px;
    }

    /* Animations */
    @keyframes fadeIn {
      0% { opacity: 0.9; transform: scale(0.99); }
      100% { opacity: 1; transform: scale(1); }
    }
    @keyframes slideUp {
      0% { transform: translateY(10px); opacity: 0; }
      100% { transform: translateY(0); opacity: 1; }
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    .animate-fade-in { animation: fadeIn 0.2s ease-out; }
    .animate-slide-up { animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
    .animate-pulse { animation: pulse 2s ease-in-out infinite; }
    .animate-spin { animation: spin 1s linear infinite; }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg-secondary);
      color: var(--text-primary);
      height: 100vh;
      overflow: hidden;
      font-size: 14px;
      -webkit-font-smoothing: antialiased;
    }
    .app {
      display: grid;
      grid-template-columns: 360px 1fr 300px;
      grid-template-rows: 56px 1fr;
      height: 100vh;
      overflow: hidden;
    }
    .app.code-view {
      grid-template-columns: 360px 240px 1fr 300px;
    }
    header {
      grid-column: 1 / -1;
      background: var(--bg-secondary);
      padding: 0 20px;
      display: flex;
      align-items: center;
      gap: 20px;
      border-bottom: 1px solid var(--border-color);
    }
    .logo {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 18px;
      font-weight: 700;
    }
    .logo-icon {
      font-size: 24px;
    }
    .header-spacer { flex: 1; }
    .model-select {
      background: var(--bg-tertiary);
      color: var(--text-primary);
      border: 1px solid var(--border-color);
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 13px;
      min-width: 220px;
      cursor: pointer;
    }
    .model-select:focus { outline: none; border-color: var(--accent); }
    .actions { display: flex; gap: 8px; }
    button {
      background: var(--bg-tertiary);
      color: var(--text-primary);
      border: 1px solid var(--border-color);
      padding: 8px 16px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      transition: all 0.15s;
    }
    button:hover { background: #2a2a2a; }
    button.primary { background: var(--accent); border-color: var(--accent); }
    button.primary:hover { background: var(--accent-light); }
    button:disabled { opacity: 0.5; cursor: not-allowed; }

    .chat-panel {
      background: var(--bg-secondary);
      border-right: 1px solid var(--border-color);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      transition: width 0.2s ease, min-width 0.2s ease;
    }
    .chat-panel.collapsed {
      width: 48px !important;
      min-width: 48px !important;
    }

    /* Live Preview Panel */
    .live-preview-panel {
      background: var(--bg-tertiary);
      border-radius: 8px;
      margin: 12px;
      margin-bottom: 0;
      padding: 12px;
      animation: fadeIn 0.3s ease;
    }
    .live-preview-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--accent);
    }
    .live-preview-header .pulse-dot {
      width: 6px;
      height: 6px;
      background: var(--accent);
      border-radius: 50%;
      animation: pulse 1.5s ease-in-out infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(1.2); }
    }
    .live-preview-components {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .preview-component {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 10px;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      font-size: 12px;
      animation: slideIn 0.2s ease;
    }
    @keyframes slideIn {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .preview-component-icon {
      width: 20px;
      height: 20px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
    }
    .preview-component-icon.service { background: #3B82F620; color: #3B82F6; }
    .preview-component-icon.static_site { background: #22C55E20; color: #22C55E; }
    .preview-component-icon.database { background: #F59E0B20; color: #F59E0B; }
    .preview-component-icon.worker { background: #8B5CF620; color: #8B5CF6; }
    .preview-component-icon.job { background: #EC489920; color: #EC4899; }
    .preview-component-name {
      font-weight: 500;
      color: var(--text-primary);
    }
    .preview-component-type {
      font-size: 10px;
      color: var(--text-secondary);
      text-transform: uppercase;
    }

    /* AI Suggestions Panel */
    .suggestions-panel {
      background: var(--bg-tertiary);
      border-radius: 8px;
      margin: 12px;
      padding: 12px;
      max-height: 200px;
      overflow-y: auto;
    }
    .suggestions-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 10px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-secondary);
    }
    .suggestion-card {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 10px;
      margin-bottom: 8px;
      cursor: pointer;
      transition: border-color 0.15s, background 0.15s;
    }
    .suggestion-card:last-child { margin-bottom: 0; }
    .suggestion-card:hover {
      border-color: var(--accent);
      background: var(--bg-card);
    }
    .suggestion-type {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 9px;
      font-weight: 600;
      text-transform: uppercase;
      padding: 2px 6px;
      border-radius: 4px;
      margin-bottom: 6px;
    }
    .suggestion-type.performance { background: #F59E0B20; color: #F59E0B; }
    .suggestion-type.scalability { background: #3B82F620; color: #3B82F6; }
    .suggestion-type.reliability { background: #22C55E20; color: #22C55E; }
    .suggestion-type.security { background: #EF444420; color: #EF4444; }
    .suggestion-type.observability { background: #8B5CF620; color: #8B5CF6; }
    .suggestion-type.architecture { background: #EC489920; color: #EC4899; }
    .suggestion-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 4px;
    }
    .suggestion-description {
      font-size: 11px;
      color: var(--text-secondary);
      line-height: 1.4;
    }
    .suggestion-action {
      margin-top: 8px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
      color: var(--accent);
      font-weight: 500;
    }
    .panel-header {
      padding: 14px 16px;
      font-size: 12px;
      font-weight: 600;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 1px solid var(--border-color);
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: pointer;
      user-select: none;
    }
    .panel-header:hover {
      background: var(--bg-tertiary);
    }
    .panel-collapse-btn {
      background: none;
      border: none;
      color: var(--text-secondary);
      font-size: 14px;
      cursor: pointer;
      padding: 2px 6px;
      border-radius: 4px;
      transition: all 0.15s;
    }
    .panel-collapse-btn:hover {
      background: var(--bg-primary);
      color: var(--text-primary);
    }
    .collapsed .panel-header {
      writing-mode: vertical-rl;
      text-orientation: mixed;
      padding: 16px 8px;
      justify-content: flex-start;
      gap: 8px;
    }
    .collapsed .panel-collapse-btn {
      transform: rotate(180deg);
    }
    .collapsed .panel-content,
    .collapsed .chat-messages,
    .collapsed .chat-input-area,
    .collapsed .cost-content,
    .collapsed .palette-section {
      display: none;
    }
    .chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
    }
    .message { margin-bottom: 16px; }
    .message-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
    }
    .message-avatar {
      width: 24px;
      height: 24px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      background: var(--bg-tertiary);
    }
    .message.assistant .message-avatar { background: var(--accent); }
    .message-role { font-size: 12px; font-weight: 600; }
    .message-content {
      background: var(--bg-card);
      padding: 12px 14px;
      border-radius: 10px;
      font-size: 13px;
      line-height: 1.6;
      margin-left: 32px;
      border: 1px solid var(--border-color);
      white-space: pre-wrap;
    }
    .chat-input-area {
      padding: 12px;
      border-top: 1px solid var(--border-color);
      flex-shrink: 0;
    }
    .chat-input {
      width: 100%;
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 10px;
      padding: 12px 14px;
      color: var(--text-primary);
      font-size: 13px;
      resize: none;
      font-family: inherit;
      margin-bottom: 8px;
    }
    .chat-input:focus { outline: none; border-color: var(--accent); }
    .chat-input::placeholder { color: var(--text-secondary); }

    /* Canvas Chat Mode Toggle (dark theme) */
    .canvas-mode-toggle {
      display: flex; gap: 2px; background: var(--bg-primary);
      border-radius: 6px; padding: 2px; margin-right: auto;
    }
    .canvas-mode-btn {
      padding: 3px 10px; border: none; background: transparent;
      border-radius: 4px; font-size: 10px; font-weight: 700;
      cursor: pointer; color: var(--text-secondary); transition: all 0.15s;
      text-transform: uppercase; letter-spacing: 0.05em;
    }
    .canvas-mode-btn.active { background: var(--bg-tertiary); color: var(--text-primary); }
    .canvas-mode-btn:hover:not(.active) { color: var(--text-primary); }

    /* Dev mode system messages (canvas) */
    .dev-message { margin-bottom: 8px; }
    .dev-message.system-msg {
      color: var(--text-secondary); font-size: 11px;
      font-family: 'JetBrains Mono', monospace; padding: 2px 0 2px 10px;
      border-left: 2px solid var(--accent);
    }
    .dev-message.user-msg {
      background: var(--bg-tertiary); border: 1px solid var(--border-color);
      border-radius: 8px; padding: 8px 12px; margin-left: 32px; font-size: 13px;
    }
    .dev-message.assistant-msg {
      border: 1px solid var(--border-color); border-radius: 8px;
      padding: 8px 12px; margin-left: 32px; font-size: 13px;
      line-height: 1.6; white-space: pre-wrap;
    }
    .dev-cancel-btn {
      background: var(--error); color: white; border: none; border-radius: 6px;
      padding: 4px 12px; font-size: 11px; cursor: pointer; margin: 4px 0 4px 32px;
    }

    .welcome { text-align: center; padding: 30px 16px; }
    .welcome h2 { font-size: 18px; margin-bottom: 8px; font-weight: 600; }
    .welcome p { color: var(--text-secondary); margin-bottom: 20px; font-size: 13px; }
    .examples { display: flex; flex-direction: column; gap: 8px; }
    .example-btn {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 12px;
      text-align: left;
    }
    .example-btn:hover { border-color: var(--accent); }

    .diagram-panel {
      background: #FAFAFA;
      position: relative;
      overflow: hidden;
    }
    .diagram-panel .react-flow {
      background: #FAFAFA;
    }
    .diagram-panel .react-flow__background {
      background: #FAFAFA;
    }

    /* React Flow Custom Node Styles - Railway.app Inspired */
    .rf-node {
      background: white;
      border: 1px solid #E2E8F0;
      border-radius: 12px;
      min-width: 220px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03);
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      font-family: 'Inter', system-ui, sans-serif;
      overflow: hidden;
      position: relative;
    }
    /* Colored left border indicator based on component type */
    .rf-node::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 4px;
      background: var(--node-accent-color, #6366F1);
      border-radius: 12px 0 0 12px;
    }
    .rf-node:hover {
      box-shadow: 0 4px 12px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.06);
      border-color: #CBD5E1;
      transform: translateY(-1px);
    }
    .rf-node.selected {
      border-color: var(--node-accent-color, #6366F1);
      box-shadow: 0 0 0 2px rgba(99,102,241,0.15), 0 4px 16px rgba(99,102,241,0.12);
    }
    /* Deployment status glow effects */
    .rf-node.deploying {
      animation: deployingPulse 2s ease-in-out infinite;
    }
    .rf-node.live {
      border-color: #22C55E;
      box-shadow: 0 0 0 1px rgba(34, 197, 94, 0.2), 0 4px 12px rgba(34, 197, 94, 0.1);
    }
    .rf-node.failed {
      border-color: #EF4444;
      box-shadow: 0 0 0 1px rgba(239, 68, 68, 0.2), 0 4px 12px rgba(239, 68, 68, 0.1);
    }
    @keyframes deployingPulse {
      0%, 100% { box-shadow: 0 0 0 1px rgba(99, 102, 241, 0.2), 0 4px 12px rgba(99, 102, 241, 0.1); }
      50% { box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.3), 0 4px 20px rgba(99, 102, 241, 0.2); }
    }
    .rf-node-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 16px;
      border-bottom: 1px solid #F1F5F9;
    }
    .rf-node-icon {
      width: 36px;
      height: 36px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .rf-node-info {
      flex: 1;
      min-width: 0;
    }
    .rf-node-name {
      font-size: 13px;
      font-weight: 600;
      color: #1E293B;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .rf-node-type {
      font-size: 10px;
      font-weight: 500;
      color: #94A3B8;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 2px;
    }
    .rf-node-body {
      padding: 12px 16px;
    }
    .rf-node-inner-items {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .rf-node-inner-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 6px;
      font-size: 11px;
      color: #475569;
      transition: background 0.15s;
    }
    .rf-node-inner-item:hover {
      background: #F1F5F9;
    }
    .rf-node-inner-item-icon {
      width: 16px;
      height: 16px;
      color: #94A3B8;
      flex-shrink: 0;
    }
    .rf-node-inner-item-name {
      font-weight: 500;
      color: #334155;
    }
    .rf-node-inner-item-desc {
      color: #94A3B8;
      font-size: 10px;
    }
    .rf-node-status {
      padding: 10px 16px;
      border-top: 1px solid #F1F5F9;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 10px;
      color: #94A3B8;
    }
    .rf-node-status-indicator {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .rf-node-status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #CBD5E1;
      flex-shrink: 0;
    }
    .rf-node-status-dot.configured {
      background: #94A3B8;
    }
    .rf-node-status-dot.deploying {
      background: #6366F1;
      animation: statusPulse 1.5s ease-in-out infinite;
    }
    .rf-node-status-dot.live {
      background: #22C55E;
      box-shadow: 0 0 8px rgba(34, 197, 94, 0.5);
    }
    .rf-node-status-dot.failed {
      background: #EF4444;
      box-shadow: 0 0 8px rgba(239, 68, 68, 0.5);
    }
    @keyframes statusPulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.6; transform: scale(0.85); }
    }
    .rf-node-actions {
      display: flex;
      gap: 4px;
      opacity: 0;
      transition: opacity 0.15s;
    }
    .rf-node:hover .rf-node-actions {
      opacity: 1;
    }
    .rf-node-action-btn {
      width: 22px;
      height: 22px;
      border-radius: 4px;
      border: none;
      background: #F1F5F9;
      color: #64748B;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      transition: all 0.15s;
    }
    .rf-node-action-btn:hover {
      background: #E2E8F0;
      color: #334155;
    }
    .rf-node-action-btn.delete:hover {
      background: #FEE2E2;
      color: #DC2626;
    }

    /* Environment Tabs */
    .env-tabs-container {
      position: absolute;
      top: 16px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 50;
      display: flex;
      background: rgba(23, 23, 23, 0.95);
      border: 1px solid #333;
      border-radius: 10px;
      padding: 4px;
      gap: 2px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.4);
      backdrop-filter: blur(8px);
    }
    .env-tab {
      padding: 8px 16px;
      font-size: 12px;
      font-weight: 500;
      color: #737373;
      background: transparent;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: all 0.15s;
    }
    .env-tab:hover {
      color: #a3a3a3;
      background: rgba(255,255,255,0.05);
    }
    .env-tab.active {
      color: white;
      background: rgba(255,255,255,0.1);
    }
    .env-tab-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #404040;
    }
    .env-tab.active .env-tab-dot {
      background: #22C55E;
      box-shadow: 0 0 8px rgba(34, 197, 94, 0.5);
    }
    .env-tab.deploying .env-tab-dot {
      background: #6366F1;
      animation: envPulse 1.5s ease-in-out infinite;
    }
    @keyframes envPulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
    .env-tab-status {
      font-size: 10px;
      color: #525252;
      font-family: 'JetBrains Mono', monospace;
    }
    .env-tab.active .env-tab-status {
      color: #22C55E;
    }

    /* React Flow Handles */
    .react-flow__handle {
      width: 10px;
      height: 10px;
      border: 2px solid #94A3B8;
      background: white;
      transition: all 0.15s;
    }
    .react-flow__handle:hover {
      background: #6366F1;
      border-color: #6366F1;
      transform: scale(1.2);
    }
    .react-flow__handle-top {
      top: -5px;
    }
    .react-flow__handle-bottom {
      bottom: -5px;
    }
    .react-flow__handle.connecting {
      background: #6366F1;
      border-color: #6366F1;
    }
    .react-flow__handle.valid {
      background: #22C55E;
      border-color: #22C55E;
    }

    /* React Flow Edges */
    .react-flow__edge-path {
      stroke: #94A3B8;
      stroke-width: 2;
    }
    .react-flow__edge.selected .react-flow__edge-path,
    .react-flow__edge:hover .react-flow__edge-path {
      stroke: #6366F1;
      stroke-width: 2.5;
    }
    .react-flow__edge-text {
      font-size: 10px;
      fill: #64748B;
    }

    /* React Flow Controls */
    .react-flow__controls {
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      border-radius: 8px;
      overflow: hidden;
    }
    .react-flow__controls-button {
      width: 28px;
      height: 28px;
      background: white;
      border: none;
      border-bottom: 1px solid #E2E8F0;
    }
    .react-flow__controls-button:hover {
      background: #F1F5F9;
    }

    /* React Flow MiniMap */
    .react-flow__minimap {
      background: #1A1A1A !important;
      border-radius: 8px;
      border: 1px solid #2A2A2A;
      box-shadow: 0 4px 16px rgba(0,0,0,0.4);
    }
    .react-flow__minimap svg {
      background: #1A1A1A !important;
    }

    /* Command Palette (CMD+K) */
    .command-palette-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding-top: 15vh;
      z-index: 9999;
      animation: fadeIn 0.15s ease-out;
    }
    .command-palette {
      width: 560px;
      max-height: 480px;
      background: #1A1A1A;
      border: 1px solid #333;
      border-radius: 12px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      animation: slideDown 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes slideDown {
      from { opacity: 0; transform: translateY(-8px) scale(0.98); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    .command-palette-input-wrapper {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 20px;
      border-bottom: 1px solid #333;
    }
    .command-palette-input-wrapper iconify-icon {
      color: #737373;
      flex-shrink: 0;
    }
    .command-palette-input {
      flex: 1;
      background: transparent;
      border: none;
      outline: none;
      font-size: 16px;
      color: white;
      font-family: inherit;
    }
    .command-palette-input::placeholder {
      color: #525252;
    }
    .command-palette-kbd {
      font-size: 11px;
      color: #525252;
      background: #262626;
      padding: 4px 8px;
      border-radius: 4px;
      font-family: 'SF Mono', Monaco, monospace;
    }
    .command-palette-results {
      flex: 1;
      overflow-y: auto;
      padding: 8px;
    }
    .command-palette-section {
      padding: 8px 12px 4px;
      font-size: 10px;
      font-weight: 600;
      color: #525252;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .command-palette-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.1s;
    }
    .command-palette-item:hover,
    .command-palette-item.selected {
      background: #262626;
    }
    .command-palette-item.selected {
      background: rgba(99, 102, 241, 0.15);
    }
    .command-palette-item-icon {
      width: 32px;
      height: 32px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .command-palette-item-info {
      flex: 1;
      min-width: 0;
    }
    .command-palette-item-name {
      font-size: 13px;
      font-weight: 500;
      color: white;
    }
    .command-palette-item-desc {
      font-size: 11px;
      color: #737373;
      margin-top: 2px;
    }
    .command-palette-item-shortcut {
      font-size: 11px;
      color: #525252;
      font-family: 'SF Mono', Monaco, monospace;
    }
    .command-palette-empty {
      padding: 32px 20px;
      text-align: center;
      color: #525252;
      font-size: 13px;
    }
    .command-palette-footer {
      padding: 10px 16px;
      border-top: 1px solid #333;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 11px;
      color: #525252;
    }
    .command-palette-footer-hints {
      display: flex;
      gap: 16px;
    }
    .command-palette-footer-hint {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .command-palette-footer-hint kbd {
      background: #262626;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'SF Mono', Monaco, monospace;
      font-size: 10px;
    }

    /* Group/Container Nodes */
    .rf-group-node {
      background: rgba(99, 102, 241, 0.03);
      border: 2px dashed #C7D2FE;
      border-radius: 16px;
      min-width: 300px;
      min-height: 200px;
    }
    .rf-group-node .rf-group-label {
      position: absolute;
      top: -12px;
      left: 16px;
      background: white;
      padding: 2px 10px;
      font-size: 11px;
      font-weight: 600;
      color: #6366F1;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-radius: 4px;
      border: 1px solid #C7D2FE;
    }

    .canvas-container {
      width: 100%;
      height: 100%;
      cursor: grab;
    }
    .canvas-container:active { cursor: grabbing; }
    .canvas-container svg {
      display: block;
    }
    .zoom-controls {
      position: absolute;
      bottom: 16px;
      left: 16px;
      display: flex;
      gap: 4px;
      background: white;
      border: 1px solid #E2E8F0;
      border-radius: 8px;
      padding: 4px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .zoom-btn {
      width: 32px;
      height: 32px;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      border: none;
      background: transparent;
      color: #475569;
    }
    .zoom-btn:hover { background: #F1F5F9; }
    .history-controls {
      position: absolute;
      bottom: 16px;
      left: 80px;
      display: flex;
      gap: 4px;
      background: white;
      border: 1px solid #E2E8F0;
      border-radius: 8px;
      padding: 4px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .history-btn {
      width: 32px;
      height: 32px;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      border: none;
      background: transparent;
      color: #475569;
      cursor: pointer;
      border-radius: 4px;
      transition: all 0.15s;
    }
    .history-btn:hover:not(.disabled) { background: #F1F5F9; color: #6366F1; }
    .history-btn.disabled { color: #CBD5E1; cursor: not-allowed; }
    /* Node action buttons */
    .node-action-btn { transition: transform 0.15s, opacity 0.15s; }
    .node-action-btn:hover { opacity: 0.8; }
    .node-action-btn .action-btn-bg { transition: fill 0.15s; }
    .node-action-btn:hover .action-btn-bg { fill: white; }
    .node-action-btn.delete-btn:hover .action-btn-bg { fill: #FEE2E2; }
    .layout-controls {
      position: absolute;
      bottom: 16px;
      right: 16px;
      display: flex;
      gap: 8px;
      align-items: center;
      background: white;
      border: 1px solid #E2E8F0;
      border-radius: 8px;
      padding: 6px 10px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .layout-direction-select {
      padding: 4px 8px;
      border: 1px solid #E2E8F0;
      border-radius: 4px;
      background: white;
      font-size: 12px;
      color: #475569;
      cursor: pointer;
    }
    .layout-direction-select:hover { border-color: #94A3B8; }
    .auto-layout-btn {
      padding: 6px 12px;
      background: linear-gradient(135deg, #6366F1, #8B5CF6);
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .auto-layout-btn:hover { filter: brightness(1.1); }
    .canvas-hint {
      position: absolute;
      top: 16px;
      left: 16px;
      background: white;
      border: 1px solid #E2E8F0;
      border-radius: 8px;
      padding: 8px 12px;
      font-size: 11px;
      color: #64748B;
      display: flex;
      align-items: center;
      gap: 6px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .canvas-hint-icon { font-size: 14px; }

    .cost-panel {
      background: var(--bg-secondary);
      border-left: 1px solid var(--border-color);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      transition: width 0.2s ease, min-width 0.2s ease;
    }
    .cost-panel.collapsed {
      width: 48px !important;
      min-width: 48px !important;
    }
    .cost-panel.collapsed .panel-header {
      writing-mode: vertical-rl;
      text-orientation: mixed;
      transform: rotate(180deg);
    }
    .cost-content {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
    }
    .cost-total {
      background: var(--bg-card);
      border-radius: 12px;
      padding: 20px;
      text-align: center;
      margin-bottom: 16px;
      border: 1px solid var(--border-color);
    }
    .cost-amount { font-size: 32px; font-weight: 700; color: var(--success); }
    .cost-period { color: var(--text-secondary); font-size: 12px; margin-top: 4px; }
    .cost-section { margin-bottom: 16px; }
    .cost-section-title {
      font-size: 11px;
      font-weight: 600;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 10px;
    }
    .cost-item {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 10px;
      padding: 12px 14px;
      margin-bottom: 8px;
    }
    .cost-item-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    }
    .cost-item-name {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 500;
      font-size: 13px;
    }
    .cost-item-icon { font-size: 16px; }
    .cost-item-price { font-weight: 600; font-size: 13px; }
    .cost-item-detail { font-size: 11px; color: var(--text-secondary); }
    .pricing-tips {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 10px;
      padding: 14px;
      font-size: 11px;
      color: var(--text-secondary);
    }
    .pricing-tips h4 { color: var(--text-primary); font-size: 12px; margin-bottom: 8px; }
    .pricing-tips ul { margin: 0; padding-left: 16px; }
    .pricing-tips li { margin-bottom: 4px; }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: #94A3B8;
    }
    .diagram-panel .empty-state {
      background: #FAFAFA;
      color: #64748B;
    }
    .empty-icon { font-size: 40px; margin-bottom: 12px; opacity: 0.5; }

    .modal-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.8);
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }
    .modal-overlay.active { display: flex; }
    .modal {
      background: var(--bg-secondary);
      border-radius: 12px;
      width: 90%;
      max-width: 600px;
      max-height: 80vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      border: 1px solid var(--border-color);
    }
    .modal-header {
      padding: 16px 20px;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .modal-header h2 { font-size: 16px; font-weight: 600; }
    .modal-close {
      background: none;
      border: none;
      color: var(--text-secondary);
      font-size: 20px;
      cursor: pointer;
      padding: 0;
    }
    .modal-content { padding: 20px; overflow: auto; flex: 1; }
    .yaml-output {
      background: var(--bg-primary);
      border-radius: 8px;
      padding: 16px;
      font-family: 'SF Mono', Monaco, monospace;
      font-size: 12px;
      line-height: 1.5;
      white-space: pre-wrap;
      border: 1px solid var(--border-color);
    }
    .modal-footer {
      padding: 14px 20px;
      border-top: 1px solid var(--border-color);
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }

    .node {
      cursor: move;
      user-select: none;
      transition: transform 0.15s ease, filter 0.15s ease;
    }
    .node:hover { }
    .node.has-spec rect:first-of-type { stroke: #22C55E; stroke-width: 2; }
    .node.connecting { animation: pulse 1s infinite; }
    .node.connect-target { cursor: pointer; }
    .node.connect-target:hover { }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.8; }
    }

    /* Connection styling */
    .connection-line { transition: opacity 0.2s ease; }
    .connection-line:hover { opacity: 0.7; }
    @keyframes flowPulse {
      0%, 100% { opacity: 0.5; }
      50% { opacity: 1; }
    }

    /* Component Detail Panel - Railway-style Slide-out */
    .detail-panel {
      position: fixed;
      top: 0;
      right: 0;
      width: 480px;
      height: 100vh;
      background: var(--bg-secondary);
      border-left: 1px solid var(--border-color);
      transform: translateX(100%);
      transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      z-index: 200;
      display: flex;
      flex-direction: column;
      box-shadow: -8px 0 32px rgba(0, 0, 0, 0.3);
    }
    .detail-panel.open { transform: translateX(0); }
    .detail-panel-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.4);
      z-index: 199;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.25s ease;
    }
    .detail-panel-overlay.open {
      opacity: 1;
      pointer-events: auto;
    }
    .detail-header {
      padding: 16px 20px;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .detail-header-icon {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
    }
    .detail-header-info { flex: 1; }
    .detail-header-info h3 { font-size: 16px; font-weight: 600; margin-bottom: 2px; }
    .detail-header-info span { font-size: 11px; color: var(--text-secondary); text-transform: uppercase; }
    .detail-close {
      background: none;
      border: none;
      color: var(--text-secondary);
      font-size: 20px;
      cursor: pointer;
      padding: 4px;
    }
    .detail-close:hover { color: var(--text-primary); }
    /* Panel Tabs */
    .detail-tabs {
      display: flex;
      padding: 0 20px;
      border-bottom: 1px solid var(--border-color);
      background: rgba(23, 23, 23, 0.5);
    }
    .detail-tab {
      padding: 12px 16px;
      font-size: 13px;
      font-weight: 500;
      color: var(--text-secondary);
      background: none;
      border: none;
      cursor: pointer;
      position: relative;
      transition: color 0.15s;
    }
    .detail-tab:hover {
      color: var(--text-primary);
    }
    .detail-tab.active {
      color: white;
    }
    .detail-tab.active::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 16px;
      right: 16px;
      height: 2px;
      background: var(--accent);
      border-radius: 1px 1px 0 0;
    }
    .detail-tab-content {
      flex: 1;
      overflow-y: auto;
      display: none;
    }
    .detail-tab-content.active {
      display: block;
    }
    .detail-content {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
    }
    .spec-section { margin-bottom: 20px; }
    .spec-label {
      font-size: 11px;
      font-weight: 600;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .spec-label-icon { font-size: 14px; }
    .spec-textarea {
      width: 100%;
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 12px;
      color: var(--text-primary);
      font-size: 13px;
      font-family: inherit;
      resize: vertical;
      min-height: 80px;
      line-height: 1.5;
    }
    .spec-textarea:focus { outline: none; border-color: var(--accent); }
    .spec-textarea::placeholder { color: var(--text-secondary); }
    .spec-hint {
      font-size: 11px;
      color: var(--text-secondary);
      margin-top: 6px;
      line-height: 1.4;
    }
    .spec-divider {
      height: 1px;
      background: var(--border-color);
      margin: 20px 0;
    }
    .io-section {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 10px;
      overflow: hidden;
    }
    .io-header {
      padding: 10px 14px;
      background: var(--bg-tertiary);
      font-size: 12px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
      border-bottom: 1px solid var(--border-color);
    }
    .io-content { padding: 12px 14px; }
    .io-content textarea {
      width: 100%;
      background: transparent;
      border: none;
      color: var(--text-primary);
      font-size: 12px;
      font-family: 'SF Mono', Monaco, monospace;
      resize: none;
      min-height: 60px;
      line-height: 1.5;
    }
    .io-content textarea:focus { outline: none; }
    .io-content textarea::placeholder { color: var(--text-secondary); }
    .spec-badge {
      font-size: 8px;
      fill: #fff;
    }
    .detail-footer {
      padding: 16px 20px;
      border-top: 1px solid var(--border-color);
      display: flex;
      gap: 8px;
    }
    .detail-footer button { flex: 1; }

    /* Inner Components List */
    .inner-components-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .inner-component-item {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .inner-component-item input {
      flex: 1;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 8px 10px;
      font-size: 12px;
      color: var(--text-primary);
    }
    .inner-component-item input:focus {
      outline: none;
      border-color: var(--accent);
    }
    .remove-inner-btn {
      width: 28px;
      height: 28px;
      border-radius: 6px;
      background: transparent;
      border: 1px solid var(--border-color);
      color: #EF4444;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      transition: all 0.15s;
    }
    .remove-inner-btn:hover {
      background: rgba(239, 68, 68, 0.1);
      border-color: #EF4444;
    }
    .add-inner-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      background: transparent;
      border: 1px dashed var(--border-color);
      border-radius: 6px;
      padding: 8px 12px;
      color: var(--text-secondary);
      font-size: 12px;
      cursor: pointer;
      transition: all 0.15s;
    }
    .add-inner-btn:hover {
      border-color: var(--accent);
      color: var(--accent);
      background: rgba(99, 102, 241, 0.05);
    }
    .generate-docs-btn {
      background: transparent;
      border: 1px solid var(--border-color);
      border-radius: 4px;
      padding: 4px 8px;
      font-size: 10px;
      color: var(--text-secondary);
      cursor: pointer;
      transition: all 0.15s;
    }
    .generate-docs-btn:hover {
      background: var(--bg-tertiary);
      color: var(--accent);
      border-color: var(--accent);
    }
    .markdown-editor {
      font-family: 'JetBrains Mono', monospace !important;
      font-size: 12px !important;
      line-height: 1.5;
    }

    /* View Toggle */
    .view-toggle {
      display: flex;
      background: var(--bg-tertiary);
      border-radius: 8px;
      padding: 3px;
      gap: 2px;
    }
    .view-toggle button {
      padding: 6px 14px;
      border: none;
      background: transparent;
      font-size: 12px;
      border-radius: 6px;
    }
    .view-toggle button.active {
      background: var(--accent);
      color: white;
    }
    .view-toggle button:hover:not(.active) {
      background: rgba(255,255,255,0.1);
    }

    /* File Tree */
    .file-tree-panel {
      background: var(--bg-secondary);
      border-right: 1px solid var(--border-color);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .file-tree {
      flex: 1;
      overflow-y: auto;
      padding: 8px;
      font-size: 12px;
    }
    .tree-item {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 8px;
      border-radius: 4px;
      cursor: pointer;
      white-space: nowrap;
    }
    .tree-item:hover { background: var(--bg-tertiary); }
    .tree-item.selected { background: var(--accent); }
    .tree-item.dir { font-weight: 500; }
    .tree-item .icon { width: 16px; text-align: center; }
    .tree-children { padding-left: 16px; }
    .tree-component-badge {
      font-size: 9px;
      padding: 1px 4px;
      border-radius: 3px;
      background: var(--accent);
      opacity: 0.7;
      margin-left: auto;
    }

    /* Code Editor */
    .editor-panel {
      display: flex;
      flex-direction: column;
      background: var(--bg-primary);
      overflow: hidden;
    }
    .editor-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 16px;
      background: var(--bg-secondary);
      border-bottom: 1px solid var(--border-color);
      font-size: 12px;
    }
    .editor-filename {
      font-family: 'SF Mono', Monaco, monospace;
      color: var(--text-secondary);
    }
    .editor-container {
      flex: 1;
      overflow: hidden;
    }
    .code-editor {
      width: 100%;
      height: 100%;
      background: var(--bg-primary);
      color: var(--text-primary);
      font-family: 'SF Mono', Monaco, monospace;
      font-size: 13px;
      line-height: 1.5;
      padding: 16px;
      border: none;
      resize: none;
      tab-size: 2;
    }
    .code-editor:focus { outline: none; }

    /* Code Gen Progress */
    .codegen-progress {
      padding: 40px;
      text-align: center;
    }
    .codegen-progress h3 {
      font-size: 16px;
      margin-bottom: 20px;
    }
    .progress-bar {
      height: 8px;
      background: var(--bg-tertiary);
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 12px;
    }
    .progress-fill {
      height: 100%;
      background: var(--accent);
      transition: width 0.3s;
    }
    .progress-text {
      font-size: 12px;
      color: var(--text-secondary);
    }

    /* Generate button */
    button.generate-code {
      background: var(--success);
      border-color: var(--success);
    }
    button.generate-code:hover {
      background: #16a34a;
    }

    /* Template Gallery */
    .template-gallery {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: calc(100vh - 60px);
      padding: 40px;
      background: var(--bg-primary);
    }
    .template-gallery h2 {
      font-size: 28px;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 8px;
    }
    .template-gallery p {
      color: var(--text-secondary);
      margin-bottom: 32px;
    }
    .template-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      max-width: 900px;
      width: 100%;
    }
    .template-card {
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 20px;
      cursor: pointer;
      transition: all 0.15s;
      text-align: left;
    }
    .template-card:hover {
      border-color: var(--accent);
      transform: translateY(-2px);
      box-shadow: 0 4px 24px rgba(99,102,241,0.15);
    }
    .template-card.blank {
      border-style: dashed;
      background: transparent;
    }
    .template-icon {
      font-size: 32px;
      margin-bottom: 12px;
    }
    .template-name {
      font-weight: 600;
      font-size: 14px;
      color: var(--text-primary);
      margin-bottom: 4px;
    }
    .template-desc {
      font-size: 12px;
      color: var(--text-secondary);
      line-height: 1.4;
    }

    /* Template Preview Modal */
    .template-preview-modal {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      animation: fadeIn 0.2s ease;
    }
    .template-preview-content {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 16px;
      width: 90%;
      max-width: 900px;
      max-height: 85vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      animation: slideUp 0.3s ease;
    }
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .template-preview-header {
      padding: 24px;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      align-items: flex-start;
      gap: 16px;
    }
    .template-preview-icon {
      font-size: 48px;
      background: var(--bg-tertiary);
      padding: 16px;
      border-radius: 12px;
    }
    .template-preview-info h2 {
      font-size: 24px;
      font-weight: 700;
      margin-bottom: 8px;
      color: var(--text-primary);
    }
    .template-preview-info p {
      color: var(--text-secondary);
      line-height: 1.5;
    }
    .template-preview-close {
      margin-left: auto;
      background: none;
      border: none;
      color: var(--text-secondary);
      font-size: 24px;
      cursor: pointer;
      padding: 8px;
      border-radius: 8px;
    }
    .template-preview-close:hover {
      background: var(--bg-tertiary);
      color: var(--text-primary);
    }
    .template-preview-body {
      padding: 24px;
      overflow-y: auto;
      flex: 1;
    }
    .template-architecture-preview {
      background: var(--bg-tertiary);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 24px;
    }
    .template-architecture-preview h3 {
      font-size: 14px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-secondary);
      margin-bottom: 16px;
    }
    .template-components-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 12px;
    }
    .template-component-config {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 16px;
    }
    .template-component-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 12px;
    }
    .template-component-icon {
      width: 32px;
      height: 32px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
    }
    .template-component-name {
      font-weight: 600;
      color: var(--text-primary);
    }
    .template-component-type {
      font-size: 11px;
      color: var(--text-secondary);
      text-transform: uppercase;
    }
    .tech-stack-select {
      width: 100%;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 8px 12px;
      color: var(--text-primary);
      font-size: 13px;
      cursor: pointer;
    }
    .tech-stack-select:focus {
      outline: none;
      border-color: var(--accent);
    }
    .template-preview-footer {
      padding: 20px 24px;
      border-top: 1px solid var(--border-color);
      display: flex;
      justify-content: flex-end;
      gap: 12px;
    }

    /* Unified Collapse Bar */
    .collapse-bar {
      position: fixed;
      left: 0;
      top: 60px;
      bottom: 0;
      width: 48px;
      background: var(--bg-secondary);
      border-right: 1px solid var(--border-color);
      display: flex;
      flex-direction: column;
      padding: 8px;
      gap: 4px;
      z-index: 100;
    }
    .collapse-bar-item {
      width: 32px;
      height: 32px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: var(--text-secondary);
      background: transparent;
      border: none;
      transition: all 0.15s;
    }
    .collapse-bar-item:hover {
      background: var(--bg-tertiary);
      color: var(--text-primary);
    }
    .collapse-bar-item.active {
      background: var(--accent);
      color: white;
    }
    .collapse-bar-divider {
      height: 1px;
      background: var(--border-color);
      margin: 8px 0;
    }
    /* Panels collapsed mode */
    .app.panels-collapsed {
      display: grid !important;
      grid-template-columns: 48px 1fr !important;
      grid-template-rows: 60px 1fr !important;
    }
    .app.panels-collapsed header {
      grid-column: 1 / -1;
    }
    .app.panels-collapsed .chat-panel,
    .app.panels-collapsed .cost-panel,
    .app.panels-collapsed .component-palette,
    .app.panels-collapsed .editor-preview-panel {
      display: none !important;
    }
    .app.panels-collapsed .diagram-panel {
      grid-column: 2;
      grid-row: 2;
      min-width: 0;
      min-height: 0;
    }
    .app.panels-collapsed .docs-panel {
      grid-column: 2;
      grid-row: 2;
      min-width: 0;
      min-height: 0;
    }
    .app.panels-collapsed .file-tree-panel {
      display: none !important;
    }
    .app.panels-collapsed .editor-panel {
      grid-column: 2;
      grid-row: 2;
      min-width: 0;
      min-height: 0;
    }
    .app.panels-collapsed .collapse-bar {
      grid-column: 1;
      grid-row: 2;
      position: relative;
      top: 0;
      left: 0;
    }
    .active-panel-wrapper {
      position: fixed;
      left: 48px;
      top: 60px;
      bottom: 0;
      z-index: 90;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      box-shadow: 4px 0 24px rgba(0,0,0,0.3);
    }

    /* Focus Mode - Hide UI */
    .app.focus-mode {
      display: block !important;
    }
    .app.focus-mode header,
    .app.focus-mode .chat-panel,
    .app.focus-mode .cost-panel,
    .app.focus-mode .component-palette,
    .app.focus-mode .collapse-bar,
    .app.focus-mode .file-tree-panel,
    .app.focus-mode .editor-panel {
      display: none !important;
    }
    .app.focus-mode .diagram-panel {
      position: fixed;
      inset: 0;
      z-index: 10;
    }
    .show-ui-btn {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 1000;
      background: #171717;
      border: 1px solid #333;
      border-radius: 8px;
      padding: 10px 16px;
      color: white;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.4);
      transition: all 0.15s;
    }
    .show-ui-btn:hover {
      background: #262626;
      transform: translateY(-2px);
    }
    .hide-ui-btn {
      background: transparent;
      border: 1px solid #404040;
      border-radius: 6px;
      padding: 6px 10px;
      color: #a3a3a3;
      font-size: 11px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.15s;
    }
    .hide-ui-btn:hover {
      background: #262626;
      color: white;
      border-color: #525252;
    }

    /* Container/Group Component Styling */
    .component-group {
      stroke: #94A3B8;
      stroke-width: 2;
      stroke-dasharray: 8 4;
      fill: rgba(148, 163, 184, 0.03);
      rx: 12;
    }
    .component-group-label {
      fill: #64748B;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    /* Improved Node Styling */
    .node-card {
      filter: drop-shadow(0 2px 8px rgba(0,0,0,0.08));
      transition: filter 0.2s, transform 0.2s;
    }
    .node-card:hover {
      filter: drop-shadow(0 4px 16px rgba(0,0,0,0.12));
    }
    .node-inner-items {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 8px;
      background: rgba(0,0,0,0.02);
      border-radius: 6px;
      margin-top: 8px;
    }
    .node-inner-item {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 8px;
      background: white;
      border: 1px solid #E2E8F0;
      border-radius: 4px;
      font-size: 10px;
      color: #64748B;
    }
    .node-inner-item-icon {
      width: 14px;
      height: 14px;
      color: #94A3B8;
    }

    /* Template Configuration View (Full Page) */
    .template-config-view {
      display: flex;
      height: calc(100vh - 60px);
      overflow: hidden;
    }
    .template-config-left {
      width: 400px;
      flex-shrink: 0;
      border-right: 1px solid var(--border-color);
      background: var(--bg-primary);
      display: flex;
      flex-direction: column;
      overflow-y: auto;
      padding: 32px;
    }
    .template-config-right {
      flex: 1;
      background: var(--bg-primary);
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .template-config-right-header {
      padding: 24px 32px;
      border-bottom: 1px solid var(--border-color);
    }
    .template-config-right-body {
      flex: 1;
      overflow-y: auto;
      padding: 24px 32px;
    }
    .template-config-footer {
      padding: 20px 32px;
      border-top: 1px solid var(--border-color);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .back-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #737373;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: color 0.15s;
      background: none;
      border: none;
      margin-bottom: 32px;
    }
    .back-btn:hover { color: white; }
    .template-config-icon {
      width: 64px;
      height: 64px;
      border-radius: 16px;
      background: linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.1));
      border: 1px solid rgba(99,102,241,0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 24px;
    }
    .template-config-title {
      font-size: 28px;
      font-weight: 600;
      color: white;
      margin-bottom: 16px;
    }
    .template-config-desc {
      color: #a3a3a3;
      font-size: 14px;
      line-height: 1.6;
      margin-bottom: 24px;
    }
    .template-features {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-bottom: 32px;
    }
    .template-feature {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      font-size: 12px;
      color: #d4d4d4;
    }
    .template-feature iconify-icon {
      color: #22C55E;
      flex-shrink: 0;
      margin-top: 2px;
    }
    .mini-diagram {
      background: rgba(23,23,23,0.5);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 24px;
      position: relative;
      min-height: 200px;
    }
    .mini-diagram-grid {
      position: absolute;
      inset: 0;
      background-size: 24px 24px;
      background-image: radial-gradient(circle, #262626 1px, transparent 1px);
      opacity: 0.5;
      border-radius: 12px;
    }

    /* Component Config Row */
    .component-config-row {
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding: 16px;
      border-radius: 12px;
      border: 1px solid var(--border-color);
      background: rgba(23,23,23,0.4);
      margin-bottom: 12px;
      transition: background 0.15s;
    }
    .component-config-row:hover {
      background: rgba(23,23,23,0.8);
    }
    @media (min-width: 640px) {
      .component-config-row {
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
      }
    }
    .component-config-info {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .component-config-icon {
      width: 40px;
      height: 40px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .component-config-name {
      font-size: 14px;
      font-weight: 500;
      color: white;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .component-config-type-badge {
      font-size: 9px;
      font-family: 'JetBrains Mono', monospace;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #737373;
      border: 1px solid #404040;
      padding: 2px 6px;
      border-radius: 4px;
    }
    .component-config-subtitle {
      font-size: 12px;
      color: #737373;
      margin-top: 2px;
    }
    .tech-select {
      width: 100%;
      max-width: 256px;
      background: #0a0a0a;
      border: 1px solid #404040;
      border-radius: 8px;
      padding: 10px 12px;
      color: white;
      font-size: 12px;
      cursor: pointer;
      transition: border-color 0.15s;
    }
    .tech-select:hover { border-color: #525252; }
    .tech-select:focus { outline: none; border-color: var(--accent); }

    /* Breadcrumb Navigation */
    .breadcrumb-nav {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      font-weight: 500;
    }
    .breadcrumb-nav span {
      color: #525252;
      transition: color 0.15s;
    }
    .breadcrumb-nav span.active {
      color: white;
    }

    /* AI Input with Glow */
    .ai-input-wrapper {
      position: relative;
      max-width: 600px;
      margin: 0 auto;
    }
    .ai-input-glow {
      position: absolute;
      inset: -2px;
      background: linear-gradient(90deg, rgba(99,102,241,0.3), rgba(139,92,246,0.3));
      border-radius: 12px;
      filter: blur(8px);
      opacity: 0.5;
      transition: opacity 0.3s;
    }
    .ai-input-wrapper:hover .ai-input-glow,
    .ai-input-wrapper:focus-within .ai-input-glow {
      opacity: 1;
    }
    .ai-input-container {
      position: relative;
      display: flex;
      align-items: center;
      gap: 12px;
      background: #0a0a0a;
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 10px;
      padding: 6px 8px 6px 16px;
    }
    .ai-input {
      flex: 1;
      background: transparent;
      border: none;
      outline: none;
      color: white;
      font-size: 14px;
      padding: 8px 0;
    }
    .ai-input::placeholder { color: #525252; }
    .ai-input-btn {
      background: white;
      color: black;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s;
    }
    .ai-input-btn:hover { background: #e5e5e5; }

    /* Component Palette */
    .component-palette {
      background: var(--bg-secondary);
      border-right: 1px solid var(--border-color);
      display: flex;
      flex-direction: column;
      width: 200px;
      transition: width 0.2s ease, min-width 0.2s ease;
    }
    .component-palette.collapsed {
      width: 48px !important;
      min-width: 48px !important;
    }
    .component-palette.collapsed .panel-header {
      writing-mode: vertical-rl;
      text-orientation: mixed;
    }
    .palette-section {
      padding: 12px;
    }
    .palette-title {
      font-size: 10px;
      font-weight: 600;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }
    .palette-category {
      margin-bottom: 12px;
    }
    .palette-category-title {
      font-size: 9px;
      font-weight: 600;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 4px 8px;
      margin-bottom: 4px;
      border-bottom: 1px solid var(--border-color);
    }
    .palette-item {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 8px;
      background: var(--bg-card);
      border: 1px solid transparent;
      border-radius: 6px;
      margin-bottom: 2px;
      cursor: grab;
      transition: all 0.15s;
    }
    .palette-item:hover {
      border-color: var(--accent);
      background: var(--bg-tertiary);
    }
    .palette-item:active {
      cursor: grabbing;
    }
    .palette-item-icon {
      width: 24px;
      height: 24px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      flex-shrink: 0;
    }
    .palette-item-label {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .palette-item-info {
      flex: 1;
      min-width: 0;
    }
    .palette-item-name {
      font-size: 11px;
      font-weight: 500;
      color: var(--text-primary);
    }
    .palette-item-type {
      font-size: 9px;
      color: var(--text-secondary);
    }

    /* Canvas action buttons (legacy) */
    .toolbar-btn {
      background: white;
      border: 1px solid #E2E8F0;
      border-radius: 6px;
      padding: 6px 12px;
      font-size: 11px;
      color: #475569;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 4px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .toolbar-btn:hover {
      background: #F1F5F9;
    }
    .toolbar-btn.active {
      background: var(--accent);
      color: white;
      border-color: var(--accent);
    }
    .toolbar-btn.danger:hover {
      background: #FEE2E2;
      border-color: #EF4444;
      color: #DC2626;
    }

    /* Connection mode indicator */
    .connecting-hint {
      position: absolute;
      bottom: 60px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--accent);
      color: white;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    }

    /* Drop zone highlight */
    .canvas-container.drag-over {
      background: rgba(99, 102, 241, 0.1);
    }
    .canvas-container.drag-over::after {
      content: 'Drop to add component';
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: var(--accent);
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      pointer-events: none;
    }

    /* Builder mode grid */
    .app.builder-mode {
      grid-template-columns: 360px 200px 1fr 300px;
    }

    /* Project List View - Dashboard style */
    .project-list-view {
      display: flex;
      height: 100vh;
      background: var(--bg-primary);
      animation: fadeIn 0.2s ease-out;
    }
    .project-sidebar {
      width: 240px;
      background: rgba(10, 10, 10, 0.5);
      backdrop-filter: blur(8px);
      border-right: 1px solid var(--border-color);
      display: flex;
      flex-direction: column;
      z-index: 20;
    }
    .sidebar-header {
      height: 56px;
      padding: 0 16px;
      display: flex;
      align-items: center;
      gap: 8px;
      border-bottom: 1px solid var(--border-color);
    }
    .sidebar-logo-icon {
      width: 24px;
      height: 24px;
      background: var(--accent);
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
    }
    .sidebar-logo {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      font-weight: 600;
      letter-spacing: -0.02em;
    }
    .sidebar-nav {
      flex: 1;
      padding: 12px;
      overflow-y: auto;
    }
    .nav-section-title {
      padding: 8px 12px 8px 12px;
      font-size: 10px;
      font-weight: 600;
      color: #525252;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-top: 16px;
    }
    .nav-section-title:first-child {
      margin-top: 4px;
    }
    .nav-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 12px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
      color: #737373;
      transition: all 0.15s;
    }
    .nav-item:hover {
      background: rgba(38, 38, 38, 0.5);
      color: white;
    }
    .nav-item.active {
      background: var(--bg-tertiary);
      color: white;
      border: 1px solid #404040;
      box-shadow: 0 1px 2px rgba(0,0,0,0.2);
    }
    .nav-item-icon {
      color: #525252;
      transition: color 0.15s;
    }
    .nav-item:hover .nav-item-icon,
    .nav-item.active .nav-item-icon {
      color: #a3a3a3;
    }
    .sidebar-footer {
      padding: 12px;
      border-top: 1px solid var(--border-color);
    }
    .sidebar-user {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px;
    }
    .sidebar-user-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--accent), #a855f7);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 11px;
      font-weight: 700;
      border: 1px solid rgba(255,255,255,0.1);
    }
    .sidebar-user-info {
      flex: 1;
      min-width: 0;
    }
    .sidebar-user-name {
      font-size: 12px;
      font-weight: 500;
      color: white;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .sidebar-user-plan {
      font-size: 10px;
      color: #525252;
    }
    .sidebar-logout {
      background: none;
      border: none;
      padding: 4px;
      color: #525252;
      cursor: pointer;
      transition: color 0.15s;
    }
    .sidebar-logout:hover {
      color: white;
    }

    .project-main {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: var(--bg-primary);
      position: relative;
    }
    .project-main::before {
      content: '';
      position: absolute;
      inset: 0;
      background: url('https://grainy-gradients.vercel.app/noise.svg');
      opacity: 0.05;
      pointer-events: none;
    }
    .project-header {
      height: 56px;
      padding: 0 24px;
      background: rgba(10, 10, 10, 0.8);
      backdrop-filter: blur(8px);
      border-bottom: 1px solid var(--border-color);
      display: flex;
      align-items: center;
      gap: 16px;
      position: sticky;
      top: 0;
      z-index: 10;
    }
    .project-header h1 {
      font-size: 13px;
      font-weight: 500;
      color: white;
      letter-spacing: -0.01em;
    }
    .project-header-divider {
      width: 1px;
      height: 16px;
      background: var(--border-color);
    }
    .project-header-spacer { flex: 1; }
    .search-input-wrapper {
      position: relative;
    }
    .search-input-icon {
      position: absolute;
      left: 10px;
      top: 50%;
      transform: translateY(-50%);
      color: #525252;
      pointer-events: none;
      transition: color 0.15s;
    }
    .search-input-wrapper:focus-within .search-input-icon {
      color: white;
    }
    .search-input {
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 6px 12px 6px 32px;
      font-size: 12px;
      width: 256px;
      color: white;
      transition: all 0.15s;
    }
    .search-input:focus {
      outline: none;
      border-color: #404040;
      background: var(--bg-card);
    }
    .search-input::placeholder { color: #525252; }
    .new-project-btn {
      background: white;
      color: black;
      border: none;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      box-shadow: 0 1px 2px rgba(0,0,0,0.1);
      transition: background 0.15s;
    }
    .new-project-btn:hover {
      background: #e5e5e5;
    }

    .project-content {
      flex: 1;
      overflow-y: auto;
      padding: 24px;
      position: relative;
    }

    /* Project Table - Dark theme */
    .project-table {
      width: 100%;
      border-collapse: collapse;
      background: var(--bg-secondary);
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid var(--border-color);
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    }
    .project-table th {
      text-align: left;
      padding: 12px 24px;
      font-size: 10px;
      font-weight: 600;
      color: #525252;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-bottom: 1px solid var(--border-color);
      background: rgba(23, 23, 23, 0.5);
    }
    .project-table td {
      padding: 16px 24px;
      border-bottom: 1px solid var(--border-color);
      font-size: 12px;
      color: #a3a3a3;
    }
    .project-table tr:last-child td {
      border-bottom: none;
    }
    .project-table tr:hover td {
      background: var(--bg-tertiary);
    }
    .project-table tr {
      cursor: pointer;
      transition: background 0.15s;
    }
    .project-name-cell {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .project-icon {
      width: 32px;
      height: 32px;
      background: linear-gradient(135deg, #312e81, #3730a3);
      border: 1px solid rgba(99, 102, 241, 0.3);
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #818cf8;
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.05);
    }
    .project-name-text {
      font-weight: 500;
      font-size: 12px;
      color: #e5e5e5;
    }
    .project-name-text:hover {
      color: white;
    }
    .project-slug {
      font-size: 10px;
      color: #525252;
      margin-top: 2px;
    }
    .project-status {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .project-status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--success);
      box-shadow: 0 0 8px rgba(34, 197, 94, 0.4);
    }
    .project-status-dot.building {
      background: var(--warning);
      box-shadow: 0 0 8px rgba(245, 158, 11, 0.4);
    }
    .project-status-dot.offline {
      background: #525252;
      box-shadow: none;
    }
    .project-region {
      display: flex;
      align-items: center;
      gap: 4px;
      color: #737373;
    }
    .project-region-icon {
      color: #404040;
    }
    .project-date {
      color: #525252;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
    }
    .project-actions {
      display: flex;
      gap: 8px;
      opacity: 0;
      transition: opacity 0.15s;
    }
    .project-table tr:hover .project-actions {
      opacity: 1;
    }
    .project-action-btn {
      padding: 6px;
      border: none;
      background: none;
      border-radius: 4px;
      cursor: pointer;
      color: #737373;
      transition: all 0.15s;
    }
    .project-action-btn:hover {
      background: var(--bg-card);
      color: white;
    }

    /* Empty state for project list */
    .project-empty {
      text-align: center;
      padding: 80px 40px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    .project-empty-icon {
      font-size: 48px;
      margin-bottom: 16px;
      opacity: 0.5;
    }
    .project-empty h3 {
      font-size: 18px;
      color: #1E293B;
      margin-bottom: 8px;
    }
    .project-empty p {
      color: #64748B;
      margin-bottom: 24px;
    }

    /* Settings Page */
    .settings-view {
      display: flex;
      height: 100vh;
      background: #0A0A0A;
    }
    .settings-content {
      flex: 1;
      overflow-y: auto;
      padding: 32px;
      max-width: 800px;
    }
    .settings-section {
      background: #1A1A1A;
      border: 1px solid #2A2A2A;
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
    }
    .settings-section h2 {
      font-size: 16px;
      font-weight: 600;
      color: #FFFFFF;
      margin-bottom: 4px;
    }
    .settings-section p {
      font-size: 13px;
      color: #888888;
      margin-bottom: 20px;
    }
    .settings-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 0;
      border-bottom: 1px solid #2A2A2A;
    }
    .settings-row:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }
    .settings-label {
      font-size: 13px;
      font-weight: 500;
      color: #FFFFFF;
    }
    .settings-value {
      font-size: 13px;
      color: #888888;
    }
    .settings-input {
      background: #0A0A0A;
      border: 1px solid #2A2A2A;
      border-radius: 6px;
      padding: 8px 12px;
      font-size: 13px;
      min-width: 200px;
      color: #FFFFFF;
    }
    .settings-input:focus {
      outline: none;
      border-color: var(--accent);
      background: #1A1A1A;
    }
    .settings-select {
      background: #0A0A0A;
      border: 1px solid #2A2A2A;
      border-radius: 6px;
      padding: 8px 12px;
      font-size: 13px;
      min-width: 200px;
      color: #FFFFFF;
      cursor: pointer;
    }
    .settings-btn {
      background: var(--accent);
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 13px;
      cursor: pointer;
    }
    .settings-btn:hover {
      background: var(--accent-light);
    }
    .settings-btn.danger {
      background: #EF4444;
    }
    .settings-btn.danger:hover {
      background: #DC2626;
    }

    /* Dashboard View */
    .dashboard-view {
      display: flex;
      height: 100vh;
      background: #0A0A0A;
      animation: fadeIn 0.2s ease-out;
    }
    .dashboard-main {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .dashboard-content {
      flex: 1;
      overflow-y: auto;
      padding: 32px;
    }
    .dashboard-stats {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 32px;
    }
    .dashboard-stat-card {
      background: #1A1A1A;
      border: 1px solid #2A2A2A;
      border-radius: 12px;
      padding: 20px;
      transition: border-color 0.2s;
    }
    .dashboard-stat-card:hover {
      border-color: #404040;
    }
    .dashboard-stat-label {
      font-size: 12px;
      font-weight: 500;
      color: #737373;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .dashboard-stat-value {
      font-size: 28px;
      font-weight: 700;
      color: #FFFFFF;
      letter-spacing: -0.02em;
    }
    .dashboard-stat-sub {
      font-size: 12px;
      color: #525252;
      margin-top: 4px;
    }
    .dashboard-section-title {
      font-size: 14px;
      font-weight: 600;
      color: #A3A3A3;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .dashboard-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: 16px;
      margin-bottom: 32px;
    }
    .dashboard-card {
      background: #1A1A1A;
      border: 1px solid #2A2A2A;
      border-radius: 12px;
      padding: 20px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .dashboard-card:hover {
      border-color: var(--accent);
      box-shadow: 0 0 20px rgba(99, 102, 241, 0.08);
    }
    .dashboard-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }
    .dashboard-card-name {
      font-size: 14px;
      font-weight: 600;
      color: #FFFFFF;
    }
    .dashboard-card-slug {
      font-size: 11px;
      color: #525252;
      margin-top: 2px;
    }
    .dashboard-card-status {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      font-weight: 500;
      color: #737373;
    }
    .dashboard-card-status-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #22C55E;
    }
    .dashboard-card-status-dot.offline { background: #525252; }
    .dashboard-card-status-dot.building { background: #F59E0B; animation: pulse 1.5s infinite; }
    .dashboard-card-status-dot.failed { background: #EF4444; }
    .dashboard-card-diagram {
      height: 120px;
      background: #111111;
      border-radius: 8px;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .dashboard-card-diagram svg {
      width: 100%;
      height: 100%;
    }
    .dashboard-card-diagram-empty {
      color: #2A2A2A;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      font-size: 11px;
    }
    .dashboard-envs {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
      flex-wrap: wrap;
    }
    .dashboard-env-pill {
      display: flex;
      align-items: center;
      gap: 5px;
      padding: 3px 10px;
      border-radius: 99px;
      background: #111111;
      border: 1px solid #2A2A2A;
      font-size: 11px;
      color: #A3A3A3;
      font-weight: 500;
    }
    .dashboard-env-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #525252;
    }
    .dashboard-env-dot.live { background: #22C55E; }
    .dashboard-env-dot.deploying { background: #F59E0B; animation: pulse 1.5s infinite; }
    .dashboard-env-dot.failed { background: #EF4444; }
    .dashboard-card-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-top: 12px;
      border-top: 1px solid #2A2A2A;
    }
    .dashboard-card-cost {
      font-size: 13px;
      font-weight: 600;
      color: #A3A3A3;
    }
    .dashboard-card-date {
      font-size: 11px;
      color: #525252;
    }
    .dashboard-card-deploy-btn {
      background: transparent;
      border: 1px solid #2A2A2A;
      border-radius: 6px;
      padding: 4px 10px;
      font-size: 11px;
      color: #A3A3A3;
      cursor: pointer;
      transition: all 0.15s;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .dashboard-card-deploy-btn:hover {
      border-color: var(--accent);
      color: white;
    }
    .dashboard-card-preview-btn {
      background: transparent;
      border: 1px solid #2A2A2A;
      border-radius: 6px;
      padding: 4px 10px;
      font-size: 11px;
      color: #A3A3A3;
      cursor: pointer;
      transition: all 0.15s;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .dashboard-card-preview-btn:hover {
      border-color: #22C55E;
      color: white;
    }
    .dashboard-card-preview-btn.running {
      border-color: #22C55E;
      color: #22C55E;
    }
    .dashboard-card-preview-btn.starting {
      border-color: #EAB308;
      color: #EAB308;
    }
    .dashboard-card-preview-btn.error {
      border-color: #EF4444;
      color: #EF4444;
    }
    .preview-services-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      padding-top: 8px;
      border-top: 1px solid #2A2A2A;
      margin-top: 8px;
    }
    .preview-service-pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      background: rgba(34, 197, 94, 0.1);
      border: 1px solid rgba(34, 197, 94, 0.3);
      border-radius: 12px;
      font-size: 10px;
      color: #22C55E;
    }
    .preview-service-pill a {
      color: #22C55E;
      text-decoration: underline;
      cursor: pointer;
    }
    .preview-service-pill a:hover {
      color: #4ADE80;
    }
    .editor-preview-panel {
      position: fixed;
      bottom: 16px;
      right: 16px;
      width: 280px;
      z-index: 80;
      background: #1A1A1A;
      border: 1px solid #2A2A2A;
      border-radius: 8px;
      padding: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    }
    .editor-preview-panel .preview-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    .editor-preview-panel .preview-header-title {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      font-weight: 600;
      color: #22C55E;
    }
    .editor-preview-panel .preview-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #22C55E;
      animation: pulse 2s infinite;
    }
    .editor-preview-panel .preview-stop-btn {
      background: transparent;
      border: 1px solid #EF4444;
      border-radius: 4px;
      padding: 2px 8px;
      font-size: 10px;
      color: #EF4444;
      cursor: pointer;
    }
    .editor-preview-panel .preview-stop-btn:hover {
      background: rgba(239, 68, 68, 0.1);
    }
    .editor-preview-panel .preview-service-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .editor-preview-panel .preview-service-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 8px;
      background: rgba(255,255,255,0.03);
      border-radius: 4px;
      font-size: 11px;
    }
    .editor-preview-panel .preview-service-name {
      color: #A3A3A3;
    }
    .editor-preview-panel .preview-service-url a {
      color: #22C55E;
      text-decoration: underline;
      cursor: pointer;
    }
    .editor-preview-panel .preview-error {
      color: #EF4444;
      font-size: 11px;
      margin-top: 8px;
    }
    .dashboard-cost-section {
      background: #1A1A1A;
      border: 1px solid #2A2A2A;
      border-radius: 12px;
      padding: 24px;
    }
    .dashboard-cost-section h3 {
      font-size: 14px;
      font-weight: 600;
      color: #FFFFFF;
      margin-bottom: 16px;
    }
    .dashboard-cost-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 10px;
    }
    .dashboard-cost-label {
      font-size: 12px;
      color: #A3A3A3;
      width: 120px;
      flex-shrink: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .dashboard-cost-bar-wrap {
      flex: 1;
      height: 8px;
      background: #111111;
      border-radius: 4px;
      overflow: hidden;
    }
    .dashboard-cost-bar {
      height: 100%;
      border-radius: 4px;
      background: var(--accent);
      transition: width 0.3s ease;
    }
    .dashboard-cost-amount {
      font-size: 12px;
      font-weight: 600;
      color: #737373;
      width: 60px;
      text-align: right;
      flex-shrink: 0;
    }
    @media (max-width: 900px) {
      .dashboard-stats {
        grid-template-columns: repeat(2, 1fr);
      }
      .dashboard-grid {
        grid-template-columns: 1fr;
      }
    }

    /* Documentation Editor */
    .docs-panel {
      display: flex;
      flex-direction: column;
      background: white;
      height: 100%;
      overflow: hidden;
    }
    .docs-toolbar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 20px;
      border-bottom: 1px solid #E2E8F0;
      background: #F8FAFC;
    }
    .docs-toolbar-title {
      font-weight: 600;
      color: #1E293B;
      flex: 1;
    }
    .docs-toggle {
      display: flex;
      background: #E2E8F0;
      border-radius: 6px;
      padding: 2px;
    }
    .docs-toggle button {
      padding: 4px 12px;
      border: none;
      background: transparent;
      font-size: 12px;
      color: #64748B;
      border-radius: 4px;
      cursor: pointer;
    }
    .docs-toggle button.active {
      background: white;
      color: #1E293B;
      box-shadow: 0 1px 2px rgba(0,0,0,0.1);
    }
    .docs-editor-container {
      flex: 1;
      display: flex;
      overflow: hidden;
    }
    .docs-editor {
      flex: 1;
      padding: 24px 32px;
      font-family: 'SF Mono', Monaco, Consolas, monospace;
      font-size: 14px;
      line-height: 1.7;
      border: none;
      resize: none;
      background: white;
      color: #1E293B;
    }
    .docs-editor:focus {
      outline: none;
    }
    .docs-editor::placeholder {
      color: #94A3B8;
    }
    .docs-preview {
      flex: 1;
      padding: 24px 32px;
      overflow-y: auto;
      background: white;
      color: #1E293B;
      font-size: 15px;
      line-height: 1.8;
    }
    .docs-preview h1 {
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 2px solid #E2E8F0;
    }
    .docs-preview h2 {
      font-size: 20px;
      font-weight: 600;
      margin-top: 32px;
      margin-bottom: 12px;
      color: #334155;
    }
    .docs-preview h3 {
      font-size: 16px;
      font-weight: 600;
      margin-top: 24px;
      margin-bottom: 8px;
      color: #475569;
    }
    .docs-preview p {
      margin-bottom: 16px;
    }
    .docs-preview ul, .docs-preview ol {
      margin-bottom: 16px;
      padding-left: 24px;
    }
    .docs-preview li {
      margin-bottom: 8px;
    }
    .docs-preview code {
      background: #F1F5F9;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: 'SF Mono', Monaco, monospace;
      font-size: 13px;
    }
    .docs-preview pre {
      background: #1E293B;
      color: #E2E8F0;
      padding: 16px 20px;
      border-radius: 8px;
      overflow-x: auto;
      margin-bottom: 16px;
    }
    .docs-preview pre code {
      background: none;
      padding: 0;
      color: inherit;
    }
    .docs-preview blockquote {
      border-left: 4px solid #6366F1;
      padding-left: 16px;
      margin: 16px 0;
      color: #64748B;
      font-style: italic;
    }
    .docs-export-btn {
      background: white;
      border: 1px solid #E2E8F0;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 12px;
      cursor: pointer;
      color: #475569;
    }
    .docs-export-btn:hover {
      background: #F1F5F9;
    }

    /* Auth Screen */
    .auth-screen {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: radial-gradient(ellipse at top, #262626, #0a0a0a, #000);
      position: relative;
    }
    .auth-screen::before {
      content: '';
      position: absolute;
      inset: 0;
      background: url('https://grainy-gradients.vercel.app/noise.svg');
      opacity: 0.2;
      pointer-events: none;
    }
    .auth-brand {
      position: absolute;
      top: 32px;
      left: 32px;
      display: flex;
      align-items: center;
      gap: 8px;
      opacity: 0.6;
      color: white;
      font-weight: 600;
    }
    .auth-card {
      background: rgba(10, 10, 10, 0.8);
      backdrop-filter: blur(20px);
      border: 1px solid var(--border-color);
      border-radius: 16px;
      padding: 32px;
      width: 100%;
      max-width: 360px;
      box-shadow: 0 25px 50px rgba(0,0,0,0.5);
      animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      position: relative;
      z-index: 10;
    }
    .auth-logo {
      text-align: center;
      margin-bottom: 32px;
    }
    .auth-logo-icon {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      background: linear-gradient(135deg, #4F46E5, #6366F1);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 20px;
      border: 1px solid rgba(255,255,255,0.1);
      box-shadow: 0 8px 32px rgba(99, 102, 241, 0.3);
      color: white;
    }
    .auth-logo h1 {
      font-size: 20px;
      font-weight: 600;
      color: white;
      letter-spacing: -0.02em;
      margin-bottom: 8px;
    }
    .auth-logo p {
      color: #737373;
      font-size: 12px;
    }
    .auth-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .auth-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .auth-label {
      font-size: 11px;
      font-weight: 500;
      color: #737373;
    }
    .auth-input {
      background: #000;
      border: 1px solid #2a2a2a;
      border-radius: 8px;
      padding: 10px 12px;
      font-size: 13px;
      color: white;
      width: 100%;
      transition: all 0.2s;
    }
    .auth-input:focus {
      outline: none;
      border-color: var(--accent);
      box-shadow: 0 0 0 1px var(--accent);
      background: var(--bg-tertiary);
    }
    .auth-input::placeholder {
      color: #404040;
    }
    .auth-btn {
      background: white;
      color: black;
      border: none;
      border-radius: 8px;
      padding: 10px 16px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      margin-top: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: background 0.2s;
    }
    .auth-btn:hover {
      background: #e5e5e5;
    }
    .auth-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .auth-footer {
      display: flex;
      justify-content: space-between;
      margin-top: 24px;
      font-size: 11px;
    }
    .auth-footer a {
      color: #737373;
      cursor: pointer;
      text-decoration: none;
      transition: color 0.2s;
    }
    .auth-footer a:hover {
      color: white;
    }
    .auth-footer a.accent {
      color: var(--accent);
    }
    .auth-footer a.accent:hover {
      color: var(--accent-light);
    }
    .auth-error {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.2);
      color: #f87171;
      padding: 10px 12px;
      border-radius: 8px;
      font-size: 12px;
      text-align: center;
    }
    .auth-version {
      position: absolute;
      bottom: 32px;
      color: #404040;
      font-size: 10px;
      font-family: 'JetBrains Mono', monospace;
    }
    .auth-divider {
      display: flex;
      align-items: center;
      margin: 20px 0 16px;
      color: #525252;
      font-size: 11px;
    }
    .auth-divider::before,
    .auth-divider::after {
      content: '';
      flex: 1;
      height: 1px;
      background: #2a2a2a;
    }
    .auth-divider span {
      padding: 0 12px;
    }
    .auth-guest-btn {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 12px;
      background: transparent;
      border: 1px solid #2a2a2a;
      border-radius: 8px;
      color: #a3a3a3;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .auth-guest-btn:hover {
      background: #171717;
      border-color: #404040;
      color: white;
    }

    /* Deploy Modal */
    .deploy-modal {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.8);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }
    .deploy-modal-content {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      width: 480px;
      max-height: 85vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: 0 25px 50px rgba(0,0,0,0.5);
      animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      position: relative;
    }
    .deploy-modal-header {
      padding: 20px 24px;
      border-bottom: 1px solid var(--border-color);
      background: rgba(23, 23, 23, 0.5);
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
    }
    .deploy-modal-header h2 {
      font-size: 14px;
      font-weight: 600;
      color: white;
      letter-spacing: -0.01em;
    }
    .deploy-modal-header p {
      font-size: 10px;
      color: #737373;
      margin-top: 4px;
    }
    .deploy-modal-body {
      padding: 24px;
      overflow-y: auto;
      flex: 1;
    }
    .deploy-env-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-bottom: 24px;
    }
    .deploy-env-btn {
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 12px;
      text-align: center;
      cursor: pointer;
      transition: all 0.15s;
    }
    .deploy-env-btn:hover {
      border-color: #525252;
      background: var(--bg-card);
    }
    .deploy-env-btn.active {
      border-width: 2px;
      border-color: var(--accent);
      background: rgba(99, 102, 241, 0.1);
      box-shadow: 0 0 15px rgba(99, 102, 241, 0.2);
      position: relative;
    }
    .deploy-env-btn.active::after {
      content: 'LIVE';
      position: absolute;
      top: -8px;
      right: -8px;
      background: var(--accent);
      color: white;
      font-size: 9px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 9999px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    }
    .deploy-env-btn.disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .deploy-env-name {
      font-weight: 600;
      font-size: 12px;
      color: #a3a3a3;
    }
    .deploy-env-btn.active .deploy-env-name {
      color: white;
    }
    .deploy-summary {
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 16px;
    }
    .deploy-summary-row {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      margin-bottom: 8px;
    }
    .deploy-summary-label {
      color: #737373;
    }
    .deploy-summary-value {
      color: white;
      font-weight: 500;
    }
    .deploy-summary-divider {
      height: 1px;
      background: var(--border-color);
      margin: 12px 0;
    }
    .deploy-summary-note {
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }
    .deploy-summary-note-icon {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      border: 1px solid #525252;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--accent);
      flex-shrink: 0;
      margin-top: 2px;
    }
    .deploy-summary-note-text {
      font-size: 10px;
      color: #737373;
      line-height: 1.5;
    }
    .deploy-modal-footer {
      padding: 16px 24px;
      background: rgba(23, 23, 23, 0.5);
      border-top: 1px solid var(--border-color);
      display: flex;
      justify-content: flex-end;
      gap: 12px;
    }
    .deploy-cancel-btn {
      background: none;
      border: none;
      color: #737373;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      padding: 8px 16px;
      transition: color 0.15s;
    }
    .deploy-cancel-btn:hover {
      color: white;
    }
    .deploy-submit-btn {
      background: white;
      color: black;
      border: none;
      padding: 8px 20px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 2px 8px rgba(255,255,255,0.1);
      transition: all 0.15s;
    }
    .deploy-submit-btn:hover {
      background: #e5e5e5;
    }
    .deploy-logs {
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 16px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      max-height: 160px;
      overflow-y: auto;
    }
    .deploy-log-line {
      color: #525252;
      margin-bottom: 4px;
    }
    .deploy-log-line.success {
      color: var(--success);
    }
    .deploy-log-line.error {
      color: var(--error);
    }
    .deploy-status {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      background: var(--bg-card);
      border-radius: 8px;
      margin-bottom: 16px;
    }
    .deploy-status-icon {
      font-size: 24px;
    }
    .deploy-status-icon.spinning {
      animation: spin 1s linear infinite;
    }
    .deploy-progress {
      display: flex;
      gap: 8px;
      margin-bottom: 16px;
    }
    .deploy-step {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }
    .deploy-step-dot {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: var(--bg-card);
      border: 2px solid var(--border-color);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      font-weight: 600;
      transition: all 0.3s ease;
    }
    .deploy-step-dot.active {
      background: var(--accent);
      border-color: var(--accent);
      color: white;
    }
    .deploy-step-dot.completed {
      background: var(--success);
      border-color: var(--success);
      color: white;
    }
    .deploy-step-dot.failed {
      background: var(--error);
      border-color: var(--error);
      color: white;
    }
    .deploy-step-label {
      font-size: 10px;
      color: var(--text-secondary);
      text-align: center;
    }
    .deploy-step-label.active {
      color: var(--accent);
      font-weight: 600;
    }
    .deploy-status-text h3 {
      font-size: 14px;
      font-weight: 600;
    }
    .deploy-status-text p {
      font-size: 12px;
      color: var(--text-secondary);
    }
    .deploy-url {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 12px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 16px;
    }
    .deploy-url a {
      color: var(--accent);
      text-decoration: none;
      font-size: 13px;
    }
    .deploy-url a:hover {
      text-decoration: underline;
    }
    .deploy-url-actions {
      display: flex;
      gap: 8px;
    }
    .deploy-url-btn {
      padding: 6px 12px;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      background: var(--bg-tertiary);
      color: var(--text-primary);
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s;
    }
    .deploy-url-btn:hover {
      background: var(--bg-hover);
      border-color: var(--accent);
    }
    .deploy-url-btn.copied {
      background: var(--success-bg);
      border-color: var(--success);
      color: var(--success);
    }

    /* Confetti celebration */
    @keyframes confetti-fall {
      0% { transform: translateY(-100vh) rotate(0deg); opacity: 1; }
      100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
    }
    .confetti-container {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      overflow: hidden;
      z-index: 10000;
    }
    .confetti {
      position: absolute;
      width: 10px;
      height: 10px;
      animation: confetti-fall 3s ease-out forwards;
    }

    /* Typing indicator */
    .typing-indicator {
      display: flex;
      gap: 4px;
      padding: 12px 16px;
      align-items: center;
    }
    .typing-dot {
      width: 8px;
      height: 8px;
      background: var(--text-muted);
      border-radius: 50%;
      animation: typing-bounce 1.4s ease-in-out infinite;
    }
    .typing-dot:nth-child(2) { animation-delay: 0.2s; }
    .typing-dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes typing-bounce {
      0%, 60%, 100% { transform: translateY(0); }
      30% { transform: translateY(-6px); }
    }

    /* Success celebration pulse */
    @keyframes success-pulse {
      0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4); }
      70% { box-shadow: 0 0 0 20px rgba(34, 197, 94, 0); }
      100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
    }
    .deploy-success-celebration {
      animation: success-pulse 1s ease-out;
    }

    /* User menu */
    .user-menu {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .user-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: var(--accent);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      font-weight: 600;
      color: white;
    }
    .user-name {
      font-size: 13px;
      color: var(--text-secondary);
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <script>
    const { useState, useEffect, useRef, useCallback } = React;

    // Backend API URL
    const API_URL = 'http://localhost:4000/api';

    // Auth helper
    function getAuthHeaders() {
      const token = localStorage.getItem('brick_token');
      return token ? { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
    }

    // Simple syntax highlighting for code
    function highlightSyntax(code) {
      return code
        // Comments
        .replace(/(\\\/\\\/.*$)/gm, '<span style="color:#6B7280">$1</span>')
        // Strings (double quotes, single quotes)
        .replace(/(&quot;[^&]*&quot;|'[^']*')/g, '<span style="color:#10B981">$1</span>')
        // Keywords
        .replace(/\\b(const|let|var|function|return|import|export|from|class|extends|async|await|if|else|for|while|switch|case|break|try|catch|throw|new|this|typeof|instanceof)\\b/g, '<span style="color:#8B5CF6;font-weight:600">$1</span>')
        // Numbers
        .replace(/\\b(\\d+\\.?\\d*)\\b/g, '<span style="color:#F59E0B">$1</span>')
        // Built-ins
        .replace(/\\b(console|document|window|Promise|Array|Object|String|Number|Boolean|null|undefined|true|false)\\b/g, '<span style="color:#EC4899">$1</span>');
    }

    // Simple markdown to HTML parser
    function parseMarkdown(md) {
      if (!md) return '';
      return md
        // Headers (do first before other processing)
        .replace(/^### (.*$)/gm, '<h3>$1</h3>')
        .replace(/^## (.*$)/gm, '<h2>$1</h2>')
        .replace(/^# (.*$)/gm, '<h1>$1</h1>')
        // Bold and italic
        .replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>')
        .replace(/\\*([^*]+)\\*/g, '<em>$1</em>')
        // Lists
        .replace(/^- (.*$)/gm, '<li>$1</li>')
        // Blockquotes
        .replace(/^> (.*$)/gm, '<blockquote>$1</blockquote>')
        // Line breaks
        .replace(/\\n/g, '<br>');
    }

    // SVG Icons for components (Eraser.io / DigitalOcean style)
    const SVG_ICONS = {
      // Compute
      service: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/></svg>',
      static_site: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
      worker: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
      job: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
      function: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 17l6-6-6-6"/><path d="M12 19h8"/></svg>',
      container: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>',
      // Data
      database: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>',
      cache: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>',
      queue: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
      storage: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
      search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
      // Infrastructure
      api_gateway: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>',
      load_balancer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>',
      cdn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><line x1="12" y1="2" x2="12" y2="22"/></svg>',
      dns: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>',
      firewall: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
      // Platform Services
      auth: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
      monitoring: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>',
      logging: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>',
      secrets: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>',
      registry: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>',
      // External / Third-party
      email: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
      payment: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>',
      analytics: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
      ml_model: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a4 4 0 0 1 4 4c0 1.1-.9 2-2 2h-4a2 2 0 0 1-2-2 4 4 0 0 1 4-4z"/><path d="M8 8v6a4 4 0 0 0 8 0V8"/><circle cx="9" cy="13" r="1"/><circle cx="15" cy="13" r="1"/><path d="M9 17s.9 1 3 1 3-1 3-1"/><line x1="12" y1="18" x2="12" y2="22"/></svg>',
      third_party: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>',
    };

    // Eraser.io inspired color palette - pastel backgrounds with colored headers
    // Organized by category for the component palette
    const COMPONENT_STYLES = {
      // Compute - Blue/Purple tones
      service: { bg: '#EEF2FF', header: '#6366F1', icon: SVG_ICONS.service, iconify: 'solar:server-linear', label: 'SERVICE', emoji: '⚡', category: 'Compute' },
      static_site: { bg: '#F3E8FF', header: '#A855F7', icon: SVG_ICONS.static_site, iconify: 'solar:monitor-smartphone-linear', label: 'STATIC SITE', emoji: '🌐', category: 'Compute' },
      worker: { bg: '#FEF3C7', header: '#F59E0B', icon: SVG_ICONS.worker, iconify: 'solar:cpu-bolt-linear', label: 'WORKER', emoji: '⚙️', category: 'Compute' },
      job: { bg: '#FCE7F3', header: '#EC4899', icon: SVG_ICONS.job, iconify: 'solar:clock-circle-linear', label: 'JOB', emoji: '⏰', category: 'Compute' },
      function: { bg: '#ECFEFF', header: '#06B6D4', icon: SVG_ICONS.function, iconify: 'solar:code-square-linear', label: 'FUNCTION', emoji: 'λ', category: 'Compute' },
      container: { bg: '#EFF6FF', header: '#3B82F6', icon: SVG_ICONS.container, iconify: 'solar:box-linear', label: 'CONTAINER', emoji: '📦', category: 'Compute' },
      // Data - Green tones
      database: { bg: '#DCFCE7', header: '#22C55E', icon: SVG_ICONS.database, iconify: 'solar:database-linear', label: 'DATABASE', emoji: '🗄️', category: 'Data' },
      cache: { bg: '#FEF9C3', header: '#EAB308', icon: SVG_ICONS.cache, iconify: 'solar:bolt-linear', label: 'CACHE', emoji: '⚡', category: 'Data' },
      queue: { bg: '#FFEDD5', header: '#EA580C', icon: SVG_ICONS.queue, iconify: 'solar:letter-linear', label: 'QUEUE', emoji: '📨', category: 'Data' },
      storage: { bg: '#D1FAE5', header: '#10B981', icon: SVG_ICONS.storage, iconify: 'solar:cloud-storage-linear', label: 'STORAGE', emoji: '📁', category: 'Data' },
      search: { bg: '#FEE2E2', header: '#EF4444', icon: SVG_ICONS.search, iconify: 'solar:magnifer-linear', label: 'SEARCH', emoji: '🔍', category: 'Data' },
      // Infrastructure - Gray/Slate tones
      api_gateway: { bg: '#F1F5F9', header: '#475569', icon: SVG_ICONS.api_gateway, iconify: 'solar:routing-2-linear', label: 'API GATEWAY', emoji: '🚪', category: 'Infrastructure' },
      load_balancer: { bg: '#E0E7FF', header: '#4F46E5', icon: SVG_ICONS.load_balancer, iconify: 'solar:sort-vertical-linear', label: 'LOAD BALANCER', emoji: '⚖️', category: 'Infrastructure' },
      cdn: { bg: '#DBEAFE', header: '#2563EB', icon: SVG_ICONS.cdn, iconify: 'solar:global-linear', label: 'CDN', emoji: '🌍', category: 'Infrastructure' },
      dns: { bg: '#E0F2FE', header: '#0284C7', icon: SVG_ICONS.dns, iconify: 'solar:link-linear', label: 'DNS', emoji: '🔗', category: 'Infrastructure' },
      firewall: { bg: '#FEE2E2', header: '#DC2626', icon: SVG_ICONS.firewall, iconify: 'solar:shield-check-linear', label: 'FIREWALL', emoji: '🛡️', category: 'Infrastructure' },
      // Platform Services - Teal/Cyan tones
      auth: { bg: '#CCFBF1', header: '#0D9488', icon: SVG_ICONS.auth, iconify: 'solar:lock-linear', label: 'AUTH', emoji: '🔐', category: 'Platform' },
      monitoring: { bg: '#FDF4FF', header: '#C026D3', icon: SVG_ICONS.monitoring, iconify: 'solar:chart-2-linear', label: 'MONITORING', emoji: '📊', category: 'Platform' },
      logging: { bg: '#F5F5F4', header: '#78716C', icon: SVG_ICONS.logging, iconify: 'solar:document-text-linear', label: 'LOGGING', emoji: '📝', category: 'Platform' },
      secrets: { bg: '#FEF2F2', header: '#B91C1C', icon: SVG_ICONS.secrets, iconify: 'solar:key-linear', label: 'SECRETS', emoji: '🔑', category: 'Platform' },
      registry: { bg: '#F0FDF4', header: '#16A34A', icon: SVG_ICONS.registry, iconify: 'solar:box-minimalistic-linear', label: 'REGISTRY', emoji: '🏭', category: 'Platform' },
      // External / Third-party - Various
      email: { bg: '#FFF7ED', header: '#C2410C', icon: SVG_ICONS.email, iconify: 'solar:letter-linear', label: 'EMAIL', emoji: '✉️', category: 'External' },
      payment: { bg: '#EDE9FE', header: '#7C3AED', icon: SVG_ICONS.payment, iconify: 'solar:card-linear', label: 'PAYMENT', emoji: '💳', category: 'External' },
      analytics: { bg: '#FDF2F8', header: '#DB2777', icon: SVG_ICONS.analytics, iconify: 'solar:graph-up-linear', label: 'ANALYTICS', emoji: '📈', category: 'External' },
      ml_model: { bg: '#F0FDFA', header: '#14B8A6', icon: SVG_ICONS.ml_model, iconify: 'solar:magic-stick-3-linear', label: 'ML MODEL', emoji: '🤖', category: 'External' },
      third_party: { bg: '#F8FAFC', header: '#64748B', icon: SVG_ICONS.third_party, iconify: 'solar:plug-circle-linear', label: 'EXTERNAL', emoji: '🔌', category: 'External' },
    };
    const COMPONENT_CATEGORIES = ['Compute', 'Data', 'Infrastructure', 'Platform', 'External'];

    // Derive ICONS and COLORS from COMPONENT_STYLES for backward compatibility
    const ICONS = Object.fromEntries(Object.entries(COMPONENT_STYLES).map(([k, v]) => [k, v.emoji]));
    const COLORS = Object.fromEntries(Object.entries(COMPONENT_STYLES).map(([k, v]) => [k, v.header]));

    // Dagre layout options
    const LAYOUT_OPTIONS = {
      TB: { rankdir: 'TB', nodesep: 80, ranksep: 100, marginx: 100, marginy: 100, align: 'UL' }, // Top to Bottom
      LR: { rankdir: 'LR', nodesep: 60, ranksep: 120, marginx: 100, marginy: 100, align: 'UL' }, // Left to Right
      BT: { rankdir: 'BT', nodesep: 80, ranksep: 100, marginx: 100, marginy: 100, align: 'UL' }, // Bottom to Top
      RL: { rankdir: 'RL', nodesep: 60, ranksep: 120, marginx: 100, marginy: 100, align: 'UL' }, // Right to Left
    };

    function layoutGraph(components, nodePositions, connections, direction = 'TB') {
      if (!components || components.length === 0) return { nodes: [], edges: [], width: 0, height: 0, offsetX: 0, offsetY: 0 };

      const g = new dagre.graphlib.Graph();
      const layoutOpts = LAYOUT_OPTIONS[direction] || LAYOUT_OPTIONS.TB;
      g.setGraph(layoutOpts);
      g.setDefaultEdgeLabel(() => ({}));

      // Set nodes with proper dimensions
      const nodeWidth = 180;
      const nodeHeight = 90;
      components.forEach(c => g.setNode(c.id, { width: nodeWidth, height: nodeHeight, component: c }));

      // Set edges - use connections array if provided (for manualArch), otherwise use component.connections
      if (connections && connections.length > 0) {
        connections.forEach(conn => g.setEdge(conn.from, conn.to, { label: conn.label }));
      } else {
        components.forEach(c => (c.connections || []).forEach(t => g.setEdge(c.id, t)));
      }

      // Run dagre layout algorithm
      dagre.layout(g);

      const nodes = [], edges = [];

      // Extract node positions - use dagre positions or override with custom positions
      g.nodes().forEach(id => {
        const n = g.node(id);
        if (n && n.component) {
          const customPos = nodePositions[id];
          const x = customPos ? customPos.x : n.x;
          const y = customPos ? customPos.y : n.y;
          nodes.push({ id, x, y, width: n.width, height: n.height, ...n.component });
        }
      });

      // Extract edges with labels
      g.edges().forEach(e => {
        const src = nodes.find(n => n.id === e.v);
        const tgt = nodes.find(n => n.id === e.w);
        const edgeData = g.edge(e);
        if (src && tgt) {
          edges.push({
            id: e.v + '-' + e.w,
            from: e.v,
            to: e.w,
            x1: src.x,
            y1: src.y + src.height/2,
            x2: tgt.x,
            y2: tgt.y - tgt.height/2,
            label: edgeData?.label || null
          });
        }
      });

      // Calculate bounds
      if (nodes.length === 0) return { nodes: [], edges: [], width: 600, height: 400, offsetX: 0, offsetY: 0 };

      const minX = Math.min(...nodes.map(n => n.x - n.width/2));
      const maxX = Math.max(...nodes.map(n => n.x + n.width/2));
      const minY = Math.min(...nodes.map(n => n.y - n.height/2));
      const maxY = Math.max(...nodes.map(n => n.y + n.height/2));

      return {
        nodes,
        edges,
        width: Math.max(maxX - minX + 160, 600),
        height: Math.max(maxY - minY + 160, 400),
        offsetX: minX - 80,
        offsetY: minY - 80
      };
    }

    // Auto-layout function to reorganize all nodes using dagre
    function autoLayoutNodes(components, connections, direction = 'TB') {
      if (!components || components.length === 0) return {};

      const g = new dagre.graphlib.Graph();
      const layoutOpts = LAYOUT_OPTIONS[direction] || LAYOUT_OPTIONS.TB;
      g.setGraph(layoutOpts);
      g.setDefaultEdgeLabel(() => ({}));

      components.forEach(c => g.setNode(c.id, { width: 180, height: 90 }));
      connections.forEach(conn => g.setEdge(conn.from, conn.to));

      dagre.layout(g);

      const positions = {};
      g.nodes().forEach(id => {
        const n = g.node(id);
        if (n) {
          positions[id] = { x: n.x, y: n.y };
        }
      });

      return positions;
    }

    // React Flow Canvas Component - Eraser.io Style
    function Canvas({ ir, manualArch, componentSpecs, onNodeClick, onNodeDrag, connectingFrom, onStartConnect, onDeleteNode, onDeleteConnection, builderMode, onAutoLayout, onUndo, onRedo, canUndo, canRedo }) {
      // Get React hooks
      const { useMemo, useCallback, useEffect } = React;

      // Get React Flow from global (loaded via CDN)
      const RF = window.ReactFlow;
      const { ReactFlow: ReactFlowComponent, Background, Controls, MiniMap, useNodesState, useEdgesState, addEdge, MarkerType, Handle, Position } = RF;

      // Convert architecture to React Flow format
      const components = manualArch ? manualArch.components : ir?.components || [];
      const connections = manualArch ? manualArch.connections : [];

      // Custom Node Component
      const ComponentNode = useCallback(({ data, selected }) => {
        const style = COMPONENT_STYLES[data.type] || COMPONENT_STYLES.service;
        const hasSpec = componentSpecs && componentSpecs[data.nodeId] && (
          componentSpecs[data.nodeId].description || componentSpecs[data.nodeId].inputs ||
          componentSpecs[data.nodeId].outputs || componentSpecs[data.nodeId].notes
        );
        const innerComponents = componentSpecs?.[data.nodeId]?.innerComponents || [];
        // Deployment status from data (can be 'not_deployed', 'deploying', 'live', 'failed')
        const deployStatus = data.deployStatus || 'not_deployed';
        const statusClass = deployStatus !== 'not_deployed' ? ' ' + deployStatus : '';

        return React.createElement('div', {
          className: 'rf-node' + (selected ? ' selected' : '') + statusClass,
          style: { '--node-accent-color': style.header },
          onClick: () => onNodeClick && onNodeClick({ id: data.nodeId, name: data.label, type: data.type })
        },
          // Top handle for incoming connections
          React.createElement(Handle, { type: 'target', position: Position.Top, style: { background: '#94A3B8' } }),
          // Header
          React.createElement('div', { className: 'rf-node-header' },
            React.createElement('div', {
              className: 'rf-node-icon',
              style: { background: style.bg }
            },
              React.createElement('iconify-icon', {
                icon: style.iconify || 'solar:server-linear',
                width: 20,
                style: { color: style.header }
              })
            ),
            React.createElement('div', { className: 'rf-node-info' },
              React.createElement('div', { className: 'rf-node-name' }, data.label),
              React.createElement('div', { className: 'rf-node-type' }, style.label)
            )
          ),
          // Body with inner components (if any)
          innerComponents.length > 0 && React.createElement('div', { className: 'rf-node-body' },
            React.createElement('div', { className: 'rf-node-inner-items' },
              innerComponents.map((item, i) =>
                React.createElement('div', { key: i, className: 'rf-node-inner-item' },
                  React.createElement('iconify-icon', {
                    icon: 'solar:widget-linear',
                    width: 14,
                    className: 'rf-node-inner-item-icon'
                  }),
                  React.createElement('div', null,
                    React.createElement('div', { className: 'rf-node-inner-item-name' }, item.name),
                    item.description && React.createElement('div', { className: 'rf-node-inner-item-desc' }, item.description)
                  )
                )
              )
            )
          ),
          // Status footer
          React.createElement('div', { className: 'rf-node-status' },
            React.createElement('div', { className: 'rf-node-status-indicator' },
              React.createElement('div', {
                className: 'rf-node-status-dot' + (deployStatus !== 'not_deployed' ? ' ' + deployStatus : (hasSpec ? ' configured' : ''))
              }),
              deployStatus === 'deploying' ? 'Deploying...' :
              deployStatus === 'live' ? 'Live' :
              deployStatus === 'failed' ? 'Failed' :
              hasSpec ? 'Ready' : 'Not configured'
            ),
            builderMode && React.createElement('div', { className: 'rf-node-actions' },
              onStartConnect && React.createElement('button', {
                className: 'rf-node-action-btn',
                onClick: (e) => { e.stopPropagation(); onStartConnect(data.nodeId); },
                title: 'Connect'
              }, React.createElement('iconify-icon', { icon: 'solar:link-linear', width: 12 })),
              onDeleteNode && React.createElement('button', {
                className: 'rf-node-action-btn delete',
                onClick: (e) => { e.stopPropagation(); onDeleteNode(data.nodeId); },
                title: 'Delete'
              }, React.createElement('iconify-icon', { icon: 'solar:trash-bin-2-linear', width: 12 }))
            )
          ),
          // Bottom handle for outgoing connections
          React.createElement(Handle, { type: 'source', position: Position.Bottom, style: { background: '#94A3B8' } })
        );
      }, [componentSpecs, builderMode, onNodeClick, onStartConnect, onDeleteNode]);

      // Map component types to iconify icons
      const getIconifyIcon = (type) => {
        const iconMap = {
          service: 'solar:server-linear',
          static_site: 'solar:monitor-smartphone-linear',
          database: 'solar:database-linear',
          cache: 'solar:bolt-linear',
          queue: 'solar:letter-linear',
          worker: 'solar:cpu-bolt-linear',
          job: 'solar:clock-circle-linear',
          function: 'solar:code-linear',
          container: 'solar:box-linear',
          api_gateway: 'solar:routing-2-linear',
          load_balancer: 'solar:sort-linear',
          cdn: 'solar:global-linear',
          auth: 'solar:lock-linear',
          storage: 'solar:cloud-storage-linear',
          monitoring: 'solar:chart-2-linear',
          ml_model: 'solar:magic-stick-3-linear'
        };
        return iconMap[type] || 'solar:server-linear';
      };

      // Convert components to React Flow nodes
      const initialNodes = useMemo(() => {
        if (!components || components.length === 0) return [];
        return components.map((comp, index) => ({
          id: comp.id,
          type: 'component',
          position: { x: comp.x || 100 + (index % 3) * 280, y: comp.y || 100 + Math.floor(index / 3) * 180 },
          data: {
            label: comp.name,
            type: comp.type,
            nodeId: comp.id
          },
          style: { width: 220 }
        }));
      }, [components]);

      // Convert connections to React Flow edges
      const initialEdges = useMemo(() => {
        if (!connections || connections.length === 0) return [];
        const typeColors = {
          service: '#6366F1', static_site: '#A855F7', database: '#22C55E',
          worker: '#F59E0B', job: '#EC4899', cache: '#EF4444'
        };
        return connections.map(conn => {
          const srcComp = components.find(c => c.id === conn.from);
          const color = typeColors[srcComp?.type] || '#6366F1';
          return {
            id: conn.from + '-' + conn.to,
            source: conn.from,
            target: conn.to,
            type: 'smoothstep',
            animated: false,
            style: { stroke: color, strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed, color }
          };
        });
      }, [connections, components]);

      const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
      const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

      // Track initial mount and component count to prevent resetting positions on click
      const isInitialMount = React.useRef(true);
      const prevComponentCount = React.useRef(components.length);
      const prevComponentIds = React.useRef(components.map(c => c.id).join(','));

      // Update nodes only on initial mount or when components are added/removed
      useEffect(() => {
        const currentIds = components.map(c => c.id).join(',');
        if (isInitialMount.current) {
          setNodes(initialNodes);
          isInitialMount.current = false;
          prevComponentCount.current = components.length;
          prevComponentIds.current = currentIds;
        } else if (components.length !== prevComponentCount.current || currentIds !== prevComponentIds.current) {
          // Components added or removed - update nodes while preserving positions of existing nodes
          setNodes(currentNodes => {
            const existingPositions = {};
            currentNodes.forEach(n => { existingPositions[n.id] = n.position; });
            return initialNodes.map(n => ({
              ...n,
              position: existingPositions[n.id] || n.position
            }));
          });
          prevComponentCount.current = components.length;
          prevComponentIds.current = currentIds;
        }
      }, [initialNodes, setNodes, components]);

      useEffect(() => {
        setEdges(initialEdges);
      }, [initialEdges, setEdges]);

      // Handle node drag end
      const handleNodeDragStop = useCallback((event, node) => {
        if (onNodeDrag && builderMode) {
          onNodeDrag(node.id, { x: node.position.x, y: node.position.y });
        }
      }, [onNodeDrag, builderMode]);

      // Handle new connection
      const onConnect = useCallback((params) => {
        if (builderMode) {
          // Call parent handler to save connection
          const srcComp = components.find(c => c.id === params.source);
          const color = { service: '#6366F1', static_site: '#A855F7', database: '#22C55E' }[srcComp?.type] || '#6366F1';
          setEdges((eds) => addEdge({
            ...params,
            type: 'smoothstep',
            style: { stroke: color, strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed, color }
          }, eds));
          // TODO: Call API to save connection
        }
      }, [builderMode, setEdges, components]);

      // Node types for React Flow
      const nodeTypes = useMemo(() => ({
        component: ComponentNode
      }), [ComponentNode]);

      // Empty state
      if (components.length === 0) {
        return React.createElement('div', { className: 'empty-state', style: { height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', background: '#FAFAFA' } },
          React.createElement('iconify-icon', { icon: 'solar:layers-minimalistic-linear', width: 48, style: { color: '#94A3B8', marginBottom: 16 } }),
          React.createElement('p', { style: { color: '#64748B' } }, builderMode ? 'Drag components here or click to add' : 'Your architecture will appear here')
        );
      }

      return React.createElement('div', { style: { width: '100%', height: '100%' } },
        React.createElement(ReactFlowComponent, {
          nodes,
          edges,
          onNodesChange: builderMode ? onNodesChange : undefined,
          onEdgesChange: builderMode ? onEdgesChange : undefined,
          onConnect: builderMode ? onConnect : undefined,
          onNodeDragStop: handleNodeDragStop,
          nodeTypes,
          fitView: true,
          fitViewOptions: { padding: 0.2 },
          minZoom: 0.25,
          maxZoom: 2,
          defaultEdgeOptions: {
            type: 'smoothstep',
            style: { strokeWidth: 2 }
          },
          proOptions: { hideAttribution: true }
        },
          React.createElement(Background, { color: '#E2E8F0', gap: 20, size: 1 }),
          React.createElement(Controls, { showInteractive: false }),
          React.createElement(MiniMap, {
            nodeColor: (node) => {
              const style = COMPONENT_STYLES[node.data?.type] || COMPONENT_STYLES.service;
              return style.header;
            },
            maskColor: 'rgba(0,0,0,0.1)',
            style: { background: 'white' }
          })
        )
      );
    }

    // File tree recursive component
    // Monaco Editor wrapper component
    function MonacoEditorWrapper({ value, language, onChange, readOnly }) {
      const containerRef = React.useRef(null);
      const editorRef = React.useRef(null);
      const valueRef = React.useRef(value);

      React.useEffect(() => {
        if (!containerRef.current || !window.monaco) return;

        const editor = window.monaco.editor.create(containerRef.current, {
          value: value || '',
          language: language || 'typescript',
          theme: 'vs-dark',
          readOnly: readOnly || false,
          minimap: { enabled: false },
          fontSize: 13,
          fontFamily: "'JetBrains Mono', 'SF Mono', Monaco, monospace",
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          automaticLayout: true,
          padding: { top: 12 },
          renderLineHighlight: 'line',
          wordWrap: 'on',
          tabSize: 2,
        });

        editorRef.current = editor;

        if (onChange) {
          editor.onDidChangeModelContent(() => {
            const newValue = editor.getValue();
            valueRef.current = newValue;
            onChange(newValue);
          });
        }

        return () => editor.dispose();
      }, []);

      React.useEffect(() => {
        if (editorRef.current && value !== valueRef.current) {
          const editor = editorRef.current;
          editor.setValue(value || '');
          valueRef.current = value;
          // Update language when file changes
          if (language) {
            window.monaco.editor.setModelLanguage(editor.getModel(), language);
          }
        }
      }, [value, language]);

      return React.createElement('div', {
        ref: containerRef,
        style: { width: '100%', height: '100%' }
      });
    }

    // Get Monaco language from file extension
    function getMonacoLanguage(filePath) {
      if (!filePath) return 'plaintext';
      const ext = filePath.split('.').pop().toLowerCase();
      const langMap = {
        ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
        json: 'json', md: 'markdown', html: 'html', css: 'css',
        py: 'python', go: 'go', rs: 'rust', yaml: 'yaml', yml: 'yaml',
        sh: 'shell', bash: 'shell', sql: 'sql', xml: 'xml',
      };
      return langMap[ext] || 'plaintext';
    }

    function FileTreeNode({ tree, selectedFile, onSelect, level }) {
      const [collapsed, setCollapsed] = React.useState({});

      const toggleDir = (name) => {
        setCollapsed(prev => ({ ...prev, [name]: !prev[name] }));
      };

      const entries = Object.entries(tree).sort((a, b) => {
        // Directories first, then files
        if (a[1].type === 'dir' && b[1].type !== 'dir') return -1;
        if (a[1].type !== 'dir' && b[1].type === 'dir') return 1;
        return a[0].localeCompare(b[0]);
      });

      return React.createElement(React.Fragment, null,
        entries.map(([name, node]) => {
          if (node.type === 'dir') {
            const isCollapsed = collapsed[name];
            return React.createElement('div', { key: name },
              React.createElement('div', {
                className: 'tree-item dir',
                onClick: () => toggleDir(name),
                style: { cursor: 'pointer' }
              },
                React.createElement('span', { className: 'icon', style: { fontSize: 10, transition: 'transform 0.15s', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' } }, '▼'),
                React.createElement('span', { className: 'icon' }, isCollapsed ? '📁' : '📂'),
                name
              ),
              !isCollapsed && React.createElement('div', { className: 'tree-children' },
                React.createElement(FileTreeNode, {
                  tree: node.children,
                  selectedFile,
                  onSelect,
                  level: level + 1
                })
              )
            );
          } else {
            const ext = name.split('.').pop();
            const icons = {
              ts: '📘', tsx: '📘', js: '📒', jsx: '📒',
              json: '📋', md: '📝', yaml: '📄', yml: '📄',
              css: '🎨', html: '🌐', py: '🐍', go: '🔵',
              Dockerfile: '🐳', gitignore: '👁️'
            };
            const icon = icons[ext] || icons[name] || '📄';

            return React.createElement('div', {
              key: name,
              className: 'tree-item' + (node.path === selectedFile ? ' selected' : ''),
              onClick: () => onSelect(node.path)
            },
              React.createElement('span', { className: 'icon' }, icon),
              name,
              node.componentId && React.createElement('span', { className: 'tree-component-badge' }, node.componentId)
            );
          }
        })
      );
    }

    // Extract components from partial Mermaid for live preview
    function extractPreviewComponents(content) {
      var components = [];
      // Look for mermaid code block - use string matching instead of regex with backticks
      var startMarker = String.fromCharCode(96,96,96) + 'mermaid';
      var endMarker = String.fromCharCode(96,96,96);
      var startIdx = content.indexOf(startMarker);
      if (startIdx === -1) return components;

      var afterStart = content.substring(startIdx + startMarker.length);
      var endIdx = afterStart.indexOf(endMarker);
      var mermaidCode = endIdx >= 0 ? afterStart.substring(0, endIdx) : afterStart;
      var lines = mermaidCode.split('\\n');

      for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        // Match node definitions: A[Name], A([Name]), A[(Name)], A((Name)), A{{Name}}
        var nodeMatch = line.match(/^\\s*(\\w+)[\\[\\(\\{]+(.+?)[\\]\\)\\}]+/);
        if (nodeMatch) {
          var id = nodeMatch[1];
          var name = nodeMatch[2].replace(/[\\[\\]\\(\\)\\{\\}]/g, '');
          // Infer type from shape
          var type = 'service';
          if (line.indexOf('[(') >= 0 || line.indexOf(')]') >= 0) type = 'database';
          else if (line.indexOf('([') >= 0 || line.indexOf('])') >= 0) type = 'static_site';
          else if (line.indexOf('((') >= 0 || line.indexOf('))') >= 0) type = 'worker';
          else if (line.indexOf('{{') >= 0 || line.indexOf('}}') >= 0) type = 'job';

          if (!components.find(function(c) { return c.id === id; })) {
            components.push({ id: id, name: name, type: type });
          }
        }
      }
      return components;
    }

    // Architecture pattern suggestions for autocomplete
    const AUTOCOMPLETE_PATTERNS = [
      { trigger: 'add', suggestions: ['add caching with Redis', 'add authentication', 'add a message queue', 'add a CDN', 'add monitoring'] },
      { trigger: 'scale', suggestions: ['scale with a load balancer', 'scale the database with replicas', 'add horizontal scaling'] },
      { trigger: 'build', suggestions: ['build a blog with Next.js and PostgreSQL', 'build a SaaS with React and Node.js', 'build an API with Go and Redis'] },
      { trigger: 'create', suggestions: ['create a microservices architecture', 'create a serverless backend', 'create a data pipeline'] },
      { trigger: 'deploy', suggestions: ['deploy to production', 'deploy with zero downtime', 'deploy a staging environment'] }
    ];

    // Command Palette commands
    const COMMAND_PALETTE_COMMANDS = [
      // Components - Add
      { id: 'add-service', name: 'Add Service', desc: 'Add a backend service', icon: 'solar:server-linear', category: 'Add Component', action: 'addComponent', type: 'service', color: '#6366F1' },
      { id: 'add-database', name: 'Add Database', desc: 'Add a database', icon: 'solar:database-linear', category: 'Add Component', action: 'addComponent', type: 'database', color: '#22C55E' },
      { id: 'add-cache', name: 'Add Cache', desc: 'Add Redis or Memcached', icon: 'solar:bolt-linear', category: 'Add Component', action: 'addComponent', type: 'cache', color: '#EAB308' },
      { id: 'add-queue', name: 'Add Queue', desc: 'Add a message queue', icon: 'solar:letter-linear', category: 'Add Component', action: 'addComponent', type: 'queue', color: '#EA580C' },
      { id: 'add-worker', name: 'Add Worker', desc: 'Add a background worker', icon: 'solar:cpu-bolt-linear', category: 'Add Component', action: 'addComponent', type: 'worker', color: '#F59E0B' },
      { id: 'add-static-site', name: 'Add Static Site', desc: 'Add a frontend or SPA', icon: 'solar:monitor-smartphone-linear', category: 'Add Component', action: 'addComponent', type: 'static_site', color: '#A855F7' },
      { id: 'add-storage', name: 'Add Storage', desc: 'Add object storage (S3)', icon: 'solar:cloud-storage-linear', category: 'Add Component', action: 'addComponent', type: 'storage', color: '#10B981' },
      // Actions
      { id: 'deploy', name: 'Deploy', desc: 'Deploy to cloud', icon: 'solar:cloud-upload-linear', category: 'Actions', action: 'deploy', shortcut: '\u2318D', color: '#6366F1' },
      { id: 'export', name: 'Export YAML', desc: 'Export as App Spec YAML', icon: 'solar:export-linear', category: 'Actions', action: 'export', shortcut: '\u2318E', color: '#94A3B8' },
      { id: 'save', name: 'Save Project', desc: 'Save current project', icon: 'solar:diskette-linear', category: 'Actions', action: 'save', shortcut: '\u2318S', color: '#94A3B8' },
      { id: 'auto-layout', name: 'Auto Layout', desc: 'Reorganize nodes automatically', icon: 'solar:widget-4-linear', category: 'Actions', action: 'autoLayout', color: '#94A3B8' },
      // Navigation
      { id: 'view-architecture', name: 'View Architecture', desc: 'Switch to architecture view', icon: 'solar:layers-linear', category: 'Navigation', action: 'setView', view: 'architecture', color: '#94A3B8' },
      { id: 'view-code', name: 'View Code', desc: 'Switch to code view', icon: 'solar:code-linear', category: 'Navigation', action: 'setView', view: 'code', color: '#94A3B8' },
      { id: 'view-docs', name: 'View Documentation', desc: 'Switch to docs view', icon: 'solar:document-text-linear', category: 'Navigation', action: 'setView', view: 'docs', color: '#94A3B8' },
      { id: 'back-to-dashboard', name: 'Back to Dashboard', desc: 'Return to dashboard', icon: 'solar:home-2-linear', category: 'Navigation', action: 'goToDashboard', color: '#94A3B8' },
    ];

    // Command Palette Component
    function CommandPalette({ isOpen, onClose, onCommand }) {
      const [query, setQuery] = React.useState('');
      const [selectedIndex, setSelectedIndex] = React.useState(0);
      const inputRef = React.useRef(null);

      // Filter commands based on query
      const filteredCommands = React.useMemo(() => {
        if (!query.trim()) return COMMAND_PALETTE_COMMANDS;
        const q = query.toLowerCase();
        return COMMAND_PALETTE_COMMANDS.filter(cmd =>
          cmd.name.toLowerCase().includes(q) ||
          cmd.desc.toLowerCase().includes(q) ||
          cmd.category.toLowerCase().includes(q)
        );
      }, [query]);

      // Group commands by category
      const groupedCommands = React.useMemo(() => {
        const groups = {};
        filteredCommands.forEach(cmd => {
          if (!groups[cmd.category]) groups[cmd.category] = [];
          groups[cmd.category].push(cmd);
        });
        return groups;
      }, [filteredCommands]);

      // Focus input when opened
      React.useEffect(() => {
        if (isOpen && inputRef.current) {
          inputRef.current.focus();
          setQuery('');
          setSelectedIndex(0);
        }
      }, [isOpen]);

      // Keyboard navigation
      React.useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e) => {
          if (e.key === 'Escape') {
            onClose();
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(i => Math.min(i + 1, filteredCommands.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(i => Math.max(i - 1, 0));
          } else if (e.key === 'Enter' && filteredCommands[selectedIndex]) {
            e.preventDefault();
            onCommand(filteredCommands[selectedIndex]);
            onClose();
          }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
      }, [isOpen, onClose, onCommand, filteredCommands, selectedIndex]);

      // Reset selection when query changes
      React.useEffect(() => {
        setSelectedIndex(0);
      }, [query]);

      if (!isOpen) return null;

      let flatIndex = 0;

      return React.createElement('div', {
        className: 'command-palette-overlay',
        onClick: (e) => { if (e.target === e.currentTarget) onClose(); }
      },
        React.createElement('div', { className: 'command-palette' },
          // Search input
          React.createElement('div', { className: 'command-palette-input-wrapper' },
            React.createElement('iconify-icon', { icon: 'solar:magnifer-linear', width: 20 }),
            React.createElement('input', {
              ref: inputRef,
              className: 'command-palette-input',
              type: 'text',
              placeholder: 'Search commands...',
              value: query,
              onChange: (e) => setQuery(e.target.value)
            }),
            React.createElement('span', { className: 'command-palette-kbd' }, 'ESC')
          ),
          // Results
          React.createElement('div', { className: 'command-palette-results' },
            filteredCommands.length === 0
              ? React.createElement('div', { className: 'command-palette-empty' }, 'No commands found')
              : Object.entries(groupedCommands).map(([category, commands]) =>
                  React.createElement(React.Fragment, { key: category },
                    React.createElement('div', { className: 'command-palette-section' }, category),
                    commands.map(cmd => {
                      const idx = flatIndex++;
                      return React.createElement('div', {
                        key: cmd.id,
                        className: 'command-palette-item' + (idx === selectedIndex ? ' selected' : ''),
                        onClick: () => { onCommand(cmd); onClose(); },
                        onMouseEnter: () => setSelectedIndex(idx)
                      },
                        React.createElement('div', {
                          className: 'command-palette-item-icon',
                          style: { background: cmd.color + '15', color: cmd.color }
                        },
                          React.createElement('iconify-icon', { icon: cmd.icon, width: 18 })
                        ),
                        React.createElement('div', { className: 'command-palette-item-info' },
                          React.createElement('div', { className: 'command-palette-item-name' }, cmd.name),
                          React.createElement('div', { className: 'command-palette-item-desc' }, cmd.desc)
                        ),
                        cmd.shortcut && React.createElement('span', { className: 'command-palette-item-shortcut' }, cmd.shortcut)
                      );
                    })
                  )
                )
          ),
          // Footer
          React.createElement('div', { className: 'command-palette-footer' },
            React.createElement('div', { className: 'command-palette-footer-hints' },
              React.createElement('span', { className: 'command-palette-footer-hint' },
                React.createElement('kbd', null, '\u2191\u2193'),
                ' Navigate'
              ),
              React.createElement('span', { className: 'command-palette-footer-hint' },
                React.createElement('kbd', null, '\u21B5'),
                ' Select'
              ),
              React.createElement('span', { className: 'command-palette-footer-hint' },
                React.createElement('kbd', null, 'ESC'),
                ' Close'
              )
            )
          )
        )
      );
    }

    function App() {
      const [messages, setMessages] = useState([]);
      const [input, setInput] = useState('');
      const [autocompleteItems, setAutocompleteItems] = useState([]);
      const [showAutocomplete, setShowAutocomplete] = useState(false);
      const [selectedAutocomplete, setSelectedAutocomplete] = useState(0);
      const [loading, setLoading] = useState(false);
      const [ir, setIr] = useState(null);
      const [cost, setCost] = useState(null);
      const [models, setModels] = useState([]);
      const [selectedModel, setSelectedModel] = useState('');
      const [showModal, setShowModal] = useState(false);
      const [yaml, setYaml] = useState('');
      const [streamingContent, setStreamingContent] = useState('');
      const [previewComponents, setPreviewComponents] = useState([]);
      const [suggestions, setSuggestions] = useState([]);
      const [componentSpecs, setComponentSpecs] = useState({});
      const [selectedNode, setSelectedNode] = useState(null);
      const chatRef = useRef(null);

      // Builder mode state
      const [showTemplates, setShowTemplates] = useState(true);
      const [templates, setTemplates] = useState([]);
      const [manualArch, setManualArch] = useState(null);
      const [connectingFrom, setConnectingFrom] = useState(null);
      const [builderMode, setBuilderMode] = useState(false);

      // Dev mode (Claude Code) state
      const [canvasChatMode, setCanvasChatMode] = useState('design');
      const [devMessages, setDevMessages] = useState([
        { role: 'assistant', content: 'Claude Code connected. Send instructions to read, edit, and manage files in this project.\\n\\nExamples:\\n\\u2022 "Describe the architecture of this project"\\n\\u2022 "Add input validation to the API routes"\\n\\u2022 "Refactor the database queries to use prepared statements"' }
      ]);
      const [isDevProcessing, setIsDevProcessing] = useState(false);

      // Command palette state
      const [showCommandPalette, setShowCommandPalette] = useState(false);

      // Detail panel tab state
      const [detailTab, setDetailTab] = useState('config'); // 'config' | 'code' | 'logs' | 'cost'

      // Undo/Redo history
      const [undoStack, setUndoStack] = useState([]);
      const [redoStack, setRedoStack] = useState([]);
      const maxHistorySize = 50;

      // Helper to push current state to undo stack
      const pushToHistory = useCallback((arch) => {
        if (!arch) return;
        setUndoStack(prev => {
          const newStack = [...prev, JSON.parse(JSON.stringify(arch))];
          return newStack.slice(-maxHistorySize);
        });
        setRedoStack([]); // Clear redo stack on new action
      }, []);

      // Undo function
      const undo = useCallback(async () => {
        if (undoStack.length === 0) return;
        const previousState = undoStack[undoStack.length - 1];
        const newUndoStack = undoStack.slice(0, -1);

        // Save current state to redo stack
        if (manualArch) {
          setRedoStack(prev => [...prev, JSON.parse(JSON.stringify(manualArch))]);
        }

        setUndoStack(newUndoStack);

        // Apply previous state via API
        const res = await fetch('/api/architecture', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ architecture: previousState })
        });
        const data = await res.json();
        if (data.architecture) {
          setManualArch(data.architecture);
          setIr(data.ir);
        }
      }, [undoStack, manualArch]);

      // Redo function
      const redo = useCallback(async () => {
        if (redoStack.length === 0) return;
        const nextState = redoStack[redoStack.length - 1];
        const newRedoStack = redoStack.slice(0, -1);

        // Save current state to undo stack
        if (manualArch) {
          setUndoStack(prev => [...prev, JSON.parse(JSON.stringify(manualArch))]);
        }

        setRedoStack(newRedoStack);

        // Apply next state via API
        const res = await fetch('/api/architecture', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ architecture: nextState })
        });
        const data = await res.json();
        if (data.architecture) {
          setManualArch(data.architecture);
          setIr(data.ir);
        }
      }, [redoStack, manualArch]);

      // Keyboard shortcuts for undo/redo and command palette
      useEffect(() => {
        const handleKeyDown = (e) => {
          // Command palette: CMD+K
          if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            setShowCommandPalette(prev => !prev);
            return;
          }
          // Undo/Redo
          if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
            e.preventDefault();
            if (e.shiftKey) {
              redo();
            } else {
              undo();
            }
          }
          if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
            e.preventDefault();
            redo();
          }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
      }, [undo, redo]);

      // Auth state
      const [user, setUser] = useState(null);
      const [authLoading, setAuthLoading] = useState(true);
      const [authError, setAuthError] = useState('');
      const [authMode, setAuthMode] = useState('login'); // 'login' | 'signup'

      // Project list & settings state
      const [appView, setAppView] = useState('dashboard'); // 'auth' | 'dashboard' | 'projects' | 'editor' | 'settings'
      const [projects, setProjects] = useState([]);
      const [currentProjectId, setCurrentProjectId] = useState(null);
      const [searchQuery, setSearchQuery] = useState('');
      const [projectArchitectures, setProjectArchitectures] = useState({});

      // Project name editing
      const [editingName, setEditingName] = useState(false);
      const [projectName, setProjectName] = useState('Untitled');

      // Deployment state
      const [deploying, setDeploying] = useState(false);
      const [deploymentStatus, setDeploymentStatus] = useState(null);
      const [deploymentLogs, setDeploymentLogs] = useState([]);
      const [deploymentUrl, setDeploymentUrl] = useState(null);
      const [showDeployModal, setShowDeployModal] = useState(false);
      const [selectedEnv, setSelectedEnv] = useState('development');

      // Local preview state
      const [previewSessions, setPreviewSessions] = useState({});   // { projectId: { status, services, error } }
      const [previewLoading, setPreviewLoading] = useState({});      // { projectId: boolean }

      // Panel collapse state - unified collapse bar
      // activePanel removed — per-panel collapse replaces unified collapse
      // Per-panel collapse (panelsCollapsed removed — each panel collapses independently)
      // Legacy collapse states (kept for backward compatibility)
      const [chatCollapsed, setChatCollapsed] = useState(false);
      const [costCollapsed, setCostCollapsed] = useState(false);
      const [paletteCollapsed, setPaletteCollapsed] = useState(false);

      // Template configuration flow state (full-page, not modal)
      const [configStep, setConfigStep] = useState('templates'); // 'templates' | 'configure' | 'build'
      const [previewTemplate, setPreviewTemplate] = useState(null);
      const [templateTechStacks, setTemplateTechStacks] = useState({});

      // Focus mode - hide all UI except canvas
      const [uiHidden, setUiHidden] = useState(false);

      // Component documentation (markdown per component)
      const [componentDocs, setComponentDocs] = useState({});

      // Documentation state
      const [projectDocs, setProjectDocs] = useState('# Project Overview\\n\\nDescribe your project here...\\n\\n## Requirements\\n\\n- \\n\\n## Technical Decisions\\n\\n- \\n\\n## API Contracts\\n\\n');
      const [docsPreviewMode, setDocsPreviewMode] = useState(false);

      // Check auth on mount
      useEffect(() => {
        const token = localStorage.getItem('brick_token');
        if (token) {
          fetch(API_URL + '/auth/me', { headers: getAuthHeaders() })
            .then(r => r.ok ? r.json() : Promise.reject())
            .then(data => {
              setUser(data.user);
              setAppView('dashboard');
            })
            .catch(() => {
              localStorage.removeItem('brick_token');
              setAppView('auth');
            })
            .finally(() => setAuthLoading(false));
        } else {
          setAuthLoading(false);
          setAppView('auth');
        }
      }, []);

      // Load templates on mount
      useEffect(() => {
        fetch('/api/templates').then(r => r.json()).then(data => {
          setTemplates(data.templates || []);
        }).catch(() => {});
      }, []);

      // Fetch AI suggestions when architecture changes
      const fetchSuggestions = useCallback(() => {
        fetch('/api/suggestions').then(r => r.json()).then(data => {
          setSuggestions(data.suggestions || []);
        }).catch(() => setSuggestions([]));
      }, []);

      useEffect(() => {
        if (manualArch && manualArch.components && manualArch.components.length > 0) {
          fetchSuggestions();
        } else {
          setSuggestions([]);
        }
      }, [manualArch, fetchSuggestions]);

      // Load projects from backend when user is logged in
      useEffect(() => {
        if (user) {
          fetch(API_URL + '/projects', { headers: getAuthHeaders() })
            .then(r => r.json())
            .then(data => setProjects(data.projects || []))
            .catch(() => {});
        }
      }, [user]);

      // Fetch architecture data for dashboard mini diagrams
      useEffect(() => {
        if (appView === 'dashboard' && projects.length > 0) {
          projects.forEach(p => {
            if (!projectArchitectures[p.id]) {
              fetch(API_URL + '/projects/' + p.id, { headers: getAuthHeaders() })
                .then(r => r.json())
                .then(data => {
                  if (data.project?.architecture) {
                    setProjectArchitectures(prev => ({ ...prev, [p.id]: data.project.architecture }));
                  }
                })
                .catch(() => {});
            }
          });
        }
      }, [appView, projects]);

      // Check preview status for all projects on dashboard load
      useEffect(() => {
        if (appView === 'dashboard' && projects.length > 0 && user) {
          projects.forEach(p => {
            fetch(API_URL + '/preview/' + p.id + '/status', { headers: getAuthHeaders() })
              .then(r => r.json())
              .then(data => {
                if (data.status && data.status !== 'not_started' && data.status !== 'stopped') {
                  setPreviewSessions(prev => ({ ...prev, [p.id]: { status: data.status, services: data.services || [], error: data.error || null } }));
                }
              })
              .catch(() => {});
          });
        }
      }, [appView, projects, user]);

      // Auth functions
      const handleLogin = async (email, password) => {
        setAuthError('');
        try {
          const res = await fetch(API_URL + '/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);
          localStorage.setItem('brick_token', data.token);
          setUser(data.user);
          setAppView('dashboard');
        } catch (e) {
          setAuthError(e.message || 'Login failed');
        }
      };

      const handleSignup = async (email, password, name) => {
        setAuthError('');
        try {
          const res = await fetch(API_URL + '/auth/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, name })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);
          localStorage.setItem('brick_token', data.token);
          setUser(data.user);
          setAppView('dashboard');
        } catch (e) {
          setAuthError(e.message || 'Signup failed');
        }
      };

      const handleLogout = () => {
        localStorage.removeItem('brick_token');
        setUser(null);
        setAppView('auth');
        setProjects([]);
      };

      // Deployment functions
      const deployProject = async (environment) => {
        if (!currentProjectId || deploying) return;
        setDeploying(true);
        setDeploymentStatus('starting');
        setDeploymentLogs(['Starting deployment...']);
        setDeploymentUrl(null);

        try {
          const res = await fetch(API_URL + '/deployments/' + currentProjectId + '/' + environment, {
            method: 'POST',
            headers: getAuthHeaders()
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);

          // Poll for status
          const deploymentId = data.deployment.id;
          pollDeploymentStatus(deploymentId);
        } catch (e) {
          setDeploymentStatus('failed');
          setDeploymentLogs(logs => [...logs, 'Error: ' + e.message]);
          setDeploying(false);
        }
      };

      const pollDeploymentStatus = async (deploymentId) => {
        try {
          const res = await fetch(API_URL + '/deployments/' + deploymentId, {
            headers: getAuthHeaders()
          });
          const data = await res.json();

          setDeploymentStatus(data.deployment.status);
          setDeploymentLogs(data.deployment.logs || []);

          // Capture the URL if available
          if (data.deployment.url) {
            setDeploymentUrl(data.deployment.url);
          }

          if (['live', 'failed', 'cancelled'].includes(data.deployment.status)) {
            setDeploying(false);
            if (data.deployment.status === 'live') {
              // Refresh projects to get updated URL
              const projRes = await fetch(API_URL + '/projects', { headers: getAuthHeaders() });
              const projData = await projRes.json();
              setProjects(projData.projects || []);
            }
          } else {
            setTimeout(() => pollDeploymentStatus(deploymentId), 2000);
          }
        } catch (e) {
          setDeploying(false);
        }
      };

      useEffect(() => {
        fetch('/api/config').then(r => r.json()).then(c => {
          setModels(c.models || []);
          setSelectedModel(c.model || '');
        }).catch(() => {});
      }, []);

      useEffect(() => {
        if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
      }, [messages, streamingContent]);

      // Real-time cost estimation when components change
      useEffect(() => {
        const components = manualArch?.components || ir?.components || [];
        if (components.length === 0) {
          setCost(null);
          return;
        }

        // Debounce cost calculation
        const timer = setTimeout(async () => {
          try {
            const res = await fetch('/api/cost', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                components: components.map(c => ({
                  id: c.id,
                  name: c.name,
                  type: c.type
                }))
              })
            });
            const data = await res.json();
            if (data.cost) {
              setCost(data.cost);
            }
          } catch (e) {
            // Ignore errors
          }
        }, 300);

        return () => clearTimeout(timer);
      }, [manualArch, ir]);

      const changeModel = async (model) => {
        setSelectedModel(model);
        await fetch('/api/model', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model })
        });
      };

      const sendMessage = async (text) => {
        const msg = text || input;
        if (!msg.trim() || loading) return;
        setInput('');
        setMessages(m => [...m, { role: 'user', content: msg }]);
        setLoading(true);
        setStreamingContent('');

        try {
          const res = await fetch('/api/generate-stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: msg })
          });

          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let fullContent = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const text = decoder.decode(value);
            const lines = text.split('\\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));
                  if (data.error) {
                    setMessages(m => [...m, { role: 'assistant', content: 'Error: ' + data.error }]);
                    setStreamingContent('');
                    break;
                  }
                  if (data.chunk) {
                    fullContent += data.chunk;
                    setStreamingContent(fullContent);
                    // Update live preview components
                    const preview = extractPreviewComponents(fullContent);
                    if (preview.length > 0) setPreviewComponents(preview);
                  }
                  if (data.done) {
                    setStreamingContent('');
                    setPreviewComponents([]); // Clear live preview
                    setMessages(m => [...m, { role: 'assistant', content: data.explanation || fullContent }]);
                    if (data.ir) {
                      setIr(data.ir);
                      setAppView('editor');
                    }
                    if (data.cost) setCost(data.cost);
                  }
                } catch (e) {}
              }
            }
          }
        } catch (err) {
          setMessages(m => [...m, { role: 'assistant', content: 'Error: ' + err.message }]);
          setStreamingContent('');
        }
        setLoading(false);
      };

      // === Dev Mode (Claude Code) Functions ===

      const sendDevMessage = async (text) => {
        const instruction = text || input;
        if (!instruction.trim() || isDevProcessing) return;
        setInput('');
        setDevMessages(m => [...m, { role: 'user', content: instruction }]);
        setIsDevProcessing(true);

        try {
          const res = await fetch('/api/agent/claude-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ instruction })
          });

          if (!res.ok) throw new Error('Request failed');

          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          let streamingText = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              let event;
              try { event = JSON.parse(line.slice(6)); } catch { continue; }

              switch (event.type) {
                case 'text':
                  streamingText += (event.content || '');
                  setDevMessages(prev => {
                    const updated = [...prev];
                    const last = updated[updated.length - 1];
                    if (last && last.role === 'assistant' && last._streaming) {
                      updated[updated.length - 1] = { ...last, content: streamingText };
                    } else {
                      updated.push({ role: 'assistant', content: streamingText, _streaming: true });
                    }
                    return updated;
                  });
                  break;
                case 'tool_use':
                  setDevMessages(prev => [...prev, {
                    role: 'system',
                    content: (event.fileAction === 'edit' ? 'Editing ' : event.fileAction === 'create' ? 'Creating ' : 'Running ') + (event.filePath || event.tool || 'tool')
                  }]);
                  break;
                case 'done':
                  if (event.summary) {
                    const s = event.summary;
                    setDevMessages(prev => [...prev, {
                      role: 'system',
                      content: s.filesChanged.length + ' file(s) changed | ' + (s.duration / 1000).toFixed(1) + 's'
                    }]);
                  } else if (event.content) {
                    setDevMessages(prev => [...prev, { role: 'assistant', content: event.content }]);
                  }
                  setDevMessages(prev => prev.map(m => m._streaming ? { role: m.role, content: m.content } : m));
                  streamingText = '';
                  break;
                case 'error':
                  setDevMessages(prev => [...prev, { role: 'system', content: 'Error: ' + (event.content || 'Unknown error') }]);
                  break;
              }
            }
          }
        } catch (err) {
          setDevMessages(prev => [...prev, { role: 'system', content: 'Error: ' + err.message }]);
        } finally {
          setIsDevProcessing(false);
        }
      };

      const cancelDev = async () => {
        try {
          await fetch('/api/agent/claude-code/cancel', { method: 'POST' });
          setDevMessages(prev => [...prev, { role: 'system', content: 'Cancelled.' }]);
        } catch {}
        setIsDevProcessing(false);
      };

      // === Builder Mode Functions ===

      const loadTemplate = async (templateId) => {
        const res = await fetch('/api/template', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ templateId })
        });
        const data = await res.json();
        if (data.architecture) {
          setManualArch(data.architecture);
          setIr(data.ir);
          setShowTemplates(false);
          setBuilderMode(true);
          setAppView('editor');
        }
      };

      const addComponent = async (type, x, y) => {
        pushToHistory(manualArch); // Save state before change
        const res = await fetch('/api/component', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, x, y })
        });
        const data = await res.json();
        if (data.architecture) {
          setManualArch(data.architecture);
          setIr(data.ir);
        }
      };

      const updateComponent = async (id, updates) => {
        // Only push to history for significant changes (not drag intermediate states)
        if (updates.name || updates.type) {
          pushToHistory(manualArch);
        }
        const res = await fetch('/api/component', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, ...updates })
        });
        const data = await res.json();
        if (data.architecture) {
          setManualArch(data.architecture);
          setIr(data.ir);
        }
      };

      const updateProjectName = async (name) => {
        const res = await fetch('/api/architecture/name', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name })
        });
        if (res.ok) {
          setManualArch(prev => prev ? { ...prev, name } : null);
          setIr(prev => prev ? { ...prev, name } : null);
        }
      };

      const deleteComponent = async (id) => {
        pushToHistory(manualArch); // Save state before change
        const res = await fetch('/api/component?id=' + id, { method: 'DELETE' });
        const data = await res.json();
        if (data.architecture) {
          setManualArch(data.architecture);
          setIr(data.ir);
        }
      };

      const addConnection = async (from, to) => {
        pushToHistory(manualArch); // Save state before change
        const res = await fetch('/api/connection', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ from, to })
        });
        const data = await res.json();
        if (data.architecture) {
          setManualArch(data.architecture);
          setIr(data.ir);
        }
      };

      const deleteConnection = async (from, to) => {
        pushToHistory(manualArch); // Save state before change
        const res = await fetch('/api/connection?from=' + from + '&to=' + to, { method: 'DELETE' });
        const data = await res.json();
        if (data.architecture) {
          setManualArch(data.architecture);
          setIr(data.ir);
        }
      };

      // Auto-layout handler using dagre
      const handleAutoLayout = async (direction = 'TB') => {
        if (!manualArch || !manualArch.components.length) return;

        // Calculate new positions using dagre
        const newPositions = autoLayoutNodes(manualArch.components, manualArch.connections, direction);

        // Update each component with the new position
        for (const comp of manualArch.components) {
          const pos = newPositions[comp.id];
          if (pos) {
            await updateComponent(comp.id, { x: pos.x, y: pos.y });
          }
        }
      };

      const handleNodeClick = (node) => {
        if (connectingFrom) {
          if (connectingFrom !== node.id) {
            addConnection(connectingFrom, node.id);
          }
          setConnectingFrom(null);
        } else {
          openNodeDetail(node);
        }
      };

      const startConnecting = (nodeId) => {
        setConnectingFrom(nodeId);
      };

      const cancelConnecting = () => {
        setConnectingFrom(null);
      };

      const exportYaml = async () => {
        const res = await fetch('/api/build', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ componentSpecs })
        });
        const data = await res.json();
        if (data.yaml) { setYaml(data.yaml); setShowModal(true); }
      };

      const reset = async () => {
        if (!confirm('Start new project?')) return;
        await fetch('/api/reset', { method: 'POST' });
        setMessages([]); setIr(null); setCost(null); setComponentSpecs({}); setSelectedNode(null);
        setViewMode('architecture'); setFiles([]); setSelectedFile(null); setFileContent('');
        setShowTemplates(true); setManualArch(null); setConnectingFrom(null); setBuilderMode(false);
        setCurrentProjectId(null);
      };

      // Save current project to backend
      const saveProject = async (name) => {
        if (!user) return null;

        // Build architecture from manual or IR
        const architecture = manualArch ? {
          components: manualArch.components.map(c => ({
            id: c.id,
            name: c.name,
            type: c.type,
            spec: componentSpecs[c.id] || {}
          })),
          connections: manualArch.connections
        } : ir ? {
          components: ir.components.map(c => ({
            id: c.id,
            name: c.name,
            type: c.type,
            spec: componentSpecs[c.id] || {}
          })),
          connections: []
        } : { components: [], connections: [] };

        try {
          const endpoint = currentProjectId
            ? API_URL + '/projects/' + currentProjectId
            : API_URL + '/projects';
          const method = currentProjectId ? 'PATCH' : 'POST';

          const res = await fetch(endpoint, {
            method,
            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: name || manualArch?.name || ir?.name || 'Untitled Project',
              documentation: projectDocs,
              architecture
            })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);

          if (data.project) {
            setCurrentProjectId(data.project.id);
            // Refresh project list
            const listRes = await fetch(API_URL + '/projects', { headers: getAuthHeaders() });
            const listData = await listRes.json();
            setProjects(listData.projects || []);
          }
          return data.project;
        } catch (e) {
          console.error('Save project error:', e);
          return null;
        }
      };

      // Load a project by ID from backend
      const loadProject = async (projectId) => {
        if (!user) return;

        try {
          const res = await fetch(API_URL + '/projects/' + projectId, {
            headers: getAuthHeaders()
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);

          if (data.project) {
            setCurrentProjectId(data.project.id);
            // Convert architecture to manual arch format
            const arch = data.project.architecture;
            if (arch && arch.components && arch.components.length > 0) {
              // Assign positions if not present
              const comps = arch.components.map((c, i) => ({
                id: c.id,
                name: c.name,
                type: c.type,
                x: c.x || 200 + (i % 3) * 200,
                y: c.y || 100 + Math.floor(i / 3) * 150
              }));
              setManualArch({
                name: data.project.name,
                components: comps,
                connections: arch.connections || []
              });
              // Extract specs from components
              const specs = {};
              arch.components.forEach(c => {
                if (c.spec) specs[c.id] = c.spec;
              });
              setComponentSpecs(specs);
            } else {
              setManualArch(null);
              setComponentSpecs({});
            }
            setIr(null);
            setProjectDocs(data.project.documentation || '# Project Overview\\n\\nDescribe your project here...\\n');
            setShowTemplates(!arch || !arch.components || arch.components.length === 0);
            setBuilderMode(arch && arch.components && arch.components.length > 0);
            setAppView('editor');
            setMessages([]);
            setCost(null);

            // Check if preview is running for this project
            fetch(API_URL + '/preview/' + data.project.id + '/status', { headers: getAuthHeaders() })
              .then(r => r.json())
              .then(statusData => {
                if (statusData.status && statusData.status !== 'not_started' && statusData.status !== 'stopped') {
                  setPreviewSessions(prev => ({ ...prev, [data.project.id]: { status: statusData.status, services: statusData.services || [], error: statusData.error || null } }));
                }
              })
              .catch(() => {});
          }
        } catch (e) {
          console.error('Load project error:', e);
        }
      };

      // Delete a project from backend
      const deleteProject = async (projectId, e) => {
        if (e) e.stopPropagation();
        if (!confirm('Delete this project? This will also stop any active deployments.')) return;

        try {
          const res = await fetch(API_URL + '/projects/' + projectId, {
            method: 'DELETE',
            headers: getAuthHeaders()
          });
          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error);
          }
          setProjects(projects.filter(p => p.id !== projectId));
          if (currentProjectId === projectId) {
            setCurrentProjectId(null);
          }
        } catch (e) {
          console.error('Delete project error:', e);
          alert('Failed to delete project: ' + e.message);
        }
      };

      // Create new project
      const createNewProject = () => {
        setCurrentProjectId(null);
        setMessages([]); setIr(null); setCost(null); setComponentSpecs({}); setSelectedNode(null);
        setViewMode('architecture'); setFiles([]); setSelectedFile(null); setFileContent('');
        setShowTemplates(true); setManualArch(null); setConnectingFrom(null); setBuilderMode(false);
        setAppView('editor');
      };

      // Mini architecture diagram for dashboard cards (pure SVG, no React Flow)
      const MiniArchDiagram = ({ architecture }) => {
        if (!architecture || !architecture.components || architecture.components.length === 0) {
          return React.createElement('div', { className: 'dashboard-card-diagram-empty' },
            React.createElement('iconify-icon', { icon: 'solar:layers-minimalistic-linear', width: 24 }),
            'No components'
          );
        }

        const comps = architecture.components;
        const conns = architecture.connections || [];
        const padding = 16;
        const nodeR = 8;
        const svgW = 320;
        const svgH = 120;

        // Use dagre for layout at small scale
        const g = new dagre.graphlib.Graph();
        g.setGraph({ rankdir: 'TB', nodesep: 40, ranksep: 35, marginx: padding, marginy: padding });
        g.setDefaultEdgeLabel(() => ({}));
        comps.forEach(c => g.setNode(c.id, { width: 20, height: 20 }));
        conns.forEach(conn => g.setEdge(conn.from, conn.to));
        dagre.layout(g);

        // Scale to fit
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        g.nodes().forEach(id => {
          const n = g.node(id);
          if (n) { minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x); minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y); }
        });
        const graphW = Math.max(maxX - minX, 1);
        const graphH = Math.max(maxY - minY, 1);
        const scale = Math.min((svgW - padding * 2) / graphW, (svgH - padding * 2) / graphH, 3);
        const offsetX = (svgW - graphW * scale) / 2 - minX * scale;
        const offsetY = (svgH - graphH * scale) / 2 - minY * scale;

        const nodePositions = {};
        g.nodes().forEach(id => {
          const n = g.node(id);
          if (n) nodePositions[id] = { x: n.x * scale + offsetX, y: n.y * scale + offsetY };
        });

        // Build SVG elements
        const elements = [];
        // Edges
        conns.forEach((conn, i) => {
          const from = nodePositions[conn.from];
          const to = nodePositions[conn.to];
          if (from && to) {
            elements.push(React.createElement('line', { key: 'e' + i, x1: from.x, y1: from.y, x2: to.x, y2: to.y, stroke: '#2A2A2A', strokeWidth: 1.5 }));
          }
        });
        // Nodes
        comps.forEach(c => {
          const pos = nodePositions[c.id];
          if (!pos) return;
          const color = COLORS[c.type] || '#6366F1';
          elements.push(React.createElement('circle', { key: 'n' + c.id, cx: pos.x, cy: pos.y, r: nodeR, fill: color, opacity: 0.85 }));
        });

        return React.createElement('svg', { viewBox: '0 0 ' + svgW + ' ' + svgH, preserveAspectRatio: 'xMidYMid meet' }, ...elements);
      };

      // Quick deploy from dashboard
      const dashboardDeploy = async (projectId, env, e) => {
        if (e) e.stopPropagation();
        try {
          const res = await fetch(API_URL + '/deployments/' + projectId + '/' + env, {
            method: 'POST',
            headers: getAuthHeaders()
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);
          // Refresh project list to pick up status changes
          const projRes = await fetch(API_URL + '/projects', { headers: getAuthHeaders() });
          const projData = await projRes.json();
          setProjects(projData.projects || []);
        } catch (err) {
          console.error('Dashboard deploy error:', err);
          alert('Deploy failed: ' + err.message);
        }
      };

      // Local preview functions
      const startLocalPreview = async (projectId, e) => {
        if (e) e.stopPropagation();
        setPreviewLoading(prev => ({ ...prev, [projectId]: true }));
        try {
          const res = await fetch(API_URL + '/preview/' + projectId + '/start', {
            method: 'POST',
            headers: getAuthHeaders()
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to start preview');
          setPreviewSessions(prev => ({ ...prev, [projectId]: { status: data.status, services: data.services || [], error: null } }));
        } catch (err) {
          setPreviewSessions(prev => ({ ...prev, [projectId]: { status: 'error', services: [], error: err.message } }));
        } finally {
          setPreviewLoading(prev => ({ ...prev, [projectId]: false }));
        }
      };

      const stopLocalPreview = async (projectId, e) => {
        if (e) e.stopPropagation();
        try {
          await fetch(API_URL + '/preview/' + projectId + '/stop', {
            method: 'POST',
            headers: getAuthHeaders()
          });
          setPreviewSessions(prev => { const next = { ...prev }; delete next[projectId]; return next; });
        } catch (err) {
          console.error('Stop preview error:', err);
        }
      };

      const refreshPreviewStatus = async (projectId) => {
        try {
          const res = await fetch(API_URL + '/preview/' + projectId + '/status', { headers: getAuthHeaders() });
          const data = await res.json();
          if (data.status && data.status !== 'not_started') {
            setPreviewSessions(prev => ({ ...prev, [projectId]: { status: data.status, services: data.services || [], error: data.error || null } }));
          }
        } catch (err) {
          // Silently ignore poll errors
        }
      };

      // Poll preview status for running/starting sessions
      useEffect(() => {
        const activeIds = Object.entries(previewSessions).filter(([, s]) => s.status === 'starting' || s.status === 'running').map(([id]) => id);
        if (activeIds.length === 0) return;
        const timer = setInterval(() => { activeIds.forEach(id => refreshPreviewStatus(id)); }, 5000);
        return () => clearInterval(timer);
      }, [previewSessions]);

      // Navigate to dashboard
      const goToDashboard = async () => {
        if ((ir || manualArch) && user) {
          await saveProject();
        }
        if (user) {
          try {
            const res = await fetch(API_URL + '/projects', { headers: getAuthHeaders() });
            const data = await res.json();
            setProjects(data.projects || []);
          } catch (e) {
            console.error('Failed to load projects:', e);
          }
        }
        setAppView('dashboard');
      };

      // Go back to project list
      const goToProjects = async () => {
        // Save current project if there's an architecture
        if ((ir || manualArch) && user) {
          await saveProject();
        }
        // Refresh project list from backend
        if (user) {
          try {
            const res = await fetch(API_URL + '/projects', { headers: getAuthHeaders() });
            const data = await res.json();
            setProjects(data.projects || []);
          } catch (e) {
            console.error('Failed to load projects:', e);
          }
        }
        setAppView('projects');
      };

      // Command palette handler
      const handleCommandPaletteCommand = useCallback((cmd) => {
        switch (cmd.action) {
          case 'addComponent':
            addComponent(cmd.type, 400, 300);
            break;
          case 'deploy':
            setShowDeployModal(true);
            break;
          case 'export':
            exportYaml();
            break;
          case 'save':
            saveProject();
            break;
          case 'autoLayout':
            handleAutoLayout();
            break;
          case 'setView':
            setViewMode(cmd.view);
            break;
          case 'goToDashboard':
            goToDashboard();
            break;
          default:
            console.log('Unknown command:', cmd);
        }
      }, [addComponent, exportYaml, saveProject, handleAutoLayout, goToDashboard]);

      // Filter projects by search
      const filteredProjects = projects.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
      );

      // Format date for display
      const formatDate = (date) => {
        const d = new Date(date);
        const now = new Date();
        const diff = now.getTime() - d.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        if (days === 0) return 'Today';
        if (days === 1) return 'Yesterday';
        if (days < 7) return days + ' days ago';
        return d.toLocaleDateString();
      };

      const openNodeDetail = (node) => {
        setSelectedNode(node);
      };

      const closeNodeDetail = () => {
        setSelectedNode(null);
      };

      const updateSpec = (field, value) => {
        if (!selectedNode) return;
        setComponentSpecs(specs => ({
          ...specs,
          [selectedNode.id]: {
            ...(specs[selectedNode.id] || {}),
            [field]: value
          }
        }));
      };

      const getSpec = (field) => {
        if (!selectedNode) return '';
        return (componentSpecs[selectedNode.id] || {})[field] || '';
      };

      const download = () => {
        const blob = new Blob([yaml], { type: 'text/yaml' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'appspec.yaml';
        a.click();
      };

      const downloadDesign = () => {
        const design = {
          name: ir?.name || 'architecture',
          components: (ir?.components || []).map(c => ({
            id: c.id,
            name: c.name,
            type: c.type,
            connections: c.connections || [],
            spec: componentSpecs[c.id] || {}
          }))
        };
        const blob = new Blob([JSON.stringify(design, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'design-spec.json';
        a.click();
      };

      const hasAnySpecs = Object.values(componentSpecs).some(spec =>
        spec && (spec.description || spec.inputs || spec.outputs || spec.notes)
      );

      // Code view state
      const [viewMode, setViewMode] = useState('architecture'); // 'architecture' | 'code'
      const [files, setFiles] = useState([]);
      const [selectedFile, setSelectedFile] = useState(null);
      const [fileContent, setFileContent] = useState('');
      const [isGeneratingCode, setIsGeneratingCode] = useState(false);
      const [codeGenProgress, setCodeGenProgress] = useState({ current: 0, total: 0, file: '' });
      const [sourceFiles, setSourceFiles] = useState([]);
      const [fileSource, setFileSource] = useState('generated'); // 'generated' | 'source'
      const editorRef = useRef(null);

      // Load source files from filesystem
      useEffect(() => {
        fetch('/api/source-files')
          .then(r => r.json())
          .then(data => {
            if (data.files && data.files.length > 0) {
              setSourceFiles(data.files);
              // If no generated files, auto-switch to source view
              if (files.length === 0) {
                setFileSource('source');
              }
            }
          })
          .catch(() => {});
      }, []);

      // Generate code from architecture
      const generateCode = async () => {
        if (!ir || isGeneratingCode) return;
        setIsGeneratingCode(true);
        setCodeGenProgress({ current: 0, total: 0, file: 'Planning...' });
        setFiles([]);
        setSelectedFile(null);
        setViewMode('code');

        try {
          const res = await fetch('/api/generate-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ componentSpecs })
          });

          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          const newFiles = [];

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const text = decoder.decode(value);
            const lines = text.split('\\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));

                  if (data.error) {
                    alert('Error: ' + data.error);
                    break;
                  }

                  if (data.status === 'planning') {
                    setCodeGenProgress({ current: 0, total: 0, file: 'Planning file structure...' });
                  }

                  if (data.status === 'planned') {
                    setCodeGenProgress({ current: 0, total: data.files.length, file: '' });
                  }

                  if (data.status === 'generating') {
                    setCodeGenProgress({ current: data.progress, total: data.total, file: data.file });
                  }

                  if (data.status === 'file_complete') {
                    newFiles.push({
                      path: data.file,
                      content: data.content,
                      componentId: data.componentId,
                    });
                    setFiles([...newFiles]);

                    // Select first file automatically
                    if (newFiles.length === 1) {
                      setSelectedFile(data.file);
                      setFileContent(data.content);
                    }
                  }

                  if (data.status === 'complete') {
                    setCodeGenProgress({ current: data.fileCount, total: data.fileCount, file: 'Complete!' });
                  }
                } catch (e) {}
              }
            }
          }
        } catch (err) {
          alert('Error generating code: ' + err.message);
        } finally {
          setIsGeneratingCode(false);
        }
      };

      // Load file content
      // Active files based on source toggle
      const activeFiles = fileSource === 'source' ? sourceFiles : files;

      const loadFile = async (path) => {
        setSelectedFile(path);
        const file = activeFiles.find(f => f.path === path);
        if (file) {
          setFileContent(file.content);
        }
      };

      // Update file content (for editing)
      const updateFileContent = async (content) => {
        setFileContent(content);
        if (fileSource === 'generated') {
          setFiles(files.map(f => f.path === selectedFile ? { ...f, content } : f));
          await fetch('/api/file', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: selectedFile, content })
          });
        }
      };

      // Build file tree structure
      const buildFileTree = (fileList) => {
        const tree = {};
        fileList.forEach(f => {
          const parts = f.path.split('/');
          let current = tree;
          parts.forEach((part, i) => {
            if (i === parts.length - 1) {
              current[part] = { type: 'file', path: f.path, componentId: f.componentId };
            } else {
              if (!current[part]) current[part] = { type: 'dir', children: {} };
              current = current[part].children;
            }
          });
        });
        return tree;
      };

      const fileTree = buildFileTree(activeFiles);

      const modelGroups = {};
      models.forEach(m => {
        if (!modelGroups[m.provider]) modelGroups[m.provider] = [];
        modelGroups[m.provider].push(m);
      });

      // Dynamic grid columns based on per-panel collapsed state

      // Calculate widths based on individual collapse state
      const chatWidth = chatCollapsed ? '0px' : '360px';
      const costWidth = costCollapsed ? '0px' : '300px';
      const paletteWidth = paletteCollapsed ? '0px' : '200px';

      const anyCollapsed = chatCollapsed || costCollapsed || paletteCollapsed;
      const appClassName = 'app' +
        (viewMode === 'code' ? ' code-view' : '') +
        (builderMode && viewMode === 'architecture' ? ' builder-mode' : '') +
        (uiHidden ? ' focus-mode' : '');

      // Grid style per view mode
      const baseGrid = viewMode === 'code'
        ? chatWidth + ' 240px 1fr ' + costWidth
        : viewMode === 'docs'
          ? chatWidth + ' 1fr'
          : builderMode
            ? chatWidth + ' ' + paletteWidth + ' 1fr ' + costWidth
            : chatWidth + ' 1fr ' + costWidth;

      const gridStyle = { gridTemplateColumns: baseGrid };

      // === AUTH SCREEN ===
      if (authLoading) {
        return React.createElement('div', { className: 'auth-screen' },
          React.createElement('div', { style: { textAlign: 'center', color: 'white' } },
            React.createElement('iconify-icon', { icon: 'svg-spinners:ring-resize', width: 32 })
          )
        );
      }

      if (appView === 'auth') {
        return React.createElement('div', { className: 'auth-screen' },
          React.createElement('div', { className: 'auth-brand' },
            React.createElement('iconify-icon', { icon: 'solar:layers-minimalistic-bold-duotone', width: 20 }),
            React.createElement('span', null, 'Brick Studio')
          ),
          React.createElement('div', { className: 'auth-card' },
            React.createElement('div', { className: 'auth-logo' },
              React.createElement('div', { className: 'auth-logo-icon' },
                React.createElement('iconify-icon', { icon: 'solar:layers-minimalistic-linear', width: 24 })
              ),
              React.createElement('h1', null, authMode === 'login' ? 'Welcome back' : 'Create account'),
              React.createElement('p', null, authMode === 'login' ? 'Enter your credentials to access the workspace.' : 'Get started with your cloud infrastructure.')
            ),
            authError && React.createElement('div', { className: 'auth-error' }, authError),
            React.createElement('form', {
              className: 'auth-form',
              onSubmit: e => {
                e.preventDefault();
                const form = e.target;
                const email = form.email.value;
                const password = form.password.value;
                if (authMode === 'signup') {
                  const name = form.name.value;
                  handleSignup(email, password, name);
                } else {
                  handleLogin(email, password);
                }
              }
            },
              authMode === 'signup' && React.createElement('div', { className: 'auth-field' },
                React.createElement('label', { className: 'auth-label' }, 'Name'),
                React.createElement('input', {
                  className: 'auth-input',
                  name: 'name',
                  type: 'text',
                  placeholder: 'Your name',
                  required: true
                })
              ),
              React.createElement('div', { className: 'auth-field' },
                React.createElement('label', { className: 'auth-label' }, 'Email'),
                React.createElement('input', {
                  className: 'auth-input',
                  name: 'email',
                  type: 'email',
                  defaultValue: authMode === 'login' ? 'test@brick.studio' : '',
                  placeholder: 'name@company.com',
                  required: true
                })
              ),
              React.createElement('div', { className: 'auth-field' },
                React.createElement('label', { className: 'auth-label' }, 'Password'),
                React.createElement('input', {
                  className: 'auth-input',
                  name: 'password',
                  type: 'password',
                  defaultValue: authMode === 'login' ? 'password123' : '',
                  placeholder: '••••••••',
                  minLength: 8,
                  required: true
                })
              ),
              React.createElement('button', { className: 'auth-btn', type: 'submit' },
                React.createElement('span', null, authMode === 'login' ? 'Sign In' : 'Create Account'),
                React.createElement('iconify-icon', { icon: 'solar:arrow-right-linear', style: { opacity: 0.5 } })
              )
            ),
            React.createElement('div', { className: 'auth-footer' },
              authMode === 'login'
                ? React.createElement(React.Fragment, null,
                    React.createElement('a', { href: '#' }, 'Forgot password?'),
                    React.createElement('a', { className: 'accent', onClick: () => { setAuthMode('signup'); setAuthError(''); } }, 'Create account')
                  )
                : React.createElement(React.Fragment, null,
                    React.createElement('span', { style: { color: '#525252' } }, 'Have an account?'),
                    React.createElement('a', { className: 'accent', onClick: () => { setAuthMode('login'); setAuthError(''); } }, 'Sign in')
                  )
            ),
            // Guest mode divider and button
            React.createElement('div', { className: 'auth-divider' },
              React.createElement('span', null, 'or')
            ),
            React.createElement('button', {
              className: 'auth-guest-btn',
              type: 'button',
              onClick: () => {
                setUser({ id: 'guest', name: 'Guest User', email: 'guest@local' });
                setAppView('dashboard');
              }
            },
              React.createElement('iconify-icon', { icon: 'solar:user-circle-linear', width: 18 }),
              'Continue as Guest'
            )
          ),
          React.createElement('div', { className: 'auth-version' }, 'v2.4.0-beta')
        );
      }

      // === DASHBOARD VIEW ===
      if (appView === 'dashboard') {
        // Compute dashboard metrics
        const totalProjects = projects.length;
        const activeDeployments = projects.reduce((acc, p) => acc + (p.environments || []).filter(e => e.status === 'live').length, 0);
        const totalMonthlyCostCents = projects.reduce((acc, p) => acc + (p.environments || []).reduce((sum, e) => sum + (e.monthlyCostCents || 0), 0), 0);
        const failedCount = projects.reduce((acc, p) => acc + (p.environments || []).filter(e => e.status === 'failed').length, 0);

        // Cost breakdown by project
        const costByProject = projects.map(p => ({
          name: p.name,
          cost: (p.environments || []).reduce((sum, e) => sum + (e.monthlyCostCents || 0), 0)
        })).filter(c => c.cost > 0).sort((a, b) => b.cost - a.cost);
        const maxProjectCost = costByProject.length > 0 ? costByProject[0].cost : 1;

        return React.createElement('div', { className: 'dashboard-view' },
          // Sidebar (reuses project-sidebar styling)
          React.createElement('div', { className: 'project-sidebar' },
            React.createElement('div', { className: 'sidebar-header' },
              React.createElement('div', { className: 'sidebar-logo-icon' },
                React.createElement('iconify-icon', { icon: 'solar:layers-minimalistic-bold', width: 14 })
              ),
              React.createElement('span', { className: 'sidebar-logo' }, 'Brick Studio')
            ),
            React.createElement('div', { className: 'sidebar-nav' },
              React.createElement('div', { className: 'nav-section-title' }, 'Workspace'),
              React.createElement('div', { className: 'nav-item active' },
                React.createElement('iconify-icon', { icon: 'solar:widget-5-linear', className: 'nav-item-icon' }),
                'Dashboard'
              ),
              React.createElement('div', { className: 'nav-item', onClick: () => setAppView('projects') },
                React.createElement('iconify-icon', { icon: 'solar:folder-with-files-linear', className: 'nav-item-icon' }),
                'All Projects'
              ),
              React.createElement('div', { className: 'nav-item' },
                React.createElement('iconify-icon', { icon: 'solar:graph-new-linear', className: 'nav-item-icon' }),
                'Analytics'
              ),
              React.createElement('div', { className: 'nav-item' },
                React.createElement('iconify-icon', { icon: 'solar:users-group-rounded-linear', className: 'nav-item-icon' }),
                'Team'
              ),
              React.createElement('div', { className: 'nav-section-title' }, 'Settings'),
              React.createElement('div', { className: 'nav-item' },
                React.createElement('iconify-icon', { icon: 'solar:card-linear', className: 'nav-item-icon' }),
                'Billing'
              ),
              React.createElement('div', { className: 'nav-item', onClick: () => setAppView('settings') },
                React.createElement('iconify-icon', { icon: 'solar:settings-linear', className: 'nav-item-icon' }),
                'Preferences'
              )
            ),
            React.createElement('div', { className: 'sidebar-footer' },
              React.createElement('div', { className: 'sidebar-user' },
                React.createElement('div', { className: 'sidebar-user-avatar' }, user?.name?.charAt(0).toUpperCase() || 'U'),
                React.createElement('div', { className: 'sidebar-user-info' },
                  React.createElement('div', { className: 'sidebar-user-name' }, user?.name || 'User'),
                  React.createElement('div', { className: 'sidebar-user-plan' }, 'Pro Plan')
                ),
                React.createElement('button', { className: 'sidebar-logout', onClick: handleLogout },
                  React.createElement('iconify-icon', { icon: 'solar:logout-linear' })
                )
              )
            )
          ),

          // Main content
          React.createElement('main', { className: 'dashboard-main' },
            React.createElement('header', { className: 'project-header' },
              React.createElement('h1', null, 'Dashboard'),
              React.createElement('div', { className: 'project-header-spacer' }),
              React.createElement('button', {
                className: 'new-project-btn',
                onClick: createNewProject
              },
                React.createElement('iconify-icon', { icon: 'solar:add-circle-linear', width: 16 }),
                'New Project'
              )
            ),
            React.createElement('div', { className: 'dashboard-content' },
              // Stats row
              React.createElement('div', { className: 'dashboard-stats' },
                React.createElement('div', { className: 'dashboard-stat-card' },
                  React.createElement('div', { className: 'dashboard-stat-label' },
                    React.createElement('iconify-icon', { icon: 'solar:folder-with-files-linear', width: 14 }),
                    'Total Projects'
                  ),
                  React.createElement('div', { className: 'dashboard-stat-value' }, totalProjects),
                  React.createElement('div', { className: 'dashboard-stat-sub' }, totalProjects === 1 ? '1 project' : totalProjects + ' projects')
                ),
                React.createElement('div', { className: 'dashboard-stat-card' },
                  React.createElement('div', { className: 'dashboard-stat-label' },
                    React.createElement('iconify-icon', { icon: 'solar:server-linear', width: 14 }),
                    'Active Deployments'
                  ),
                  React.createElement('div', { className: 'dashboard-stat-value' }, activeDeployments),
                  React.createElement('div', { className: 'dashboard-stat-sub' }, 'across ' + projects.filter(p => (p.environments || []).some(e => e.status === 'live')).length + ' projects')
                ),
                React.createElement('div', { className: 'dashboard-stat-card' },
                  React.createElement('div', { className: 'dashboard-stat-label' },
                    React.createElement('iconify-icon', { icon: 'solar:dollar-minimalistic-linear', width: 14 }),
                    'Monthly Cost'
                  ),
                  React.createElement('div', { className: 'dashboard-stat-value' }, '$' + (totalMonthlyCostCents / 100).toFixed(0)),
                  React.createElement('div', { className: 'dashboard-stat-sub' }, 'estimated this month')
                ),
                React.createElement('div', { className: 'dashboard-stat-card' },
                  React.createElement('div', { className: 'dashboard-stat-label' },
                    React.createElement('iconify-icon', { icon: 'solar:heart-pulse-linear', width: 14 }),
                    'Health'
                  ),
                  React.createElement('div', { className: 'dashboard-stat-value' }, failedCount === 0 ? 'OK' : failedCount),
                  React.createElement('div', { className: 'dashboard-stat-sub' }, failedCount === 0 ? 'All systems healthy' : failedCount + ' failed deployment' + (failedCount !== 1 ? 's' : ''))
                )
              ),

              // Project cards
              React.createElement('div', { className: 'dashboard-section-title' },
                'Projects',
                React.createElement('span', { style: { fontSize: 12, color: '#525252' } }, totalProjects + ' total')
              ),
              projects.length === 0 ?
                React.createElement('div', { className: 'project-empty', style: { marginBottom: 32 } },
                  React.createElement('iconify-icon', { icon: 'solar:folder-open-linear', width: 48, style: { color: '#404040', marginBottom: 16 } }),
                  React.createElement('h3', null, 'No projects yet'),
                  React.createElement('p', null, 'Create your first architecture project to get started'),
                  React.createElement('button', {
                    className: 'new-project-btn',
                    style: { marginTop: 16 },
                    onClick: createNewProject
                  },
                    React.createElement('iconify-icon', { icon: 'solar:add-circle-linear', width: 16 }),
                    'Create Project'
                  )
                )
              :
                React.createElement('div', { className: 'dashboard-grid' },
                  [...projects].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(project => {
                    const envs = project.environments || [];
                    const bestStatus = envs.find(e => e.status === 'live') ? 'live' : envs.find(e => e.status === 'deploying') ? 'deploying' : envs.find(e => e.status === 'failed') ? 'failed' : 'offline';
                    const projectCostCents = envs.reduce((sum, e) => sum + (e.monthlyCostCents || 0), 0);
                    const arch = projectArchitectures[project.id];

                    return React.createElement('div', {
                      key: project.id,
                      className: 'dashboard-card',
                      onClick: () => loadProject(project.id)
                    },
                      // Header
                      React.createElement('div', { className: 'dashboard-card-header' },
                        React.createElement('div', null,
                          React.createElement('div', { className: 'dashboard-card-name' }, project.name),
                          React.createElement('div', { className: 'dashboard-card-slug' }, project.slug || 'draft')
                        ),
                        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
                          React.createElement('button', {
                            onClick: (e) => deleteProject(project.id, e),
                            style: { background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 4, color: '#525252', transition: 'color 0.15s', display: 'flex', alignItems: 'center' },
                            title: 'Delete project',
                            onMouseEnter: (e) => { e.currentTarget.style.color = '#EF4444'; },
                            onMouseLeave: (e) => { e.currentTarget.style.color = '#525252'; }
                          },
                            React.createElement('iconify-icon', { icon: 'solar:trash-bin-minimalistic-linear', width: 14 })
                          ),
                        React.createElement('div', { className: 'dashboard-card-status' },
                          React.createElement('div', { className: 'dashboard-card-status-dot' + (bestStatus === 'offline' ? ' offline' : bestStatus === 'building' || bestStatus === 'deploying' ? ' building' : bestStatus === 'failed' ? ' failed' : '') }),
                          bestStatus === 'live' ? 'Live' : bestStatus === 'deploying' ? 'Deploying' : bestStatus === 'failed' ? 'Failed' : 'Draft'
                        )
                        )
                      ),
                      // Mini architecture diagram
                      React.createElement('div', { className: 'dashboard-card-diagram' },
                        React.createElement(MiniArchDiagram, { architecture: arch })
                      ),
                      // Environment pills
                      envs.length > 0 && React.createElement('div', { className: 'dashboard-envs' },
                        envs.map(env =>
                          React.createElement('div', { key: env.name, className: 'dashboard-env-pill' },
                            React.createElement('div', { className: 'dashboard-env-dot' + (env.status === 'live' ? ' live' : env.status === 'deploying' ? ' deploying' : env.status === 'failed' ? ' failed' : '') }),
                            env.name === 'development' ? 'dev' : env.name === 'staging' ? 'stg' : env.name === 'production' ? 'prod' : env.name
                          )
                        )
                      ),
                      // Footer
                      React.createElement('div', { className: 'dashboard-card-footer' },
                        React.createElement('div', null,
                          React.createElement('div', { className: 'dashboard-card-cost' }, projectCostCents > 0 ? '$' + (projectCostCents / 100).toFixed(0) + '/mo' : 'Free'),
                          React.createElement('div', { className: 'dashboard-card-date' }, formatDate(project.createdAt))
                        ),
                        React.createElement('div', { style: { display: 'flex', gap: 6 } },
                          // Demo button
                          (() => {
                            const ps = previewSessions[project.id];
                            const loading = previewLoading[project.id];
                            if (loading || (ps && ps.status === 'starting')) {
                              return React.createElement('button', {
                                className: 'dashboard-card-preview-btn starting',
                                disabled: true,
                                onClick: (e) => e.stopPropagation()
                              },
                                React.createElement('iconify-icon', { icon: 'solar:refresh-linear', width: 12, style: { animation: 'spin 1s linear infinite' } }),
                                'Starting...'
                              );
                            }
                            if (ps && ps.status === 'running') {
                              return React.createElement('button', {
                                className: 'dashboard-card-preview-btn running',
                                onClick: (e) => stopLocalPreview(project.id, e)
                              },
                                React.createElement('iconify-icon', { icon: 'solar:stop-bold', width: 12 }),
                                'Stop'
                              );
                            }
                            return React.createElement('button', {
                              className: 'dashboard-card-preview-btn' + (ps && ps.status === 'error' ? ' error' : ''),
                              onClick: (e) => startLocalPreview(project.id, e)
                            },
                              React.createElement('iconify-icon', { icon: 'solar:play-linear', width: 12 }),
                              'Demo'
                            );
                          })(),
                          // Deploy button
                          React.createElement('button', {
                            className: 'dashboard-card-deploy-btn',
                            onClick: (e) => dashboardDeploy(project.id, 'development', e)
                          },
                            React.createElement('iconify-icon', { icon: 'solar:rocket-linear', width: 12 }),
                            'Deploy'
                          )
                        )
                      ),
                      // Preview services bar (shown when running)
                      previewSessions[project.id] && previewSessions[project.id].status === 'running' && previewSessions[project.id].services.length > 0 &&
                        React.createElement('div', { className: 'preview-services-bar' },
                          previewSessions[project.id].services.map((svc, i) =>
                            React.createElement('div', { key: i, className: 'preview-service-pill' },
                              svc.name,
                              svc.url && React.createElement('a', { href: svc.url, target: '_blank', onClick: (e) => e.stopPropagation() }, ' localhost:' + svc.port)
                            )
                          )
                        ),
                      // Preview error message
                      previewSessions[project.id] && previewSessions[project.id].status === 'error' && previewSessions[project.id].error &&
                        React.createElement('div', { style: { fontSize: 10, color: '#EF4444', marginTop: 8, padding: '6px 8px', background: 'rgba(239,68,68,0.08)', borderRadius: 6, wordBreak: 'break-word' }, onClick: (e) => e.stopPropagation() },
                          previewSessions[project.id].error.length > 120 ? previewSessions[project.id].error.slice(0, 120) + '...' : previewSessions[project.id].error
                        )
                    );
                  })
                ),

              // Cost breakdown
              costByProject.length > 0 && React.createElement('div', null,
                React.createElement('div', { className: 'dashboard-section-title', style: { marginTop: 8 } }, 'Cost Breakdown'),
                React.createElement('div', { className: 'dashboard-cost-section' },
                  React.createElement('h3', null, 'By Project'),
                  costByProject.map(item =>
                    React.createElement('div', { key: item.name, className: 'dashboard-cost-row' },
                      React.createElement('div', { className: 'dashboard-cost-label' }, item.name),
                      React.createElement('div', { className: 'dashboard-cost-bar-wrap' },
                        React.createElement('div', { className: 'dashboard-cost-bar', style: { width: (item.cost / maxProjectCost * 100) + '%' } })
                      ),
                      React.createElement('div', { className: 'dashboard-cost-amount' }, '$' + (item.cost / 100).toFixed(0))
                    )
                  )
                )
              )
            )
          )
        );
      }

      // === PROJECT LIST VIEW ===
      if (appView === 'projects') {
        return React.createElement('div', { className: 'project-list-view' },
          // Sidebar
          React.createElement('div', { className: 'project-sidebar' },
            React.createElement('div', { className: 'sidebar-header' },
              React.createElement('div', { className: 'sidebar-logo-icon' },
                React.createElement('iconify-icon', { icon: 'solar:layers-minimalistic-bold', width: 14 })
              ),
              React.createElement('span', { className: 'sidebar-logo' }, 'Brick Studio')
            ),
            React.createElement('div', { className: 'sidebar-nav' },
              React.createElement('div', { className: 'nav-section-title' }, 'Workspace'),
              React.createElement('div', { className: 'nav-item', onClick: () => setAppView('dashboard') },
                React.createElement('iconify-icon', { icon: 'solar:widget-5-linear', className: 'nav-item-icon' }),
                'Dashboard'
              ),
              React.createElement('div', { className: 'nav-item active' },
                React.createElement('iconify-icon', { icon: 'solar:folder-with-files-linear', className: 'nav-item-icon' }),
                'All Projects'
              ),
              React.createElement('div', { className: 'nav-item' },
                React.createElement('iconify-icon', { icon: 'solar:graph-new-linear', className: 'nav-item-icon' }),
                'Analytics'
              ),
              React.createElement('div', { className: 'nav-item' },
                React.createElement('iconify-icon', { icon: 'solar:users-group-rounded-linear', className: 'nav-item-icon' }),
                'Team'
              ),
              React.createElement('div', { className: 'nav-section-title' }, 'Settings'),
              React.createElement('div', { className: 'nav-item' },
                React.createElement('iconify-icon', { icon: 'solar:card-linear', className: 'nav-item-icon' }),
                'Billing'
              ),
              React.createElement('div', { className: 'nav-item', onClick: () => setAppView('settings') },
                React.createElement('iconify-icon', { icon: 'solar:settings-linear', className: 'nav-item-icon' }),
                'Preferences'
              )
            ),
            React.createElement('div', { className: 'sidebar-footer' },
              React.createElement('div', { className: 'sidebar-user' },
                React.createElement('div', { className: 'sidebar-user-avatar' }, user?.name?.charAt(0).toUpperCase() || 'U'),
                React.createElement('div', { className: 'sidebar-user-info' },
                  React.createElement('div', { className: 'sidebar-user-name' }, user?.name || 'User'),
                  React.createElement('div', { className: 'sidebar-user-plan' }, 'Pro Plan')
                ),
                React.createElement('button', { className: 'sidebar-logout', onClick: handleLogout },
                  React.createElement('iconify-icon', { icon: 'solar:logout-linear' })
                )
              )
            )
          ),

          // Main content
          React.createElement('main', { className: 'project-main' },
            React.createElement('header', { className: 'project-header' },
              React.createElement('h1', null, 'Projects'),
              React.createElement('div', { className: 'project-header-divider' }),
              React.createElement('div', { className: 'search-input-wrapper' },
                React.createElement('iconify-icon', { icon: 'solar:magnifer-linear', className: 'search-input-icon' }),
                React.createElement('input', {
                  className: 'search-input',
                  placeholder: 'Search projects...',
                  value: searchQuery,
                  onChange: e => setSearchQuery(e.target.value)
                })
              ),
              React.createElement('div', { className: 'project-header-spacer' }),
              React.createElement('button', {
                className: 'new-project-btn',
                onClick: createNewProject
              },
                React.createElement('iconify-icon', { icon: 'solar:add-circle-linear', width: 16 }),
                'New Project'
              )
            ),
            React.createElement('div', { className: 'project-content' },
              filteredProjects.length === 0 ?
                React.createElement('div', { className: 'project-empty' },
                  React.createElement('iconify-icon', { icon: 'solar:folder-open-linear', width: 48, style: { color: '#404040', marginBottom: 16 } }),
                  React.createElement('h3', null, searchQuery ? 'No matching projects' : 'No projects yet'),
                  React.createElement('p', null, searchQuery ? 'Try a different search term' : 'Create your first architecture project'),
                  !searchQuery && React.createElement('button', {
                    className: 'new-project-btn',
                    style: { marginTop: 16 },
                    onClick: createNewProject
                  },
                    React.createElement('iconify-icon', { icon: 'solar:add-circle-linear', width: 16 }),
                    'Create Project'
                  )
                )
              :
                React.createElement('table', { className: 'project-table' },
                  React.createElement('thead', null,
                    React.createElement('tr', null,
                      React.createElement('th', null, 'Name'),
                      React.createElement('th', null, 'Status'),
                      React.createElement('th', null, 'Region'),
                      React.createElement('th', null, 'Last Edited'),
                      React.createElement('th', { style: { width: 60 } }, '')
                    )
                  ),
                  React.createElement('tbody', null,
                    filteredProjects.map(project =>
                      React.createElement('tr', {
                        key: project.id,
                        onClick: () => loadProject(project.id)
                      },
                        React.createElement('td', null,
                          React.createElement('div', { className: 'project-name-cell' },
                            React.createElement('div', { className: 'project-icon' },
                              React.createElement('iconify-icon', { icon: 'solar:cloud-linear' })
                            ),
                            React.createElement('div', null,
                              React.createElement('div', { className: 'project-name-text' }, project.name),
                              React.createElement('div', { className: 'project-slug' }, project.slug || 'draft')
                            )
                          )
                        ),
                        React.createElement('td', null,
                          React.createElement('div', { className: 'project-status' },
                            React.createElement('div', { className: 'project-status-dot' + (project.environments?.[0]?.status === 'building' ? ' building' : project.environments?.[0]?.status !== 'live' ? ' offline' : '') }),
                            React.createElement('span', null, project.environments?.[0]?.status === 'live' ? 'Live' : project.environments?.[0]?.status || 'Draft')
                          )
                        ),
                        React.createElement('td', null,
                          React.createElement('div', { className: 'project-region' },
                            React.createElement('iconify-icon', { icon: 'solar:flag-linear', className: 'project-region-icon' }),
                            'US East'
                          )
                        ),
                        React.createElement('td', { className: 'project-date' }, formatDate(project.updatedAt || project.editedAt)),
                        React.createElement('td', null,
                          React.createElement('div', { className: 'project-actions' },
                            React.createElement('button', {
                              className: 'project-action-btn',
                              onClick: e => deleteProject(project.id, e)
                            },
                              React.createElement('iconify-icon', { icon: 'solar:menu-dots-linear' })
                            )
                          )
                        )
                      )
                    )
                  )
                )
            )
          )
        );
      }

      // === SETTINGS VIEW ===
      if (appView === 'settings') {
        return React.createElement('div', { className: 'settings-view' },
          // Sidebar
          React.createElement('div', { className: 'project-sidebar' },
            React.createElement('div', { className: 'sidebar-header' },
              React.createElement('div', { className: 'sidebar-logo-icon' },
                React.createElement('iconify-icon', { icon: 'solar:layers-minimalistic-bold', width: 14 })
              ),
              React.createElement('span', { className: 'sidebar-logo' }, 'Brick Studio')
            ),
            React.createElement('div', { className: 'sidebar-nav' },
              React.createElement('div', { className: 'nav-section-title' }, 'Workspace'),
              React.createElement('div', { className: 'nav-item', onClick: () => setAppView('dashboard') },
                React.createElement('iconify-icon', { icon: 'solar:widget-5-linear', className: 'nav-item-icon' }),
                'Dashboard'
              ),
              React.createElement('div', { className: 'nav-item', onClick: () => setAppView('projects') },
                React.createElement('iconify-icon', { icon: 'solar:folder-with-files-linear', className: 'nav-item-icon' }),
                'All Projects'
              ),
              React.createElement('div', { className: 'nav-item' },
                React.createElement('iconify-icon', { icon: 'solar:graph-new-linear', className: 'nav-item-icon' }),
                'Analytics'
              ),
              React.createElement('div', { className: 'nav-item' },
                React.createElement('iconify-icon', { icon: 'solar:users-group-rounded-linear', className: 'nav-item-icon' }),
                'Team'
              ),
              React.createElement('div', { className: 'nav-section-title' }, 'Settings'),
              React.createElement('div', { className: 'nav-item' },
                React.createElement('iconify-icon', { icon: 'solar:card-linear', className: 'nav-item-icon' }),
                'Billing'
              ),
              React.createElement('div', { className: 'nav-item active' },
                React.createElement('iconify-icon', { icon: 'solar:settings-linear', className: 'nav-item-icon' }),
                'Preferences'
              )
            ),
            React.createElement('div', { className: 'sidebar-footer' },
              React.createElement('div', { className: 'sidebar-user' },
                React.createElement('div', { className: 'sidebar-user-avatar' }, user?.name?.charAt(0).toUpperCase() || 'U'),
                React.createElement('div', { className: 'sidebar-user-info' },
                  React.createElement('div', { className: 'sidebar-user-name' }, user?.name || 'User'),
                  React.createElement('div', { className: 'sidebar-user-plan' }, 'Pro Plan')
                ),
                React.createElement('button', { className: 'sidebar-logout', onClick: handleLogout },
                  React.createElement('iconify-icon', { icon: 'solar:logout-linear' })
                )
              )
            )
          ),
          // Main content
          React.createElement('main', { className: 'project-main' },
            React.createElement('header', { className: 'project-header' },
              React.createElement('h1', null, 'Preferences')
            ),
            React.createElement('div', { className: 'settings-content' },
              // Appearance Settings (NEW)
              React.createElement('div', { className: 'settings-section' },
                React.createElement('h2', null, 'Appearance'),
                React.createElement('p', null, 'Customize the look and feel of Brick Studio'),
                React.createElement('div', { className: 'settings-row' },
                  React.createElement('span', { className: 'settings-label' }, 'Theme'),
                  React.createElement('select', {
                    className: 'settings-select',
                    value: localStorage.getItem('brick-theme') || 'dark',
                    onChange: e => {
                      const theme = e.target.value;
                      localStorage.setItem('brick-theme', theme);
                      document.documentElement.className = theme;
                    }
                  },
                    React.createElement('option', { value: 'dark' }, 'Dark'),
                    React.createElement('option', { value: 'light' }, 'Light'),
                    React.createElement('option', { value: 'auto' }, 'Auto (System)')
                  )
                )
              ),
              // AI Usage (NEW)
              React.createElement('div', { className: 'settings-section' },
                React.createElement('h2', null, 'AI Usage'),
                React.createElement('p', null, 'Track your AI model usage and costs'),
                React.createElement('div', { className: 'settings-row' },
                  React.createElement('span', { className: 'settings-label' }, 'This Month'),
                  React.createElement('span', { className: 'settings-value', id: 'ai-usage-month' }, 'Loading...')
                ),
                React.createElement('div', { className: 'settings-row' },
                  React.createElement('span', { className: 'settings-label' }, 'Total Tokens'),
                  React.createElement('span', { className: 'settings-value', id: 'ai-usage-tokens' }, '-')
                ),
                React.createElement('div', { className: 'settings-row' },
                  React.createElement('span', { className: 'settings-label' }, 'Estimated Cost'),
                  React.createElement('span', { className: 'settings-value', id: 'ai-usage-cost' }, '-')
                )
              ),
              // LLM Settings
              React.createElement('div', { className: 'settings-section' },
                React.createElement('h2', null, 'AI Model'),
                React.createElement('p', null, 'Configure the language model used for architecture generation'),
                React.createElement('div', { className: 'settings-row' },
                  React.createElement('span', { className: 'settings-label' }, 'Model'),
                  React.createElement('select', {
                    className: 'settings-select',
                    value: selectedModel,
                    onChange: e => changeModel(e.target.value)
                  },
                    Object.entries(modelGroups).map(([provider, list]) =>
                      React.createElement('optgroup', { key: provider, label: provider },
                        list.map(m => React.createElement('option', { key: m.id, value: m.id }, m.name))
                      )
                    )
                  )
                )
              ),
              // GitHub Integration (NEW)
              React.createElement('div', { className: 'settings-section' },
                React.createElement('h2', null, 'GitHub'),
                React.createElement('p', null, 'Connect your GitHub account to push generated code'),
                React.createElement('div', { className: 'settings-row' },
                  React.createElement('span', { className: 'settings-label' }, 'Status'),
                  React.createElement('span', { className: 'settings-value', id: 'github-status' }, 'Not connected')
                ),
                React.createElement('button', {
                  className: 'primary',
                  id: 'github-connect-btn',
                  style: { marginTop: 8 },
                  onClick: () => {
                    window.open('/api/github/auth', '_blank', 'width=600,height=700');
                  }
                }, 'Connect GitHub')
              ),
              // Workspace Settings
              React.createElement('div', { className: 'settings-section' },
                React.createElement('h2', null, 'Workspace'),
                React.createElement('p', null, 'Manage your projects and workspace settings'),
                React.createElement('div', { className: 'settings-row' },
                  React.createElement('span', { className: 'settings-label' }, 'Total Projects'),
                  React.createElement('span', { className: 'settings-value' }, projects.length + ' project' + (projects.length !== 1 ? 's' : ''))
                ),
                React.createElement('div', { className: 'settings-row' },
                  React.createElement('span', { className: 'settings-label' }, 'Database'),
                  React.createElement('span', { className: 'settings-value' }, 'SQLite (persistent)')
                )
              ),
              // About
              React.createElement('div', { className: 'settings-section' },
                React.createElement('h2', null, 'About'),
                React.createElement('p', null, 'Brick Studio - Visual Architecture Designer'),
                React.createElement('div', { className: 'settings-row' },
                  React.createElement('span', { className: 'settings-label' }, 'Version'),
                  React.createElement('span', { className: 'settings-value' }, '0.2.0')
                ),
                React.createElement('div', { className: 'settings-row' },
                  React.createElement('span', { className: 'settings-label' }, 'Documentation'),
                  React.createElement('a', {
                    href: 'https://github.com/your-repo/brick',
                    target: '_blank',
                    style: { color: 'var(--accent)', textDecoration: 'none', fontSize: 13 }
                  }, 'View on GitHub')
                )
              )
            )
          )
        );
      }

      // Show template gallery or configuration view (full-page flow)
      if (appView === 'editor' && showTemplates && !ir) {
        const typeColors = {
          static_site: '#22C55E', service: '#3B82F6', database: '#F59E0B',
          cache: '#EF4444', queue: '#8B5CF6', worker: '#EC4899', cdn: '#3B82F6',
          api_gateway: '#06B6D4', load_balancer: '#EC4899', auth: '#F97316',
          storage: '#6366F1', search: '#A855F7', monitoring: '#84CC16', ml_model: '#0EA5E9'
        };
        const typeIcons = {
          static_site: 'solar:monitor-smartphone-linear', service: 'solar:server-linear',
          database: 'solar:database-linear', cache: 'solar:bolt-linear', cdn: 'solar:globe-linear',
          queue: 'solar:letter-linear', worker: 'solar:cpu-bolt-linear',
          api_gateway: 'solar:routing-2-linear', load_balancer: 'solar:sort-linear',
          auth: 'solar:lock-linear', storage: 'solar:cloud-storage-linear',
          search: 'solar:magnifer-linear', monitoring: 'solar:chart-2-linear',
          ml_model: 'solar:brain-linear'
        };

        // Show configuration view if template selected
        if (previewTemplate) {
          return React.createElement('div', { className: 'app', style: { display: 'flex', flexDirection: 'column' } },
            // Header with breadcrumb
            React.createElement('header', null,
              React.createElement('div', { className: 'logo', style: { cursor: 'pointer' }, onClick: goToDashboard },
                React.createElement('iconify-icon', { icon: 'solar:layers-minimalistic-bold', width: 20, style: { color: 'var(--accent)' } }),
                'Brick Studio'
              ),
              React.createElement('div', { className: 'header-spacer' }),
              // Breadcrumb navigation
              React.createElement('div', { className: 'breadcrumb-nav' },
                React.createElement('span', { style: { cursor: 'pointer' }, onClick: () => setPreviewTemplate(null) }, 'Templates'),
                React.createElement('iconify-icon', { icon: 'solar:alt-arrow-right-linear', width: 14, style: { color: '#404040' } }),
                React.createElement('span', { className: 'active' }, 'Configure'),
                React.createElement('iconify-icon', { icon: 'solar:alt-arrow-right-linear', width: 14, style: { color: '#404040' } }),
                React.createElement('span', null, 'Build')
              ),
              React.createElement('div', { className: 'header-spacer' })
            ),
            // Two-column configuration layout
            React.createElement('div', { className: 'template-config-view' },
              // Left panel - Template info
              React.createElement('div', { className: 'template-config-left' },
                React.createElement('button', { className: 'back-btn', onClick: () => setPreviewTemplate(null) },
                  React.createElement('iconify-icon', { icon: 'solar:arrow-left-linear', width: 16 }),
                  'Back to templates'
                ),
                React.createElement('div', { className: 'template-config-icon' },
                  React.createElement('iconify-icon', { icon: 'solar:layers-minimalistic-linear', width: 32, style: { color: 'var(--accent)' } })
                ),
                React.createElement('h2', { className: 'template-config-title' }, previewTemplate.name),
                React.createElement('p', { className: 'template-config-desc' }, previewTemplate.longDescription),
                // Features list
                React.createElement('div', { className: 'template-features' },
                  React.createElement('div', { className: 'template-feature' },
                    React.createElement('iconify-icon', { icon: 'solar:check-circle-linear', width: 16 }),
                    'Pre-configured for production workloads'
                  ),
                  React.createElement('div', { className: 'template-feature' },
                    React.createElement('iconify-icon', { icon: 'solar:check-circle-linear', width: 16 }),
                    'Optimized component connections'
                  ),
                  React.createElement('div', { className: 'template-feature' },
                    React.createElement('iconify-icon', { icon: 'solar:check-circle-linear', width: 16 }),
                    previewTemplate.components.length + ' components ready to deploy'
                  )
                ),
                // Mini diagram placeholder
                React.createElement('div', { className: 'mini-diagram' },
                  React.createElement('div', { className: 'mini-diagram-grid' }),
                  React.createElement('div', { style: { position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12 } },
                    previewTemplate.components.slice(0, 3).map((comp, i) =>
                      React.createElement('div', {
                        key: comp.id,
                        style: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(23,23,23,0.8)', borderRadius: 8, border: '1px solid #404040' }
                      },
                        React.createElement('iconify-icon', { icon: typeIcons[comp.type] || 'solar:box-linear', width: 16, style: { color: typeColors[comp.type] || '#666' } }),
                        React.createElement('span', { style: { fontSize: 11, color: '#a3a3a3' } }, comp.name)
                      )
                    ),
                    previewTemplate.components.length > 3 && React.createElement('span', { style: { fontSize: 10, color: '#525252' } }, '+' + (previewTemplate.components.length - 3) + ' more')
                  )
                )
              ),
              // Right panel - Tech stack configuration
              React.createElement('div', { className: 'template-config-right' },
                React.createElement('div', { className: 'template-config-right-header' },
                  React.createElement('h2', { style: { fontSize: 18, fontWeight: 500, color: 'white' } }, 'Configure Your Stack'),
                  React.createElement('p', { style: { fontSize: 14, color: '#737373', marginTop: 4 } }, 'Select the technologies for each component.')
                ),
                React.createElement('div', { className: 'template-config-right-body' },
                  previewTemplate.components.map(comp =>
                    React.createElement('div', { key: comp.id, className: 'component-config-row' },
                      React.createElement('div', { className: 'component-config-info' },
                        React.createElement('div', {
                          className: 'component-config-icon',
                          style: { background: (typeColors[comp.type] || '#666') + '15', color: typeColors[comp.type] || '#666' }
                        },
                          React.createElement('iconify-icon', { icon: typeIcons[comp.type] || 'solar:box-linear', width: 20 })
                        ),
                        React.createElement('div', null,
                          React.createElement('div', { className: 'component-config-name' },
                            comp.name,
                            React.createElement('span', { className: 'component-config-type-badge' }, comp.type.replace('_', ' '))
                          ),
                          React.createElement('div', { className: 'component-config-subtitle' },
                            comp.type === 'service' ? 'Core business logic' :
                            comp.type === 'database' ? 'Persistent data storage' :
                            comp.type === 'cache' ? 'High-speed data layer' :
                            comp.type === 'cdn' ? 'Global edge delivery' :
                            comp.type === 'load_balancer' ? 'Traffic distribution' :
                            'Infrastructure component'
                          )
                        )
                      ),
                      React.createElement('select', {
                        className: 'tech-select',
                        value: templateTechStacks[comp.id] || comp.defaultTech,
                        onChange: (e) => setTemplateTechStacks(prev => ({ ...prev, [comp.id]: e.target.value }))
                      },
                        comp.techOptions.map(tech =>
                          React.createElement('option', { key: tech, value: tech }, tech)
                        )
                      )
                    )
                  )
                ),
                // Footer with cost and create button
                React.createElement('div', { className: 'template-config-footer' },
                  React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 } },
                    React.createElement('span', { style: { color: '#737373' } }, 'Estimated cost:'),
                    React.createElement('span', { style: { fontWeight: 600, color: 'white', fontFamily: 'JetBrains Mono, monospace' } }, '~$' + (previewTemplate.components.length * 8) + '/mo')
                  ),
                  React.createElement('button', {
                    className: 'primary',
                    onClick: () => {
                      loadTemplate(previewTemplate.id);
                      setPreviewTemplate(null);
                    },
                    style: { padding: '12px 24px', fontSize: 14, fontWeight: 600, boxShadow: '0 0 20px -4px rgba(255,255,255,0.2)' }
                  }, 'Create Project')
                )
              )
            )
          );
        }

        // Template gallery (Step 1)
        return React.createElement('div', { className: 'app' },
          React.createElement('header', null,
            React.createElement('button', {
              onClick: goToDashboard,
              style: { padding: 8, borderRadius: 6, border: '1px solid transparent' }
            },
              React.createElement('iconify-icon', { icon: 'solar:arrow-left-linear', width: 20 })
            ),
            React.createElement('div', { className: 'logo', style: { cursor: 'pointer' }, onClick: goToDashboard },
              React.createElement('iconify-icon', { icon: 'solar:layers-minimalistic-bold', width: 20, style: { color: 'var(--accent)' } }),
              'Brick Studio'
            ),
            React.createElement('div', { className: 'header-spacer' }),
            // Breadcrumb navigation
            React.createElement('div', { className: 'breadcrumb-nav' },
              React.createElement('span', { className: 'active' }, 'Templates'),
              React.createElement('iconify-icon', { icon: 'solar:alt-arrow-right-linear', width: 14, style: { color: '#404040' } }),
              React.createElement('span', null, 'Configure'),
              React.createElement('iconify-icon', { icon: 'solar:alt-arrow-right-linear', width: 14, style: { color: '#404040' } }),
              React.createElement('span', null, 'Build')
            ),
            React.createElement('div', { className: 'header-spacer' })
          ),
          React.createElement('div', { className: 'template-gallery', style: { gridColumn: '1 / -1' } },
            React.createElement('h2', null, 'Start Your Project'),
            React.createElement('p', null, 'Choose a pre-configured architecture or start from scratch'),
            React.createElement('div', { className: 'template-grid' },
              templates.map(t => React.createElement('div', {
                key: t.id,
                className: 'template-card' + (t.id === 'blank' ? ' blank' : ''),
                style: t.id === 'blank' ? { borderStyle: 'dashed', background: 'transparent' } : {},
                onClick: () => {
                  if (t.id === 'blank') {
                    loadTemplate(t.id);
                  } else {
                    fetch('/api/templates/' + t.id)
                      .then(r => r.json())
                      .then(data => {
                        setPreviewTemplate(data);
                        const defaults = {};
                        data.components.forEach(c => { defaults[c.id] = c.defaultTech; });
                        setTemplateTechStacks(defaults);
                      });
                  }
                }
              },
                React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 } },
                  React.createElement('div', {
                    style: {
                      width: 40, height: 40, borderRadius: 10,
                      background: t.id === 'blank' ? '#262626' : 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.1))',
                      border: t.id === 'blank' ? '1px solid #404040' : '1px solid rgba(99,102,241,0.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }
                  },
                    React.createElement('iconify-icon', {
                      icon: t.id === 'blank' ? 'solar:add-circle-linear' : 'solar:layers-minimalistic-linear',
                      width: 20,
                      style: { color: t.id === 'blank' ? '#737373' : 'var(--accent)' }
                    })
                  ),
                  t.componentCount > 0 && React.createElement('span', {
                    style: { fontSize: 10, padding: '2px 8px', borderRadius: 99, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#737373', fontFamily: 'JetBrains Mono, monospace' }
                  }, t.componentCount + ' comps')
                ),
                React.createElement('div', { className: 'template-name' }, t.name),
                React.createElement('div', { className: 'template-desc' }, t.description)
              ))
            ),
            // AI Input with glow effect
            React.createElement('div', { className: 'ai-input-wrapper', style: { marginTop: 48 } },
              React.createElement('div', { className: 'ai-input-glow' }),
              React.createElement('div', { className: 'ai-input-container' },
                React.createElement('iconify-icon', { icon: 'solar:magic-stick-3-linear', width: 20, style: { color: '#737373' } }),
                React.createElement('input', {
                  type: 'text',
                  className: 'ai-input',
                  placeholder: "Or describe what you want to build (e.g. 'A video streaming app')",
                  value: input,
                  onChange: (e) => setInput(e.target.value),
                  onKeyDown: (e) => { if (e.key === 'Enter') { setShowTemplates(false); sendMessage(); } }
                }),
                React.createElement('button', {
                  className: 'ai-input-btn',
                  onClick: () => { setShowTemplates(false); sendMessage(); }
                }, 'Use AI')
              )
            )
          )
        );
      }

      return React.createElement('div', { className: appClassName, style: gridStyle },
        React.createElement('header', null,
          React.createElement('button', {
            onClick: goToDashboard,
            style: { padding: 8, borderRadius: 6, border: '1px solid transparent', marginRight: 8 }
          },
            React.createElement('iconify-icon', { icon: 'solar:arrow-left-linear', width: 20 })
          ),
          React.createElement('div', { style: { display: 'flex', flexDirection: 'column' } },
            React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
              editingName ?
                React.createElement('input', {
                  type: 'text',
                  value: projectName,
                  onChange: (e) => setProjectName(e.target.value),
                  onBlur: () => { setEditingName(false); updateProjectName(projectName); },
                  onKeyDown: (e) => { if (e.key === 'Enter') { setEditingName(false); updateProjectName(projectName); } },
                  autoFocus: true,
                  style: { background: 'var(--bg-tertiary)', border: '1px solid var(--accent)', borderRadius: 4, padding: '2px 6px', fontWeight: 600, fontSize: 12, color: 'white', width: 150 }
                })
              :
                React.createElement('span', {
                  style: { fontWeight: 600, fontSize: 12, color: 'white', cursor: 'pointer' },
                  onClick: () => { setProjectName(manualArch?.name || ir?.name || 'Untitled'); setEditingName(true); },
                  title: 'Click to rename'
                }, manualArch?.name || ir?.name || 'Untitled'),
              React.createElement('button', {
                onClick: () => { setProjectName(manualArch?.name || ir?.name || 'Untitled'); setEditingName(true); },
                style: { background: 'none', border: 'none', padding: 2, cursor: 'pointer', color: '#525252' },
                title: 'Rename project'
              }, React.createElement('iconify-icon', { icon: 'solar:pen-linear', width: 12 })),
              React.createElement('div', { style: { width: 6, height: 6, borderRadius: '50%', background: 'var(--success)' } })
            ),
            React.createElement('span', { style: { fontSize: 10, color: '#525252' } }, 'Last saved just now')
          ),
          React.createElement('div', { className: 'header-spacer' }),
          // Central view toggle - always visible
          React.createElement('div', { className: 'view-toggle', style: { position: 'absolute', left: '50%', transform: 'translateX(-50%)' } },
            React.createElement('button', {
              className: viewMode === 'architecture' ? 'active' : '',
              onClick: () => setViewMode('architecture'),
              style: { display: 'flex', alignItems: 'center', gap: 6 }
            },
              React.createElement('iconify-icon', { icon: 'solar:layers-minimalistic-linear', width: 14 }),
              'Canvas'
            ),
            React.createElement('button', {
              className: viewMode === 'docs' ? 'active' : '',
              onClick: () => setViewMode('docs'),
              style: { display: 'flex', alignItems: 'center', gap: 6 }
            },
              React.createElement('iconify-icon', { icon: 'solar:document-text-linear', width: 14 }),
              'Docs'
            ),
            React.createElement('button', {
              className: viewMode === 'code' ? 'active' : '',
              onClick: () => setViewMode('code'),
              style: { display: 'flex', alignItems: 'center', gap: 6 }
            },
              React.createElement('iconify-icon', { icon: 'solar:code-square-linear', width: 14 }),
              'Code'
            )
          ),
          // Toggle panels collapsed
          React.createElement('button', {
            onClick: () => {
              if (anyCollapsed) {
                setChatCollapsed(false); setCostCollapsed(false); setPaletteCollapsed(false);
              } else {
                setChatCollapsed(true); setCostCollapsed(true); setPaletteCollapsed(true);
              }
            },
            style: { padding: 8, borderRadius: 6, background: anyCollapsed ? 'var(--accent)' : 'var(--bg-tertiary)', border: '1px solid var(--border-color)', marginRight: 8, cursor: 'pointer' },
            title: anyCollapsed ? 'Expand all panels' : 'Collapse all panels'
          },
            React.createElement('iconify-icon', { icon: anyCollapsed ? 'solar:sidebar-minimalistic-bold' : 'solar:sidebar-minimalistic-linear', width: 16, style: { color: anyCollapsed ? 'white' : '#a3a3a3' } })
          ),
          // AI status indicator
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px', background: 'var(--bg-tertiary)', borderRadius: 9999, border: '1px solid var(--border-color)', marginRight: 12 } },
            React.createElement('div', { style: { width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', animation: 'pulse 2s infinite' } }),
            React.createElement('span', { style: { fontSize: 10, color: '#a3a3a3' } }, 'AI Active')
          ),
          // Builder mode toggle (hidden in favor of inline editing)
          ir && viewMode === 'architecture' && !builderMode && React.createElement('button', {
            onClick: () => {
              if (!manualArch) {
                const arch = {
                  name: ir.name || 'my-app',
                  components: ir.components.map((c, i) => ({
                    id: c.id,
                    name: c.name,
                    type: c.type,
                    x: 300 + (i % 3) * 200,
                    y: 150 + Math.floor(i / 3) * 150,
                  })),
                  connections: ir.components.flatMap(c =>
                    (c.connections || []).map(to => ({ from: c.id, to }))
                  ),
                };
                setManualArch(arch);
              }
              setBuilderMode(true);
            },
            style: { marginRight: 8 }
          }, 'Edit'),
          React.createElement('select', { className: 'model-select', value: selectedModel, onChange: e => changeModel(e.target.value), style: { display: 'none' } },
            Object.entries(modelGroups).map(([provider, list]) =>
              React.createElement('optgroup', { key: provider, label: provider },
                list.map(m => React.createElement('option', { key: m.id, value: m.id }, m.name))
              )
            )
          ),
          React.createElement('div', { className: 'actions', style: { display: 'flex', gap: 8 } },
            // Run Locally button
            (ir || manualArch) && currentProjectId && (() => {
              const ps = previewSessions[currentProjectId];
              const loading = previewLoading[currentProjectId];
              if (loading || (ps && ps.status === 'starting')) {
                return React.createElement('button', {
                  style: { background: '#EAB308', color: 'black', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', opacity: 0.8 },
                  disabled: true
                },
                  React.createElement('iconify-icon', { icon: 'solar:refresh-linear', style: { animation: 'spin 1s linear infinite' } }),
                  'Starting...'
                );
              }
              if (ps && ps.status === 'running') {
                return React.createElement('button', {
                  style: { background: '#EF4444', color: 'white', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px' },
                  onClick: () => stopLocalPreview(currentProjectId)
                },
                  React.createElement('iconify-icon', { icon: 'solar:stop-bold' }),
                  'Stop Preview'
                );
              }
              return React.createElement('button', {
                style: { background: 'var(--bg-tertiary)', color: '#A3A3A3', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', border: '1px solid var(--border-color)' },
                onClick: () => startLocalPreview(currentProjectId)
              },
                React.createElement('iconify-icon', { icon: 'solar:monitor-linear' }),
                'Run Locally'
              );
            })(),
            (ir || manualArch) && React.createElement('button', {
              style: { background: '#22C55E', color: 'white', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px' },
              onClick: () => deployProject('development'),
              disabled: deploying,
              title: 'Quick deploy to development'
            },
              React.createElement('iconify-icon', { icon: 'solar:play-bold' }),
              deploying ? 'Deploying...' : 'Quick Deploy'
            ),
            (ir || manualArch) && React.createElement('button', {
              style: { background: 'white', color: 'black', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 0 15px rgba(255,255,255,0.1)' },
              onClick: () => setShowDeployModal(true),
              disabled: deploying,
              title: 'Deploy with options'
            },
              React.createElement('iconify-icon', { icon: 'solar:settings-linear' })
            )
          )
        ),

        // Sidebar icons for collapsed panels - show icon for each collapsed panel
        anyCollapsed && React.createElement('div', { className: 'collapse-bar', style: {
          position: 'fixed', left: 0, top: 60, bottom: 0, width: 48, zIndex: 80,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, paddingTop: 12,
          background: 'var(--bg-secondary)', borderRight: '1px solid var(--border-color)'
        } },
          chatCollapsed && React.createElement('button', {
            className: 'collapse-bar-item',
            onClick: () => setChatCollapsed(false),
            title: 'Open Assistant'
          },
            React.createElement('iconify-icon', { icon: 'solar:chat-round-dots-linear', width: 18 })
          ),
          paletteCollapsed && builderMode && React.createElement('button', {
            className: 'collapse-bar-item',
            onClick: () => setPaletteCollapsed(false),
            title: 'Open Components'
          },
            React.createElement('iconify-icon', { icon: 'solar:widget-add-linear', width: 18 })
          ),
          costCollapsed && React.createElement('button', {
            className: 'collapse-bar-item',
            onClick: () => setCostCollapsed(false),
            title: 'Open Cost Breakdown'
          },
            React.createElement('iconify-icon', { icon: 'solar:chart-2-linear', width: 18 })
          ),
          React.createElement('div', { className: 'collapse-bar-divider' }),
          React.createElement('button', {
            className: 'collapse-bar-item',
            onClick: () => { setChatCollapsed(false); setCostCollapsed(false); setPaletteCollapsed(false); },
            title: 'Expand all panels'
          },
            React.createElement('iconify-icon', { icon: 'solar:sidebar-minimalistic-linear', width: 18 })
          )
        ),

        // Regular chat panel
        !chatCollapsed && React.createElement('div', { className: 'chat-panel' },
          React.createElement('div', { className: 'panel-header', style: { background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 8 } },
            React.createElement('div', { className: 'canvas-mode-toggle' },
              React.createElement('button', {
                className: 'canvas-mode-btn' + (canvasChatMode === 'design' ? ' active' : ''),
                onClick: () => setCanvasChatMode('design')
              }, 'Design'),
              React.createElement('button', {
                className: 'canvas-mode-btn' + (canvasChatMode === 'dev' ? ' active' : ''),
                onClick: () => setCanvasChatMode('dev')
              }, 'Dev')
            ),
            React.createElement('button', { className: 'panel-collapse-btn', onClick: () => setChatCollapsed(true), style: { color: '#525252', marginLeft: 'auto' } },
              React.createElement('iconify-icon', { icon: 'solar:settings-minimalistic-linear' })
            )
          ),
          // === Design mode content ===
          canvasChatMode === 'design' && streamingContent && previewComponents.length > 0 && React.createElement('div', { className: 'live-preview-panel' },
            React.createElement('div', { className: 'live-preview-header' },
              React.createElement('div', { className: 'pulse-dot' }),
              'Building Architecture'
            ),
            React.createElement('div', { className: 'live-preview-components' },
              previewComponents.map((comp, i) => {
                const icons = {
                  service: 'solar:server-linear',
                  static_site: 'solar:monitor-smartphone-linear',
                  database: 'solar:database-linear',
                  worker: 'solar:cpu-bolt-linear',
                  job: 'solar:clock-circle-linear'
                };
                return React.createElement('div', { className: 'preview-component', key: comp.id || i },
                  React.createElement('div', { className: 'preview-component-icon ' + comp.type },
                    React.createElement('iconify-icon', { icon: icons[comp.type] || 'solar:box-linear', width: 12 })
                  ),
                  React.createElement('div', null,
                    React.createElement('div', { className: 'preview-component-name' }, comp.name),
                    React.createElement('div', { className: 'preview-component-type' }, comp.type.replace('_', ' '))
                  )
                );
              })
            )
          ),
          canvasChatMode === 'design' && React.createElement('div', { className: 'chat-messages', ref: chatRef },
            messages.length === 0 && !streamingContent ?
              React.createElement('div', { className: 'welcome' },
                React.createElement('h2', null, 'Design Your Architecture'),
                React.createElement('p', null, 'Describe what you want to build'),
                React.createElement('div', { className: 'examples' },
                  React.createElement('button', { className: 'example-btn', onClick: () => sendMessage('A blog with Next.js and PostgreSQL') }, '📝 Blog with Next.js + PostgreSQL'),
                  React.createElement('button', { className: 'example-btn', onClick: () => sendMessage('E-commerce with React, Node API, Postgres and Redis') }, '🛒 E-commerce microservices'),
                  React.createElement('button', { className: 'example-btn', onClick: () => sendMessage('Background jobs with API, Redis queue, email and PDF workers') }, '⚙️ Job processor')
                )
              )
            : React.createElement(React.Fragment, null,
                messages.map((m, i) =>
                  React.createElement('div', { className: 'message ' + m.role, key: i },
                    React.createElement('div', { className: 'message-header' },
                      React.createElement('div', { className: 'message-avatar', style: m.role === 'user' ? { background: '#404040' } : { background: 'linear-gradient(135deg, var(--accent), #7c3aed)' } },
                        m.role === 'user'
                          ? React.createElement('span', { style: { fontSize: 10, fontWeight: 700 } }, user?.name?.charAt(0)?.toUpperCase() || 'U')
                          : React.createElement('iconify-icon', { icon: 'solar:magic-stick-3-linear', width: 14 })
                      ),
                      React.createElement('span', { className: 'message-role' }, m.role === 'user' ? 'You' : 'Brick')
                    ),
                    React.createElement('div', { className: 'message-content' }, m.content)
                  )
                ),
                loading && !streamingContent && React.createElement('div', { className: 'message assistant' },
                  React.createElement('div', { className: 'message-header' },
                    React.createElement('div', { className: 'message-avatar', style: { background: 'linear-gradient(135deg, var(--accent), #7c3aed)' } },
                      React.createElement('iconify-icon', { icon: 'solar:magic-stick-3-linear', width: 14 })
                    ),
                    React.createElement('span', { className: 'message-role' }, 'Brick is thinking...')
                  ),
                  React.createElement('div', { className: 'typing-indicator' },
                    React.createElement('div', { className: 'typing-dot' }),
                    React.createElement('div', { className: 'typing-dot' }),
                    React.createElement('div', { className: 'typing-dot' })
                  )
                ),
                streamingContent && React.createElement('div', { className: 'message assistant' },
                  React.createElement('div', { className: 'message-header' },
                    React.createElement('div', { className: 'message-avatar', style: { background: 'linear-gradient(135deg, var(--accent), #7c3aed)' } },
                      React.createElement('iconify-icon', { icon: 'solar:magic-stick-3-linear', width: 14 })
                    ),
                    React.createElement('span', { className: 'message-role' }, 'Brick')
                  ),
                  React.createElement('div', { className: 'message-content' }, streamingContent + '▊')
                )
              )
          ),
          canvasChatMode === 'design' && React.createElement('div', { className: 'chat-input-area', style: { position: 'relative' } },
            showAutocomplete && autocompleteItems.length > 0 && React.createElement('div', {
              className: 'autocomplete-dropdown',
              style: {
                position: 'absolute', bottom: '100%', left: 0, right: 0,
                background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                borderRadius: 8, marginBottom: 8, overflow: 'hidden',
                boxShadow: '0 -4px 12px rgba(0,0,0,0.2)', zIndex: 100
              }
            },
              autocompleteItems.map((item, i) =>
                React.createElement('div', {
                  key: item,
                  onClick: () => { setInput(item); setShowAutocomplete(false); },
                  style: {
                    padding: '10px 14px', cursor: 'pointer', fontSize: 13,
                    background: i === selectedAutocomplete ? 'var(--bg-tertiary)' : 'transparent',
                    display: 'flex', alignItems: 'center', gap: 8
                  }
                },
                  React.createElement('iconify-icon', { icon: 'solar:magic-stick-3-linear', width: 14, style: { color: 'var(--accent)' } }),
                  item
                )
              )
            ),
            React.createElement('textarea', {
              className: 'chat-input', value: input,
              onChange: e => {
                const val = e.target.value;
                setInput(val);
                const words = val.toLowerCase().split(' ');
                const lastWord = words[words.length - 1];
                const match = AUTOCOMPLETE_PATTERNS.find(p => lastWord.startsWith(p.trigger) && lastWord.length >= 2);
                if (match) {
                  setAutocompleteItems(match.suggestions);
                  setShowAutocomplete(true);
                  setSelectedAutocomplete(0);
                } else {
                  setShowAutocomplete(false);
                }
              },
              onKeyDown: e => {
                if (showAutocomplete && autocompleteItems.length > 0) {
                  if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedAutocomplete(i => Math.min(i + 1, autocompleteItems.length - 1)); }
                  else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedAutocomplete(i => Math.max(i - 1, 0)); }
                  else if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) {
                    e.preventDefault();
                    setInput(autocompleteItems[selectedAutocomplete]);
                    setShowAutocomplete(false);
                  }
                  else if (e.key === 'Escape') { setShowAutocomplete(false); }
                } else if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              },
              onBlur: () => setTimeout(() => setShowAutocomplete(false), 200),
              placeholder: 'Describe your app...', rows: 2, disabled: loading
            }),
            React.createElement('button', { className: 'primary', onClick: () => sendMessage(), disabled: loading, style: { width: '100%' } },
              loading ? 'Generating...' : 'Send'
            )
          ),

          // === Dev mode content (Claude Code) ===
          canvasChatMode === 'dev' && React.createElement('div', { className: 'chat-messages', ref: chatRef },
            devMessages.map((msg, i) =>
              React.createElement('div', {
                key: i,
                className: 'dev-message ' + (msg.role === 'system' ? 'system-msg' : msg.role === 'user' ? 'user-msg' : 'assistant-msg')
              },
                (msg.content || '').split('\\n').map((line, j) =>
                  React.createElement('div', { key: j }, line || React.createElement('br'))
                )
              )
            ),
            isDevProcessing && React.createElement('div', { className: 'dev-message system-msg' }, 'Processing...'),
            isDevProcessing && React.createElement('button', { className: 'dev-cancel-btn', onClick: cancelDev }, 'Cancel')
          ),
          canvasChatMode === 'dev' && React.createElement('div', { className: 'chat-input-area' },
            React.createElement('textarea', {
              className: 'chat-input', value: input,
              onChange: e => setInput(e.target.value),
              onKeyDown: e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendDevMessage();
                }
              },
              placeholder: 'Tell Claude Code what to build...', rows: 2, disabled: isDevProcessing
            }),
            React.createElement('button', { className: 'primary', onClick: () => sendDevMessage(), disabled: isDevProcessing, style: { width: '100%' } },
              isDevProcessing ? 'Running...' : 'Send to Claude Code'
            )
          )
        ),

        // Main content area - switches between architecture, docs, and code view
        viewMode === 'docs' ?
          React.createElement('div', { className: 'docs-panel', style: { gridColumn: '2 / -1', gridRow: 2 } },
            React.createElement('div', { className: 'docs-toolbar' },
              React.createElement('span', { className: 'docs-toolbar-title' }, 'Project Documentation'),
              React.createElement('div', { className: 'docs-toggle' },
                React.createElement('button', {
                  className: !docsPreviewMode ? 'active' : '',
                  onClick: () => setDocsPreviewMode(false)
                }, 'Edit'),
                React.createElement('button', {
                  className: docsPreviewMode ? 'active' : '',
                  onClick: () => setDocsPreviewMode(true)
                }, 'Preview')
              ),
              React.createElement('button', {
                className: 'docs-export-btn',
                onClick: () => {
                  // Export full project spec
                  const spec = {
                    name: manualArch?.name || ir?.name || 'project',
                    documentation: projectDocs,
                    architecture: {
                      components: (manualArch?.components || ir?.components || []).map(c => ({
                        id: c.id,
                        name: c.name,
                        type: c.type,
                        spec: componentSpecs[c.id] || {}
                      })),
                      connections: manualArch?.connections || []
                    },
                    mermaid: manualArch ? null : ir // Include mermaid if generated
                  };
                  const blob = new Blob([JSON.stringify(spec, null, 2)], { type: 'application/json' });
                  const a = document.createElement('a');
                  a.href = URL.createObjectURL(blob);
                  a.download = (spec.name || 'project') + '-spec.json';
                  a.click();
                }
              }, '📤 Export Spec'),
              React.createElement('button', {
                className: 'docs-export-btn',
                onClick: () => {
                  const blob = new Blob([projectDocs], { type: 'text/markdown' });
                  const a = document.createElement('a');
                  a.href = URL.createObjectURL(blob);
                  a.download = (manualArch?.name || ir?.name || 'project') + '.md';
                  a.click();
                }
              }, '📄 Export MD')
            ),
            React.createElement('div', { className: 'docs-editor-container' },
              docsPreviewMode ?
                React.createElement('div', {
                  className: 'docs-preview',
                  dangerouslySetInnerHTML: { __html: parseMarkdown(projectDocs) }
                })
              :
                React.createElement('textarea', {
                  className: 'docs-editor',
                  value: projectDocs,
                  onChange: e => setProjectDocs(e.target.value),
                  placeholder: '# Project Title\\n\\nDescribe your project...'
                })
            )
          )
        : viewMode === 'architecture' ?
          React.createElement(React.Fragment, null,
            // Component palette (shown in builder mode)
            builderMode && !paletteCollapsed && React.createElement('div', { className: 'component-palette' },
              React.createElement('div', { className: 'panel-header', onClick: () => setPaletteCollapsed(true) },
                React.createElement('span', null, 'Components'),
                React.createElement('button', { className: 'panel-collapse-btn' }, '←')
              ),
              React.createElement('div', { className: 'palette-section', style: { overflowY: 'auto', maxHeight: 'calc(100vh - 200px)' } },
                // Group components by category
                COMPONENT_CATEGORIES.map(category =>
                  React.createElement('div', { key: category, className: 'palette-category' },
                    React.createElement('div', { className: 'palette-category-title' }, category),
                    Object.entries(COMPONENT_STYLES)
                      .filter(([, style]) => style.category === category)
                      .map(([type, style]) =>
                        React.createElement('div', {
                          key: type,
                          className: 'palette-item',
                          draggable: true,
                          onDragStart: e => e.dataTransfer.setData('componentType', type),
                          onClick: () => addComponent(type, 300 + Math.random() * 100, 200 + Math.random() * 100),
                          title: type.replace(/_/g, ' ')
                        },
                          React.createElement('div', {
                            className: 'palette-item-icon',
                            style: { background: style.bg },
                            dangerouslySetInnerHTML: { __html: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="' + style.header + '" stroke-width="2">' + style.icon.replace(/<svg[^>]*>/, '').replace('</svg>', '') + '</svg>' }
                          }),
                          React.createElement('span', { className: 'palette-item-label', style: { fontSize: 10, color: '#64748B' } }, style.label)
                        )
                      )
                  )
                )
              )
            ),
            // Canvas
            React.createElement('div', { className: 'diagram-panel' },
              // Environment Tabs
              builderMode && React.createElement('div', { className: 'env-tabs-container' },
                ['development', 'staging', 'production'].map(env =>
                  React.createElement('button', {
                    key: env,
                    className: 'env-tab' + (selectedEnv === env ? ' active' : '') + (deploying && selectedEnv === env ? ' deploying' : ''),
                    onClick: () => setSelectedEnv(env)
                  },
                    React.createElement('span', { className: 'env-tab-dot' }),
                    React.createElement('span', null, env.charAt(0).toUpperCase() + env.slice(1)),
                    selectedEnv === env && deploymentStatus === 'live' && React.createElement('span', { className: 'env-tab-status' }, 'Live')
                  )
                )
              ),
              // Show UI button (visible in focus mode)
              uiHidden && React.createElement('button', {
                className: 'show-ui-btn',
                onClick: () => setUiHidden(false)
              },
                React.createElement('iconify-icon', { icon: 'solar:sidebar-minimalistic-linear', width: 18 }),
                'Show UI'
              ),
              React.createElement(Canvas, {
                ir,
                manualArch,
                componentSpecs,
                onNodeClick: builderMode ? handleNodeClick : openNodeDetail,
                onNodeDrag: builderMode ? updateComponent : null,
                connectingFrom,
                onStartConnect: builderMode ? startConnecting : null,
                onDeleteNode: builderMode ? deleteComponent : null,
                onDeleteConnection: builderMode ? deleteConnection : null,
                builderMode,
                onAutoLayout: builderMode ? handleAutoLayout : null,
                onUndo: undo,
                onRedo: redo,
                canUndo: undoStack.length > 0,
                canRedo: redoStack.length > 0
              }),
              // Connection mode hint
              connectingFrom && React.createElement('div', { className: 'connecting-hint' },
                'Click another component to connect, or ',
                React.createElement('span', {
                  style: { textDecoration: 'underline', cursor: 'pointer' },
                  onClick: cancelConnecting
                }, 'cancel')
              )
            )
          )
        :
          React.createElement(React.Fragment, null,
            // File tree
            React.createElement('div', { className: 'file-tree-panel' },
              React.createElement('div', { className: 'panel-header', style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
                React.createElement('span', null, 'Files'),
                (sourceFiles.length > 0 || files.length > 0) && React.createElement('div', {
                  style: { display: 'flex', gap: 4, fontSize: 10, background: 'var(--bg-tertiary)', borderRadius: 4, padding: 2 }
                },
                  sourceFiles.length > 0 && React.createElement('button', {
                    onClick: () => { setFileSource('source'); setSelectedFile(null); setFileContent(''); },
                    style: {
                      padding: '2px 8px', borderRadius: 3, border: 'none', cursor: 'pointer', fontSize: 10,
                      background: fileSource === 'source' ? 'var(--accent)' : 'transparent',
                      color: fileSource === 'source' ? 'white' : 'var(--text-secondary)'
                    }
                  }, 'Source'),
                  files.length > 0 && React.createElement('button', {
                    onClick: () => { setFileSource('generated'); setSelectedFile(null); setFileContent(''); },
                    style: {
                      padding: '2px 8px', borderRadius: 3, border: 'none', cursor: 'pointer', fontSize: 10,
                      background: fileSource === 'generated' ? 'var(--accent)' : 'transparent',
                      color: fileSource === 'generated' ? 'white' : 'var(--text-secondary)'
                    }
                  }, 'Generated')
                )
              ),
              activeFiles.length === 0 ?
                (isGeneratingCode ?
                  React.createElement('div', { className: 'codegen-progress' },
                    React.createElement('h3', null, 'Generating Code...'),
                    React.createElement('div', { className: 'progress-bar' },
                      React.createElement('div', {
                        className: 'progress-fill',
                        style: { width: codeGenProgress.total ? (codeGenProgress.current / codeGenProgress.total * 100) + '%' : '0%' }
                      })
                    ),
                    React.createElement('div', { className: 'progress-text' },
                      codeGenProgress.file || 'Starting...'
                    )
                  )
                :
                  React.createElement('div', { className: 'empty-state', style: { padding: 20, textAlign: 'center' } },
                    React.createElement('iconify-icon', { icon: 'solar:code-square-linear', width: 32, style: { color: 'var(--accent)', marginBottom: 12 } }),
                    React.createElement('p', { style: { marginBottom: 16 } }, 'Generate code for your architecture'),
                    ir && React.createElement('button', {
                      className: 'primary',
                      onClick: () => generateProjectCode(),
                      disabled: isGeneratingCode,
                      style: { display: 'flex', alignItems: 'center', gap: 8, margin: '0 auto' }
                    },
                      React.createElement('iconify-icon', { icon: 'solar:magic-stick-3-linear', width: 16 }),
                      'Generate Code'
                    ),
                    !ir && React.createElement('p', { style: { fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 } },
                      'Create an architecture first using the Canvas view'
                    )
                  )
                )
              :
                React.createElement('div', { className: 'file-tree' },
                  React.createElement(FileTreeNode, { tree: fileTree, selectedFile, onSelect: loadFile, level: 0 })
                )
            ),
            // Code editor (Monaco)
            React.createElement('div', { className: 'editor-panel' },
              selectedFile ?
                React.createElement(React.Fragment, null,
                  React.createElement('div', { className: 'editor-header' },
                    React.createElement('span', { className: 'editor-filename' }, selectedFile),
                    fileSource === 'source' && React.createElement('span', {
                      style: { fontSize: 10, color: 'var(--text-secondary)', marginLeft: 'auto' }
                    }, 'read-only')
                  ),
                  React.createElement('div', { className: 'editor-container' },
                    window.monaco ?
                      React.createElement(MonacoEditorWrapper, {
                        value: fileContent,
                        language: getMonacoLanguage(selectedFile),
                        onChange: fileSource === 'generated' ? updateFileContent : null,
                        readOnly: fileSource === 'source'
                      })
                    :
                      React.createElement('textarea', {
                        className: 'code-editor',
                        value: fileContent,
                        onChange: e => updateFileContent(e.target.value),
                        spellCheck: false,
                        readOnly: fileSource === 'source'
                      })
                  )
                )
              :
                React.createElement('div', { className: 'empty-state' },
                  React.createElement('div', { className: 'empty-icon' }, '📄'),
                  React.createElement('p', null, 'Select a file to view')
                )
            )
          ),

        // Preview panel (shown when preview is running for current project)
        currentProjectId && previewSessions[currentProjectId] && previewSessions[currentProjectId].status === 'running' &&
          React.createElement('div', { className: 'editor-preview-panel' },
            React.createElement('div', { className: 'preview-header' },
              React.createElement('div', { className: 'preview-header-title' },
                React.createElement('div', { className: 'preview-dot' }),
                'Preview Running'
              ),
              React.createElement('button', {
                className: 'preview-stop-btn',
                onClick: () => stopLocalPreview(currentProjectId)
              }, 'Stop')
            ),
            React.createElement('div', { className: 'preview-service-list' },
              (previewSessions[currentProjectId].services || []).map((svc, i) =>
                React.createElement('div', { key: i, className: 'preview-service-item' },
                  React.createElement('span', { className: 'preview-service-name' }, svc.name),
                  svc.url && React.createElement('span', { className: 'preview-service-url' },
                    React.createElement('a', { href: svc.url, target: '_blank' }, 'localhost:' + svc.port)
                  )
                )
              )
            ),
            previewSessions[currentProjectId].error && React.createElement('div', { className: 'preview-error', style: { maxHeight: 60, overflow: 'hidden', textOverflow: 'ellipsis' } },
              previewSessions[currentProjectId].error.split('\\n')[0].slice(0, 100)
            )
          ),

        !costCollapsed && viewMode !== 'docs' && React.createElement('div', { className: 'cost-panel' },
          React.createElement('div', { className: 'panel-header', onClick: () => setCostCollapsed(true) },
            React.createElement('span', null, 'Cost Breakdown'),
            React.createElement('button', { className: 'panel-collapse-btn' }, '→')
          ),
          React.createElement('div', { className: 'cost-content' },
            cost ?
              React.createElement(React.Fragment, null,
                React.createElement('div', { className: 'cost-total' },
                  React.createElement('div', { className: 'cost-amount' }, cost.formatted.replace('/month', '')),
                  React.createElement('div', { className: 'cost-period' }, 'per month')
                ),
                React.createElement('div', { className: 'cost-section' },
                  React.createElement('div', { className: 'cost-section-title' }, 'Components'),
                  cost.breakdown.map((item, i) =>
                    React.createElement('div', { className: 'cost-item', key: i },
                      React.createElement('div', { className: 'cost-item-header' },
                        React.createElement('div', { className: 'cost-item-name' },
                          React.createElement('span', {
                            className: 'cost-item-icon',
                            dangerouslySetInnerHTML: {
                              __html: SVG_ICONS[item.type]
                                ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="' + (COLORS[item.type] || '#666') + '" stroke-width="2">' + SVG_ICONS[item.type].replace(/<svg[^>]*>/, '').replace('</svg>', '') + '</svg>'
                                : ICONS[item.type] || '📦'
                            }
                          }),
                          item.name
                        ),
                        React.createElement('div', { className: 'cost-item-price' }, item.cost)
                      ),
                      React.createElement('div', { className: 'cost-item-detail' },
                        item.specs || (
                          item.type === 'service' ? '1 shared vCPU, 512MB RAM' :
                          item.type === 'database' ? 'Dev: 512MB RAM, 10GB storage' :
                          item.type === 'static_site' ? 'CDN hosted, unlimited bandwidth' :
                          item.type === 'worker' ? '1 shared vCPU, 512MB RAM' :
                          item.type === 'job' ? 'Billed per execution' : ''
                        )
                      )
                    )
                  )
                ),
                // AI Suggestions section
                suggestions.length > 0 && React.createElement('div', { className: 'suggestions-panel', style: { margin: '16px 0', border: '1px solid var(--border-color)' } },
                  React.createElement('div', { className: 'suggestions-header' },
                    React.createElement('iconify-icon', { icon: 'solar:magic-stick-3-linear', width: 14 }),
                    'AI Suggestions'
                  ),
                  suggestions.map((s, i) => {
                    const typeIcons = {
                      performance: 'solar:bolt-linear',
                      scalability: 'solar:chart-2-linear',
                      reliability: 'solar:shield-check-linear',
                      security: 'solar:lock-linear',
                      observability: 'solar:eye-linear',
                      architecture: 'solar:diagram-up-linear'
                    };
                    return React.createElement('div', {
                      key: s.id || i,
                      className: 'suggestion-card',
                      onClick: () => {
                        if (s.action) {
                          setInput(s.action);
                        }
                      }
                    },
                      React.createElement('div', { className: 'suggestion-type ' + s.type },
                        React.createElement('iconify-icon', { icon: typeIcons[s.type] || 'solar:lightbulb-linear', width: 10 }),
                        s.type
                      ),
                      React.createElement('div', { className: 'suggestion-title' }, s.title),
                      React.createElement('div', { className: 'suggestion-description' }, s.description),
                      s.action && React.createElement('div', { className: 'suggestion-action' },
                        React.createElement('iconify-icon', { icon: 'solar:arrow-right-linear', width: 12 }),
                        'Click to add'
                      )
                    );
                  })
                ),
                React.createElement('div', { className: 'pricing-tips' },
                  React.createElement('h4', null, '💡 Tips'),
                  React.createElement('ul', null,
                    React.createElement('li', null, 'Static sites are free'),
                    React.createElement('li', null, 'Dev databases: $7/mo'),
                    React.createElement('li', null, 'Basic services: $5/mo')
                  )
                )
              )
            : React.createElement('div', { className: 'empty-state', style: { padding: 30 } },
                React.createElement('p', null, 'Cost will appear here')
              )
          )
        ),

        // Component Detail Panel Overlay
        React.createElement('div', {
          className: 'detail-panel-overlay' + (selectedNode ? ' open' : ''),
          onClick: closeNodeDetail
        }),
        // Component Detail Panel - Railway-style slide-out with tabs
        React.createElement('div', { className: 'detail-panel' + (selectedNode ? ' open' : '') },
          selectedNode && React.createElement(React.Fragment, null,
            React.createElement('div', { className: 'detail-header' },
              React.createElement('div', {
                className: 'detail-header-icon',
                style: { background: (COMPONENT_STYLES[selectedNode.type]?.header || '#666') + '20', color: COMPONENT_STYLES[selectedNode.type]?.header || '#666' }
              },
                React.createElement('iconify-icon', { icon: COMPONENT_STYLES[selectedNode.type]?.iconify || 'solar:box-linear', width: 20 })
              ),
              React.createElement('div', { className: 'detail-header-info' },
                React.createElement('h3', null, selectedNode.name),
                React.createElement('span', null, (selectedNode.type || '').replace('_', ' '))
              ),
              React.createElement('button', { className: 'detail-close', onClick: closeNodeDetail }, '×')
            ),
            // Tabs
            React.createElement('div', { className: 'detail-tabs' },
              React.createElement('button', {
                className: 'detail-tab' + (detailTab === 'config' ? ' active' : ''),
                onClick: () => setDetailTab('config')
              }, 'Config'),
              React.createElement('button', {
                className: 'detail-tab' + (detailTab === 'code' ? ' active' : ''),
                onClick: () => setDetailTab('code')
              }, 'Code'),
              React.createElement('button', {
                className: 'detail-tab' + (detailTab === 'logs' ? ' active' : ''),
                onClick: () => setDetailTab('logs')
              }, 'Logs'),
              React.createElement('button', {
                className: 'detail-tab' + (detailTab === 'cost' ? ' active' : ''),
                onClick: () => setDetailTab('cost')
              }, 'Cost')
            ),
            // Tab Content - Config
            detailTab === 'config' && React.createElement('div', { className: 'detail-content' },
              React.createElement('div', { className: 'spec-section' },
                React.createElement('div', { className: 'spec-label' },
                  React.createElement('span', { className: 'spec-label-icon' }, '📋'),
                  'Description'
                ),
                React.createElement('textarea', {
                  className: 'spec-textarea',
                  value: getSpec('description'),
                  onChange: e => updateSpec('description', e.target.value),
                  placeholder: 'What does this component do? Describe its purpose and responsibilities...'
                }),
                React.createElement('div', { className: 'spec-hint' }, 'Define the core functionality and behavior of this component')
              ),
              React.createElement('div', { className: 'spec-divider' }),
              React.createElement('div', { className: 'spec-section' },
                React.createElement('div', { className: 'spec-label' },
                  React.createElement('span', { className: 'spec-label-icon' }, '📥'),
                  'Input Contract'
                ),
                React.createElement('div', { className: 'io-section' },
                  React.createElement('div', { className: 'io-header' },
                    '→ Receives'
                  ),
                  React.createElement('div', { className: 'io-content' },
                    React.createElement('textarea', {
                      value: getSpec('inputs'),
                      onChange: e => updateSpec('inputs', e.target.value),
                      placeholder: 'HTTP requests, events, data format...\\nExample: POST /api/users { name, email }'
                    })
                  )
                ),
                React.createElement('div', { className: 'spec-hint' }, 'What data or requests does this component accept?')
              ),
              React.createElement('div', { className: 'spec-section' },
                React.createElement('div', { className: 'spec-label' },
                  React.createElement('span', { className: 'spec-label-icon' }, '📤'),
                  'Output Contract'
                ),
                React.createElement('div', { className: 'io-section' },
                  React.createElement('div', { className: 'io-header' },
                    '← Produces'
                  ),
                  React.createElement('div', { className: 'io-content' },
                    React.createElement('textarea', {
                      value: getSpec('outputs'),
                      onChange: e => updateSpec('outputs', e.target.value),
                      placeholder: 'API responses, events, data written...\\nExample: { id, name, email, createdAt }'
                    })
                  )
                ),
                React.createElement('div', { className: 'spec-hint' }, 'What does this component return or emit?')
              ),
              React.createElement('div', { className: 'spec-divider' }),
              React.createElement('div', { className: 'spec-section' },
                React.createElement('div', { className: 'spec-label' },
                  React.createElement('span', { className: 'spec-label-icon' }, '📝'),
                  'Implementation Notes'
                ),
                React.createElement('textarea', {
                  className: 'spec-textarea',
                  value: getSpec('notes'),
                  onChange: e => updateSpec('notes', e.target.value),
                  placeholder: 'Libraries to use, edge cases, performance considerations, security requirements...'
                }),
                React.createElement('div', { className: 'spec-hint' }, 'Additional context for whoever implements this component')
              ),
              React.createElement('div', { className: 'spec-divider' }),
              // Inner Components Section (like eraser.io)
              React.createElement('div', { className: 'spec-section' },
                React.createElement('div', { className: 'spec-label' },
                  React.createElement('span', { className: 'spec-label-icon' }, '🧩'),
                  'Inner Components'
                ),
                React.createElement('div', { className: 'inner-components-list' },
                  (getSpec('innerComponents') || []).map((item, i) =>
                    React.createElement('div', { key: i, className: 'inner-component-item' },
                      React.createElement('input', {
                        type: 'text',
                        value: item.name,
                        onChange: e => {
                          const items = [...(getSpec('innerComponents') || [])];
                          items[i] = { ...items[i], name: e.target.value };
                          updateSpec('innerComponents', items);
                        },
                        placeholder: 'Component name'
                      }),
                      React.createElement('input', {
                        type: 'text',
                        value: item.description || '',
                        onChange: e => {
                          const items = [...(getSpec('innerComponents') || [])];
                          items[i] = { ...items[i], description: e.target.value };
                          updateSpec('innerComponents', items);
                        },
                        placeholder: 'Brief description',
                        style: { flex: 2 }
                      }),
                      React.createElement('button', {
                        className: 'remove-inner-btn',
                        onClick: () => {
                          const items = (getSpec('innerComponents') || []).filter((_, idx) => idx !== i);
                          updateSpec('innerComponents', items);
                        }
                      }, '×')
                    )
                  ),
                  React.createElement('button', {
                    className: 'add-inner-btn',
                    onClick: () => {
                      const items = getSpec('innerComponents') || [];
                      updateSpec('innerComponents', [...items, { name: '', description: '' }]);
                    }
                  },
                    React.createElement('iconify-icon', { icon: 'solar:add-circle-linear', width: 14 }),
                    'Add Inner Component'
                  )
                ),
                React.createElement('div', { className: 'spec-hint' }, 'Sub-components, adapters, or modules within this service')
              ),
              React.createElement('div', { className: 'spec-divider' }),
              // Markdown Documentation Section
              React.createElement('div', { className: 'spec-section' },
                React.createElement('div', { className: 'spec-label', style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
                  React.createElement('span', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
                    React.createElement('span', { className: 'spec-label-icon' }, '📄'),
                    'Component Documentation'
                  ),
                  React.createElement('button', {
                    className: 'generate-docs-btn',
                    onClick: () => {
                      const spec = componentSpecs[selectedNode.id] || {};
                      const codeBlock = String.fromCharCode(96, 96, 96);
                      const md = '# ' + selectedNode.name + '\\n\\n' +
                        '**Type:** ' + (selectedNode.type || 'service').replace('_', ' ') + '\\n\\n' +
                        '## Overview\\n\\n' + (spec.description || '_No description provided_') + '\\n\\n' +
                        '## Input Contract\\n\\n' + codeBlock + '\\n' + (spec.inputs || 'No inputs defined') + '\\n' + codeBlock + '\\n\\n' +
                        '## Output Contract\\n\\n' + codeBlock + '\\n' + (spec.outputs || 'No outputs defined') + '\\n' + codeBlock + '\\n\\n' +
                        (spec.innerComponents && spec.innerComponents.length > 0 ?
                          '## Internal Components\\n\\n' + spec.innerComponents.map(c => '- **' + c.name + '**: ' + (c.description || '')).join('\\n') + '\\n\\n' : '') +
                        '## Implementation Notes\\n\\n' + (spec.notes || '_No implementation notes_') + '\\n';
                      updateSpec('markdown', md);
                    }
                  }, 'Generate from spec')
                ),
                React.createElement('textarea', {
                  className: 'spec-textarea markdown-editor',
                  value: getSpec('markdown') || '',
                  onChange: e => updateSpec('markdown', e.target.value),
                  placeholder: '# Component Name\\n\\nDescribe this component in detail...\\n\\n## API\\n\\n## Examples',
                  style: { minHeight: 200, fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }
                }),
                React.createElement('div', { className: 'spec-hint' }, 'Markdown documentation for agent-based code generation')
              )
            ),
            // Tab Content - Code
            detailTab === 'code' && React.createElement('div', { className: 'detail-content' },
              React.createElement('div', { className: 'spec-section' },
                React.createElement('div', { className: 'spec-label' },
                  React.createElement('iconify-icon', { icon: 'solar:code-linear', width: 14, className: 'spec-label-icon' }),
                  'Generated Code Preview'
                ),
                React.createElement('div', {
                  style: {
                    background: '#0a0a0a',
                    borderRadius: 8,
                    padding: 16,
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 12,
                    color: '#a3a3a3',
                    minHeight: 200,
                    border: '1px solid var(--border-color)'
                  }
                },
                  React.createElement('div', { style: { color: '#525252', marginBottom: 12 } }, '// ' + selectedNode.name + ' component'),
                  React.createElement('div', { style: { color: '#8B5CF6' } }, 'export ', React.createElement('span', { style: { color: '#22C55E' } }, 'function '), React.createElement('span', { style: { color: '#60A5FA' } }, selectedNode.name.replace(/\\s+/g, '')), '() {'),
                  React.createElement('div', { style: { paddingLeft: 16 } }, React.createElement('span', { style: { color: '#525252' } }, '// Implementation here')),
                  React.createElement('div', null, '}')
                ),
                React.createElement('div', { className: 'spec-hint', style: { marginTop: 12 } }, 'Code preview will be generated based on component configuration')
              ),
              React.createElement('button', {
                className: 'primary',
                style: { width: '100%', marginTop: 16 },
                onClick: generateCode,
                disabled: isGeneratingCode
              },
                React.createElement('iconify-icon', { icon: 'solar:code-square-linear', width: 16, style: { marginRight: 8 } }),
                'Generate Full Code'
              )
            ),
            // Tab Content - Logs
            detailTab === 'logs' && React.createElement('div', { className: 'detail-content' },
              React.createElement('div', { className: 'spec-section' },
                React.createElement('div', { className: 'spec-label' },
                  React.createElement('iconify-icon', { icon: 'solar:document-text-linear', width: 14, className: 'spec-label-icon' }),
                  'Deployment Logs'
                ),
                React.createElement('div', {
                  style: {
                    background: '#0a0a0a',
                    borderRadius: 8,
                    padding: 16,
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 11,
                    color: '#525252',
                    minHeight: 300,
                    border: '1px solid var(--border-color)'
                  }
                },
                  deploying ? deploymentLogs.map((log, i) =>
                    React.createElement('div', {
                      key: i,
                      style: { marginBottom: 4, color: log.includes('Error') ? '#EF4444' : log.includes('✓') ? '#22C55E' : '#737373' }
                    }, log)
                  ) : React.createElement('div', { style: { textAlign: 'center', color: '#404040', padding: 40 } },
                    React.createElement('iconify-icon', { icon: 'solar:document-text-linear', width: 32, style: { marginBottom: 8, display: 'block', opacity: 0.3 } }),
                    'No deployment logs yet'
                  )
                )
              )
            ),
            // Tab Content - Cost
            detailTab === 'cost' && React.createElement('div', { className: 'detail-content' },
              React.createElement('div', { className: 'spec-section' },
                React.createElement('div', { className: 'spec-label' },
                  React.createElement('iconify-icon', { icon: 'solar:wallet-linear', width: 14, className: 'spec-label-icon' }),
                  'Component Cost Breakdown'
                ),
                React.createElement('div', { className: 'cost-total', style: { marginTop: 12 } },
                  React.createElement('div', { className: 'cost-amount' }, '$' + (
                    selectedNode.type === 'database' ? '7' :
                    selectedNode.type === 'static_site' ? '0' :
                    selectedNode.type === 'cache' ? '15' :
                    '5'
                  )),
                  React.createElement('div', { className: 'cost-period' }, '/month estimated')
                ),
                React.createElement('div', { style: { marginTop: 16 } },
                  React.createElement('div', { className: 'cost-item' },
                    React.createElement('div', { className: 'cost-item-header' },
                      React.createElement('span', { className: 'cost-item-name' }, 'Compute'),
                      React.createElement('span', { className: 'cost-item-price' }, selectedNode.type === 'static_site' ? 'Free' : '$5/mo')
                    ),
                    React.createElement('div', { className: 'cost-item-detail' }, 'Basic tier • 512MB RAM')
                  ),
                  selectedNode.type === 'database' && React.createElement('div', { className: 'cost-item' },
                    React.createElement('div', { className: 'cost-item-header' },
                      React.createElement('span', { className: 'cost-item-name' }, 'Storage'),
                      React.createElement('span', { className: 'cost-item-price' }, '$2/mo')
                    ),
                    React.createElement('div', { className: 'cost-item-detail' }, '10GB SSD storage')
                  )
                ),
                React.createElement('div', { className: 'spec-hint', style: { marginTop: 16 } },
                  'Costs are estimates based on DigitalOcean App Platform pricing'
                )
              )
            ),
            // Footer
            React.createElement('div', { className: 'detail-footer' },
              React.createElement('button', {
                onClick: () => {
                  // Export component markdown
                  const spec = componentSpecs[selectedNode.id] || {};
                  if (spec.markdown) {
                    const blob = new Blob([spec.markdown], { type: 'text/markdown' });
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    a.download = selectedNode.name.toLowerCase().replace(/\\s+/g, '-') + '.md';
                    a.click();
                  }
                },
                disabled: !getSpec('markdown')
              }, 'Export MD'),
              React.createElement('button', { onClick: closeNodeDetail }, 'Done')
            )
          )
        ),

        showModal && React.createElement('div', { className: 'modal-overlay active', onClick: e => e.target.className.includes('overlay') && setShowModal(false) },
          React.createElement('div', { className: 'modal' },
            React.createElement('div', { className: 'modal-header' },
              React.createElement('h2', null, 'Export AppSpec'),
              React.createElement('button', { className: 'modal-close', onClick: () => setShowModal(false) }, '×')
            ),
            React.createElement('div', { className: 'modal-content' },
              React.createElement('pre', { className: 'yaml-output' }, yaml)
            ),
            React.createElement('div', { className: 'modal-footer' },
              React.createElement('button', { onClick: () => navigator.clipboard.writeText(yaml).then(() => alert('Copied!')) }, 'Copy YAML'),
              hasAnySpecs && React.createElement('button', { onClick: downloadDesign }, 'Download Design'),
              React.createElement('button', { className: 'primary', onClick: download }, 'Download YAML')
            )
          )
        ),

        // Deploy Modal
        showDeployModal && React.createElement('div', { className: 'deploy-modal', onClick: e => e.target.className === 'deploy-modal' && !deploying && setShowDeployModal(false) },
          React.createElement('div', { className: 'deploy-modal-content' },
            React.createElement('div', { className: 'deploy-modal-header' },
              React.createElement('div', null,
                React.createElement('h2', null, 'Deploy Application'),
                React.createElement('p', null, 'Review your configuration before pushing to production.')
              ),
              !deploying && React.createElement('button', { className: 'modal-close', onClick: () => setShowDeployModal(false) },
                React.createElement('iconify-icon', { icon: 'solar:close-circle-linear', width: 20 })
              )
            ),
            React.createElement('div', { className: 'deploy-modal-body' },
              !deploying && !deploymentStatus ? React.createElement(React.Fragment, null,
                React.createElement('div', { className: 'deploy-env-grid' },
                  ['development', 'staging', 'production'].map(env =>
                    React.createElement('div', {
                      key: env,
                      className: 'deploy-env-btn' + (selectedEnv === env ? ' active' : ''),
                      onClick: () => setSelectedEnv(env)
                    },
                      React.createElement('div', { className: 'deploy-env-name' },
                        env.charAt(0).toUpperCase() + env.slice(1)
                      )
                    )
                  )
                ),
                React.createElement('div', { className: 'deploy-summary' },
                  React.createElement('div', { className: 'deploy-summary-row' },
                    React.createElement('span', { className: 'deploy-summary-label' }, 'Total Resources'),
                    React.createElement('span', { className: 'deploy-summary-value' }, (manualArch?.components?.length || ir?.components?.length || 0) + ' Components')
                  ),
                  React.createElement('div', { className: 'deploy-summary-row' },
                    React.createElement('span', { className: 'deploy-summary-label' }, 'Est. Monthly Cost'),
                    React.createElement('span', { className: 'deploy-summary-value' }, cost ? cost.formatted : '$0.00')
                  ),
                  React.createElement('div', { className: 'deploy-summary-divider' }),
                  React.createElement('div', { className: 'deploy-summary-note' },
                    React.createElement('div', { className: 'deploy-summary-note-icon' },
                      React.createElement('iconify-icon', { icon: 'solar:check-read-linear', width: 12 })
                    ),
                    React.createElement('p', { className: 'deploy-summary-note-text' },
                      'Zero-downtime deployment using blue/green strategy. All resources will be provisioned to your selected environment.'
                    )
                  )
                )
              ) : React.createElement(React.Fragment, null,
                // Progress steps
                React.createElement('div', { className: 'deploy-progress' },
                  ['pending', 'building', 'deploying', 'live'].map((step, idx) => {
                    const statusOrder = { pending: 0, building: 1, deploying: 2, live: 3, failed: -1, cancelled: -1 };
                    const currentIdx = statusOrder[deploymentStatus] || 0;
                    const isCompleted = currentIdx > idx;
                    const isActive = deploymentStatus === step;
                    const isFailed = (deploymentStatus === 'failed' || deploymentStatus === 'cancelled') && currentIdx === idx;
                    return React.createElement('div', { key: step, className: 'deploy-step' },
                      React.createElement('div', {
                        className: 'deploy-step-dot' +
                          (isCompleted ? ' completed' : '') +
                          (isActive ? ' active' : '') +
                          (isFailed ? ' failed' : '')
                      }, isCompleted ? '✓' : isFailed ? '×' : idx + 1),
                      React.createElement('span', {
                        className: 'deploy-step-label' + (isActive ? ' active' : '')
                      }, step.charAt(0).toUpperCase() + step.slice(1))
                    );
                  })
                ),
                React.createElement('div', { className: 'deploy-status' },
                  React.createElement('div', {
                    className: 'deploy-status-icon' +
                      (['pending', 'building', 'deploying', 'starting'].includes(deploymentStatus) ? ' spinning' : '')
                  },
                    deploymentStatus === 'live' ? '✅' :
                    deploymentStatus === 'failed' ? '❌' :
                    deploymentStatus === 'cancelled' ? '⛔' :
                    '⚙️'
                  ),
                  React.createElement('div', { className: 'deploy-status-text' },
                    React.createElement('h3', null,
                      deploymentStatus === 'live' ? 'Deployment Successful!' :
                      deploymentStatus === 'failed' ? 'Deployment Failed' :
                      deploymentStatus === 'cancelled' ? 'Deployment Cancelled' :
                      deploymentStatus === 'pending' ? 'Queued...' :
                      deploymentStatus === 'building' ? 'Building...' :
                      deploymentStatus === 'deploying' ? 'Deploying...' :
                      'Starting...'
                    ),
                    React.createElement('p', null,
                      deploymentStatus === 'live' ? 'Your app is now live' :
                      deploymentStatus === 'failed' ? 'Check the logs below' :
                      deploymentStatus === 'cancelled' ? 'The deployment was cancelled' :
                      deploymentStatus === 'pending' ? 'Waiting in queue...' :
                      deploymentStatus === 'building' ? 'Compiling your application...' :
                      deploymentStatus === 'deploying' ? 'Spinning up resources...' :
                      'Initializing deployment...'
                    )
                  )
                ),
                React.createElement('div', { className: 'deploy-logs' },
                  deploymentLogs.map((log, i) =>
                    React.createElement('div', {
                      key: i,
                      className: 'deploy-log-line' + (log.includes('Error') ? ' error' : log.includes('complete') || log.includes('✓') ? ' success' : '')
                    }, log)
                  )
                ),
                deploymentStatus === 'live' && deploymentUrl && React.createElement(React.Fragment, null,
                  // Confetti celebration
                  React.createElement('div', { className: 'confetti-container' },
                    [...Array(50)].map((_, i) =>
                      React.createElement('div', {
                        key: i,
                        className: 'confetti',
                        style: {
                          left: Math.random() * 100 + '%',
                          background: ['#6366F1', '#8B5CF6', '#22C55E', '#F59E0B', '#EC4899'][Math.floor(Math.random() * 5)],
                          animationDelay: Math.random() * 2 + 's',
                          borderRadius: Math.random() > 0.5 ? '50%' : '0'
                        }
                      })
                    )
                  ),
                  React.createElement('div', { className: 'deploy-url deploy-success-celebration' },
                    React.createElement('div', null,
                      React.createElement('span', { style: { fontSize: 12, color: 'var(--text-secondary)' } }, 'Your app is live at:'),
                      React.createElement('a', { href: deploymentUrl, target: '_blank', style: { display: 'block', marginTop: 4 } }, deploymentUrl)
                    ),
                    React.createElement('div', { className: 'deploy-url-actions' },
                      React.createElement('button', {
                        className: 'deploy-url-btn',
                        onClick: () => { navigator.clipboard.writeText(deploymentUrl); }
                      },
                        React.createElement('iconify-icon', { icon: 'solar:copy-linear', width: 14 }),
                        'Copy'
                      ),
                      React.createElement('button', {
                        className: 'deploy-url-btn',
                        onClick: () => window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent('Just deployed my app with Brick! 🚀 ' + deploymentUrl), '_blank')
                      },
                        React.createElement('iconify-icon', { icon: 'ri:twitter-x-fill', width: 14 }),
                        'Share'
                      )
                    )
                  )
                ),
                (deploymentStatus === 'live' || deploymentStatus === 'failed' || deploymentStatus === 'cancelled') &&
                  React.createElement('button', {
                    style: { width: '100%', marginTop: 16, background: 'white', color: 'black', fontWeight: 600 },
                    onClick: () => { setShowDeployModal(false); setDeploymentStatus(null); setDeploymentLogs([]); setDeploymentUrl(null); }
                  }, 'Done')
              )
            ),
            !deploying && !deploymentStatus && React.createElement('div', { className: 'deploy-modal-footer' },
              React.createElement('button', { className: 'deploy-cancel-btn', onClick: () => setShowDeployModal(false) }, 'Cancel'),
              React.createElement('button', {
                className: 'deploy-submit-btn',
                onClick: () => deployProject(selectedEnv)
              },
                React.createElement('span', null, 'Deploy Now'),
                React.createElement('iconify-icon', { icon: 'solar:rocket-linear' })
              )
            )
          )
        ),

        // Command Palette
        React.createElement(CommandPalette, {
          isOpen: showCommandPalette,
          onClose: () => setShowCommandPalette(false),
          onCommand: handleCommandPaletteCommand
        })
      );
    }

    ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));
  </script>
</body>
</html>`;
}
