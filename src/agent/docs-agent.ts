/**
 * Docs Agent — generates and updates project documentation from BAC
 *
 * Takes a BAC + existing docs and produces markdown documentation
 * covering architecture, API contracts, deployment, and setup.
 */

import type { AgentContext, AgentResult, AgentDomain } from './types.js';
import { BaseAgent } from './base.js';
import { chat, type ChatMessage } from '../llm/client.js';
import type { BrickAppContract } from '../types/bac.js';

const DOCS_SYSTEM_PROMPT = `You are a technical documentation writer for software projects.
Given a project's architecture contract (BAC) and any existing documentation,
generate or update comprehensive markdown documentation.

Include sections for:
1. **Overview** — What the project does, its purpose
2. **Architecture** — Components, their roles, how they connect
3. **API Contracts** — Input/output contracts between components
4. **Data Model** — Key entities and their relationships
5. **Deployment** — How to deploy and configure the application
6. **Development** — How to set up a local dev environment

Output ONLY the markdown content, no code fences wrapping the whole document.
Be concise but thorough. Use the BAC data to ensure accuracy.`;

export class DocsAgent extends BaseAgent {
  readonly name = 'docs-agent';
  readonly domain: AgentDomain = 'docs';

  canHandle(instruction: string): boolean {
    const lower = instruction.toLowerCase();
    return (
      lower.includes('doc') ||
      lower.includes('readme') ||
      lower.includes('documentation') ||
      lower.includes('explain')
    );
  }

  async execute(context: AgentContext, instruction: string): Promise<AgentResult> {
    const { project, bac } = context;
    const config = this.getLLMConfig();

    // Build prompt with BAC context
    let userMessage = `Project: ${project.name}\n\n`;

    if (bac) {
      userMessage += `## BAC Contract\n${formatBACForDocs(bac)}\n\n`;
    }

    userMessage += `## Architecture Components\n`;
    for (const comp of project.architecture.components) {
      userMessage += `- **${comp.name}** (${comp.type})`;
      if (comp.spec?.description) {
        userMessage += `: ${comp.spec.description}`;
      }
      userMessage += '\n';
    }

    userMessage += `\n## Connections\n`;
    for (const conn of project.architecture.connections) {
      userMessage += `- ${conn.from} → ${conn.to}`;
      if (conn.label) userMessage += ` (${conn.label})`;
      userMessage += '\n';
    }

    if (context.systemContext) {
      userMessage += `\n## Existing Documentation\n${context.systemContext}\n`;
    }

    userMessage += `\n## Instruction\n${instruction}`;

    const messages: ChatMessage[] = [{ role: 'user', content: userMessage }];
    const response = await chat(DOCS_SYSTEM_PROMPT, messages, config);

    const docsContent = response.content.trim();

    return {
      actions: [this.createFileAction('README.md', docsContent)],
      response: `Documentation generated for "${project.name}" (${docsContent.length} characters).`,
    };
  }
}

function formatBACForDocs(bac: BrickAppContract): string {
  const lines: string[] = [];

  lines.push(`**Name:** ${bac.metadata.name}`);
  if (bac.metadata.vertical) {
    lines.push(`**Vertical:** ${bac.metadata.vertical}`);
  }

  if (bac.productOutcome) {
    lines.push(`\n### Product Outcome`);
    lines.push(bac.productOutcome.summary);
    if (bac.productOutcome.userJobs.length > 0) {
      lines.push(`\nUser Jobs:`);
      for (const job of bac.productOutcome.userJobs) {
        lines.push(`- ${job}`);
      }
    }
  }

  if (bac.systemContracts?.nodes?.length) {
    lines.push(`\n### System Nodes (${bac.systemContracts.nodes.length})`);
    for (const node of bac.systemContracts.nodes) {
      lines.push(`- **${node.nodeName}** (${node.nodeType}): ${node.description || 'N/A'}`);
      if (node.inputContract) lines.push(`  - Input: ${node.inputContract}`);
      if (node.outputContract) lines.push(`  - Output: ${node.outputContract}`);
    }
  }

  if (bac.systemContracts?.edges?.length) {
    lines.push(`\n### System Edges (${bac.systemContracts.edges.length})`);
    for (const edge of bac.systemContracts.edges) {
      lines.push(`- ${edge.fromNodeId} → ${edge.toNodeId}: ${edge.label || 'N/A'}`);
    }
  }

  return lines.join('\n');
}
