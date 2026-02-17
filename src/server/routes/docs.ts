/**
 * Docs routes — documentation generation, retrieval, and manual editing
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { resolveSession } from '../state/resolveSession.js';

const router = Router();

// GET /api/docs — get current documentation
router.get('/docs', (req: Request, res: Response) => {
  try {
    const session = resolveSession(req);
    res.json({ documentation: session.currentDocs || '' });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// POST /api/docs/generate — generate docs from architecture
router.post('/docs/generate', async (req: Request, res: Response) => {
  try {
    const session = resolveSession(req);
    const architecture = session.manualArchitecture;
    const componentSpecs = session.currentProject.componentSpecs;
    const bac = session.currentBAC;

    // Try to use the DocsAgent if possible
    let documentation = '';
    try {
      const { DocsAgent } = await import('../../agent/docs-agent.js');
      const agent = new DocsAgent();

      const projectContext = {
        project: {
          id: session.currentProjectId || 'unknown',
          name: architecture?.name || 'Untitled Project',
          slug: (architecture?.name || 'untitled').toLowerCase().replace(/\s+/g, '-'),
          architecture: {
            components: (architecture?.components || []).map(c => ({
              ...c,
              spec: componentSpecs[c.id],
            })),
            connections: architecture?.connections || [],
          },
        },
        files: [],
        conversationHistory: [],
        userPreferences: {},
        bac: bac || undefined,
        systemContext: session.currentDocs || undefined,
      };

      const result = await agent.execute(
        projectContext,
        'Generate comprehensive project documentation.'
      );

      // Extract the docs content from the agent result
      const fileAction = result.actions?.find(
        a => a.type === 'create_file' && a.payload?.path === 'README.md'
      );
      if (fileAction && typeof fileAction.payload?.content === 'string') {
        documentation = fileAction.payload.content;
      } else if (result.response) {
        documentation = result.response;
      }
    } catch {
      // Fallback: generate a basic markdown template from the architecture
      documentation = generateBasicDocs(
        architecture?.name || 'Untitled Project',
        architecture?.components || [],
        architecture?.connections || [],
        componentSpecs
      );
    }

    // If we still have no docs (e.g. no architecture), generate a stub
    if (!documentation) {
      documentation = generateBasicDocs(
        architecture?.name || 'Untitled Project',
        architecture?.components || [],
        architecture?.connections || [],
        componentSpecs
      );
    }

    session.currentDocs = documentation;
    res.json({ documentation });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// PUT /api/docs — manual doc edit
router.put('/docs', (req: Request, res: Response) => {
  try {
    const session = resolveSession(req);
    const { documentation } = req.body;

    if (typeof documentation !== 'string') {
      res.status(400).json({ error: 'documentation must be a string' });
      return;
    }

    session.currentDocs = documentation;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * Generate a basic markdown document from the architecture when the
 * DocsAgent is not available or fails.
 */
function generateBasicDocs(
  name: string,
  components: Array<{ id: string; name: string; type: string }>,
  connections: Array<{ from: string; to: string; label?: string }>,
  componentSpecs: Record<string, { description?: string; inputs?: string; outputs?: string; notes?: string }>
): string {
  const lines: string[] = [];

  lines.push(`# ${name}`);
  lines.push('');

  // Overview
  lines.push('## Architecture Overview');
  lines.push('');
  if (components.length === 0) {
    lines.push('No components have been defined yet.');
  } else {
    lines.push(`This project consists of **${components.length}** component${components.length !== 1 ? 's' : ''} and **${connections.length}** connection${connections.length !== 1 ? 's' : ''}.`);
    lines.push('');

    // Summarize by type
    const byType: Record<string, string[]> = {};
    for (const c of components) {
      const t = c.type.replace(/_/g, ' ');
      if (!byType[t]) byType[t] = [];
      byType[t].push(c.name);
    }
    for (const [type, names] of Object.entries(byType)) {
      lines.push(`- **${type}**: ${names.join(', ')}`);
    }
  }
  lines.push('');

  // Components
  if (components.length > 0) {
    lines.push('## Components');
    lines.push('');
    for (const comp of components) {
      const spec = componentSpecs[comp.id];
      lines.push(`### ${comp.name}`);
      lines.push('');
      lines.push(`- **Type:** ${comp.type.replace(/_/g, ' ')}`);
      if (spec?.description) {
        lines.push(`- **Description:** ${spec.description}`);
      }
      if (spec?.inputs) {
        lines.push(`- **Inputs:** ${spec.inputs}`);
      }
      if (spec?.outputs) {
        lines.push(`- **Outputs:** ${spec.outputs}`);
      }
      if (spec?.notes) {
        lines.push(`- **Notes:** ${spec.notes}`);
      }
      lines.push('');
    }
  }

  // Connections
  if (connections.length > 0) {
    lines.push('## Connections');
    lines.push('');
    const nameMap = new Map(components.map(c => [c.id, c.name]));
    for (const conn of connections) {
      const fromName = nameMap.get(conn.from) || conn.from;
      const toName = nameMap.get(conn.to) || conn.to;
      const label = conn.label ? ` -- ${conn.label}` : '';
      lines.push(`- **${fromName}** &rarr; **${toName}**${label}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

export default router;
