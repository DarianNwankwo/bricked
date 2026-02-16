/**
 * Chat routes — LLM streaming generate + build endpoints extracted from ui.ts
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import type { SessionManager } from '../state/SessionManager.js';
import type { ChatMessage } from '../../llm/index.js';
import { chatStream, type Message } from '../../llm/index.js';
import { SYSTEM_PROMPT } from '../../llm/prompts/system.js';
import { formatExamplesForPrompt } from '../../llm/prompts/examples.js';
import { getLLMConfig } from '../../llm/config.js';
import { parse } from '../../parser/index.js';
import { transform } from '../../transformer/index.js';
import { generate } from '../../generator/index.js';
import { validate } from '../../validator/index.js';
import { estimateCost } from '../../deployer/cost-estimator.js';
import YAML from 'yaml';

const router = Router();

function getSessionManager(req: Request): SessionManager {
  return req.app.locals.sessionManager as SessionManager;
}

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

// POST /api/generate-stream — SSE streaming LLM chat
router.post('/generate-stream', async (req: Request, res: Response) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  try {
    const sm = getSessionManager(req);
    const session = sm.getActiveSession();
    const { message, reset } = req.body;

    if (reset) {
      session.conversationHistory = [];
      session.currentDiagram = null;
    }

    const systemPrompt = session.currentDiagram
      ? `${SYSTEM_PROMPT}\n\n## Current Architecture\n\`\`\`mermaid\n${session.currentDiagram}\n\`\`\`\n\nModify the architecture based on the user's request. Output the complete updated diagram.`
      : `${SYSTEM_PROMPT}\n\n## Few-Shot Examples\n\n${formatExamplesForPrompt()}`;

    const messages: ChatMessage[] = [
      ...session.conversationHistory.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user' as const, content: message }
    ];

    let config;
    try {
      config = getLLMConfig();
      if (session.selectedModel) {
        config = { ...config, model: session.selectedModel };
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

    const diagram = extractMermaidBlock(fullContent);
    const explanation = extractExplanation(fullContent, diagram);

    session.conversationHistory.push({ role: 'user', content: message });
    session.conversationHistory.push({ role: 'assistant', content: fullContent });

    if (diagram) {
      session.currentDiagram = diagram;
    }

    session.refreshBACFromCurrentArchitecture(message);

    let costEstimate = null;
    let ir = null;
    if (session.currentDiagram) {
      try {
        const ast = parse(session.currentDiagram);
        ir = transform(ast);
        const yaml = generate(ir);
        const appspec = YAML.parse(yaml);
        costEstimate = estimateCost(appspec);
      } catch {
        // Ignore
      }
    }

    res.write(`data: ${JSON.stringify({ done: true, diagram: session.currentDiagram, explanation, cost: costEstimate, ir, bac: session.currentBAC })}\n\n`);
    res.end();
  } catch (error) {
    res.write(`data: ${JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' })}\n\n`);
    res.end();
  }
});

// POST /api/build — build from diagram
router.post('/build', async (req: Request, res: Response) => {
  try {
    const sm = getSessionManager(req);
    const session = sm.getActiveSession();
    const { componentSpecs: specs } = req.body || {};
    if (specs && typeof specs === 'object') {
      session.currentProject.componentSpecs = specs;
    }

    if (!session.currentDiagram) {
      res.status(400).json({ error: 'No diagram to build' });
      return;
    }

    const ast = parse(session.currentDiagram);
    const ir = transform(ast);
    const yaml = generate(ir);
    const appspec = YAML.parse(yaml);
    const validation = validate(appspec);
    const cost = estimateCost(appspec);
    session.refreshBACFromCurrentArchitecture();

    res.json({ yaml, validation, cost, ir, componentSpecs: specs, bac: session.currentBAC });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

export default router;
