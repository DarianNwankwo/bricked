/**
 * Agent routes — Claude Code agent SSE endpoints extracted from ui.ts
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import {
  formatBACForPrompt,
  buildDevChatSystemContext,
  buildDocsChatSystemContext,
  buildCodeChatSystemContext,
} from '../../codegen/index.js';
import { validateContractCompleteness } from '../../bac/index.js';
import { slugify } from '../services/artifacts.js';
import { resolveSession } from '../state/resolveSession.js';

const router = Router();

// POST /api/agent/claude-code — SSE stream
router.post('/claude-code', async (req: Request, res: Response) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  try {
    const session = resolveSession(req);
    const { instruction, context: devContext, projectDocs: clientDocs } = req.body;
    const contextMode: 'canvas' | 'docs' | 'code' = devContext || 'canvas';

    if (!instruction || typeof instruction !== 'string') {
      res.write(`data: ${JSON.stringify({ type: 'error', content: 'Missing instruction' })}\n\n`);
      res.end();
      return;
    }

    const { sendMessage, cancelCurrentRequest } = await import('../../agent/claude-code.js');

    req.on('close', () => {
      cancelCurrentRequest();
    });

    let systemContext: string | undefined;
    if (contextMode === 'docs') {
      const projectName = session.currentBAC?.metadata?.name || session.manualArchitecture?.name || undefined;
      systemContext = buildDocsChatSystemContext(clientDocs || session.currentDocs || '', session.currentBAC || undefined, projectName);
    } else if (contextMode === 'code') {
      systemContext = buildCodeChatSystemContext(session.currentBAC || undefined, session.currentProject || undefined);
    } else {
      systemContext = session.currentBAC ? buildDevChatSystemContext(session.currentBAC) : undefined;
    }

    let accumulatedText = '';
    for await (const event of sendMessage(instruction, process.cwd(), { systemContext })) {
      if (event.type === 'text' && event.content) {
        accumulatedText += event.content;
      }

      res.write(`data: ${JSON.stringify(event)}\n\n`);

      if (event.type === 'done') {
        if (contextMode === 'canvas' && session.currentBAC) {
          const patchBlocks = session.extractBacPatchBlocks(accumulatedText);
          const allPatches = patchBlocks.flat();
          if (allPatches.length > 0) {
            try {
              const { bac, architecture, completeness } = session.applyBacPatchesAndSync(allPatches);
              const ops = [...new Set(allPatches.map(p => p.op))];
              res.write(`data: ${JSON.stringify({
                type: 'bac_update',
                patches: allPatches,
                bac,
                architecture,
                completeness,
                content: `${allPatches.length} patch(es) applied (${ops.join(', ')})`,
              })}\n\n`);
            } catch (patchErr) {
              res.write(`data: ${JSON.stringify({ type: 'error', content: 'Failed to apply BAC patches: ' + (patchErr as Error).message })}\n\n`);
            }
          }
        } else if (contextMode === 'docs') {
          const docsPatches = session.extractDocsUpdateBlocks(accumulatedText);
          if (docsPatches.length > 0) {
            try {
              let updatedDocs = clientDocs || session.currentDocs || '';
              for (const patch of docsPatches) {
                updatedDocs = session.applyDocsPatch(updatedDocs, patch);
              }
              session.currentDocs = updatedDocs;
              res.write(`data: ${JSON.stringify({
                type: 'docs_update',
                docs: updatedDocs,
                content: `${docsPatches.length} docs patch(es) applied`,
              })}\n\n`);
            } catch (docsErr) {
              res.write(`data: ${JSON.stringify({ type: 'error', content: 'Failed to apply docs patches: ' + (docsErr as Error).message })}\n\n`);
            }
          }
        }
      }
    }
  } catch (error) {
    res.write(`data: ${JSON.stringify({ type: 'error', content: (error as Error).message })}\n\n`);
  }

  res.end();
});

// GET /api/agent/claude-code/history
router.get('/claude-code/history', async (_req: Request, res: Response) => {
  const { getConversationHistory } = await import('../../agent/claude-code.js');
  res.json(getConversationHistory());
});

// POST /api/agent/claude-code/reset
router.post('/claude-code/reset', async (_req: Request, res: Response) => {
  const { clearConversation } = await import('../../agent/claude-code.js');
  clearConversation();
  res.json({ success: true });
});

// POST /api/agent/claude-code/cancel
router.post('/claude-code/cancel', async (_req: Request, res: Response) => {
  const { cancelCurrentRequest } = await import('../../agent/claude-code.js');
  const cancelled = cancelCurrentRequest();
  res.json({ cancelled });
});

// POST /api/agent/claude-code/generate — BAC-driven code generation
router.post('/claude-code/generate', async (req: Request, res: Response) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  try {
    const session = resolveSession(req);
    const { nodeId } = req.body as { nodeId?: string };

    if (!session.currentBAC) {
      res.write(`data: ${JSON.stringify({ type: 'error', content: 'No BAC available. Create an architecture first.' })}\n\n`);
      res.end();
      return;
    }

    const completeness = validateContractCompleteness(session.currentBAC);
    if (!completeness.complete) {
      const incomplete = completeness.incompleteNodes.map(n => `${n.nodeName}: ${n.fields.join(', ')}`).join('; ');
      res.write(`data: ${JSON.stringify({ type: 'error', content: `Contracts incomplete: ${incomplete}. Fill all contracts before generating.` })}\n\n`);
      res.end();
      return;
    }

    const { sendMessage, cancelCurrentRequest } = await import('../../agent/claude-code.js');
    req.on('close', () => { cancelCurrentRequest(); });

    let instruction: string;
    const bacContext = formatBACForPrompt(session.currentBAC);

    if (nodeId) {
      const node = session.currentBAC.systemContracts.nodes.find(n => n.nodeId === nodeId);
      if (!node) {
        res.write(`data: ${JSON.stringify({ type: 'error', content: `Node ${nodeId} not found in BAC` })}\n\n`);
        res.end();
        return;
      }
      const adjacentEdges = session.currentBAC.systemContracts.edges.filter(
        e => e.fromNodeId === nodeId || e.toNodeId === nodeId
      );
      instruction = `Generate the implementation for the "${node.nodeName}" component (${node.nodeType}).

Input Contract: ${node.inputContract}
Output Contract: ${node.outputContract}
${node.description ? `Description: ${node.description}` : ''}
${node.notes ? `Notes: ${node.notes}` : ''}

${adjacentEdges.length > 0 ? `Connected edges:\n${adjacentEdges.map(e => `- ${e.fromNodeId} → ${e.toNodeId}: source=${e.sourceOutputContract}, target=${e.targetInputContract}`).join('\n')}` : ''}

Create all necessary files for this component with proper types matching the contracts.`;
    } else {
      const nodes = session.currentBAC.systemContracts.nodes;
      instruction = `Generate a complete implementation for this application.

${nodes.map(n => `- ${n.nodeName} (${n.nodeType}): input=${n.inputContract}, output=${n.outputContract}`).join('\n')}

Create all files needed for a production-ready project. Include package.json, TypeScript configs, Dockerfiles, and implementation files for each component. Ensure type contracts are respected across component boundaries.`;
    }

    for await (const event of sendMessage(instruction, process.cwd(), { systemContext: bacContext })) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);

      if (event.type === 'done' && event.summary?.filesChanged?.length) {
        try {
          const projectSlug = slugify(session.currentBAC!.metadata.name || 'brick-app');
          res.write(`data: ${JSON.stringify({ type: 'status', content: `Stashed ${event.summary.filesChanged.length} files to artifacts/${projectSlug}` })}\n\n`);
        } catch {
          // Non-fatal
        }
      }
    }
  } catch (error) {
    res.write(`data: ${JSON.stringify({ type: 'error', content: (error as Error).message })}\n\n`);
  }

  res.end();
});

export default router;
