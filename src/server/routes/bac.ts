/**
 * BAC routes — Brick App Contract CRUD + generation from intent
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import type { ComponentType } from '../state/ProjectSession.js';
import type { BrickAppContract, BACPatch } from '../../types/bac.js';
import type { ChatMessage } from '../../llm/index.js';
import { validateBrickAppContract, validateContractCompleteness, bacToArchitecture } from '../../bac/index.js';
import { getLLMConfig } from '../../llm/config.js';
import { INTENT_TO_BAC_PROMPT } from '../../codegen/index.js';
import { resolveSession } from '../state/resolveSession.js';
import { syncSessionToDb } from '../services/session-sync.js';

const router = Router();

// GET /api/bac
router.get('/', (req: Request, res: Response) => {
  const session = resolveSession(req);
  session.refreshBACFromCurrentArchitecture();

  if (!session.currentBAC) {
    res.json({ bac: null, validation: { valid: false, errors: ['No architecture available'] } });
    return;
  }

  const validation = validateBrickAppContract(session.currentBAC);
  res.json({ bac: session.currentBAC, validation });
});

// PUT /api/bac — replace BAC and sync back to graph
router.put('/', (req: Request, res: Response) => {
  try {
    const session = resolveSession(req);
    const { bac } = req.body as { bac: BrickAppContract };

    if (!bac) {
      res.status(400).json({ error: 'Missing bac payload' });
      return;
    }

    const validation = validateBrickAppContract(bac);
    if (!validation.valid) {
      res.status(400).json({ error: 'Invalid BAC payload', validation });
      return;
    }

    session.currentBAC = bac;

    const projected = bacToArchitecture(bac);
    if (session.manualArchitecture) {
      session.manualArchitecture.components = projected.components.map(c => ({
        id: c.id,
        name: c.name,
        type: c.type as ComponentType,
        x: c.x ?? session.manualArchitecture!.components.find(mc => mc.id === c.id)?.x ?? 100,
        y: c.y ?? session.manualArchitecture!.components.find(mc => mc.id === c.id)?.y ?? 100,
      }));
      session.manualArchitecture.connections = projected.connections.map(c => ({
        from: c.from,
        to: c.to,
        label: c.label,
        contract: c.contract,
      }));
      for (const comp of projected.components) {
        if (comp.spec) {
          session.currentProject.componentSpecs[comp.id] = comp.spec;
        }
      }
    }

    const completeness = validateContractCompleteness(bac);
    syncSessionToDb(session).catch(() => {});
    res.json({ bac: session.currentBAC, validation, completeness, architecture: session.manualArchitecture });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// PATCH /api/bac — structured patch operations
router.patch('/', (req: Request, res: Response) => {
  try {
    const session = resolveSession(req);
    const { patches } = req.body as { patches: BACPatch[] };

    if (!session.currentBAC) {
      res.status(400).json({ error: 'No BAC exists to patch' });
      return;
    }

    if (!patches || !Array.isArray(patches)) {
      res.status(400).json({ error: 'Missing patches array' });
      return;
    }

    const { bac: patched, architecture, completeness } = session.applyBacPatchesAndSync(patches);
    const validation = validateBrickAppContract(patched);
    syncSessionToDb(session).catch(() => {});
    res.json({ bac: patched, validation, completeness, architecture });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// POST /api/bac/from-intent — generate BAC from natural language
router.post('/from-intent', async (req: Request, res: Response) => {
  try {
    const session = resolveSession(req);
    const { intent } = req.body as { intent: string };

    if (!intent || typeof intent !== 'string') {
      res.status(400).json({ error: 'Missing intent string' });
      return;
    }

    const config = getLLMConfig();
    const messages: ChatMessage[] = [
      { role: 'user', content: `Build an application: ${intent}` }
    ];

    const { chat } = await import('../../llm/client.js');
    const response = await chat(INTENT_TO_BAC_PROMPT, messages, config);

    let jsonStr = response.content.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
    }

    const bac = JSON.parse(jsonStr) as BrickAppContract;
    const validation = validateBrickAppContract(bac);

    if (validation.valid) {
      session.currentBAC = bac;

      const projected = bacToArchitecture(bac);
      session.manualArchitecture = {
        name: bac.metadata.name || 'brick-app',
        components: projected.components.map((c, i) => ({
          id: c.id,
          name: c.name,
          type: c.type as ComponentType,
          x: c.x ?? 150 + (i % 3) * 250,
          y: c.y ?? 100 + Math.floor(i / 3) * 150,
        })),
        connections: projected.connections.map(c => ({
          from: c.from,
          to: c.to,
          label: c.label,
          contract: c.contract,
        })),
      };

      for (const comp of projected.components) {
        if (comp.spec) {
          session.currentProject.componentSpecs[comp.id] = comp.spec;
        }
      }

      const completeness = validateContractCompleteness(bac);
      syncSessionToDb(session).catch(() => {});
      res.json({ bac, validation, completeness, architecture: session.manualArchitecture });
    } else {
      res.status(400).json({ error: 'Generated BAC failed validation', validation, rawBac: bac });
    }
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// GET /api/bac/completeness
router.get('/completeness', (req: Request, res: Response) => {
  const session = resolveSession(req);

  if (!session.currentBAC) {
    res.json({ complete: false, incompleteNodes: [], incompleteEdges: [], error: 'No BAC available' });
    return;
  }

  const completeness = validateContractCompleteness(session.currentBAC);
  res.json(completeness);
});

export default router;
