/**
 * Agent Orchestrator
 *
 * Routes instructions to the appropriate agent:
 * - By name: directly specify which agent to use
 * - By intent: auto-select based on instruction content (canHandle)
 * - By domain: get all agents for a specific domain (bac, codegen, docs)
 *
 * Supports two execution modes:
 * - Direct: execute synchronously in the web process
 * - Queue: dispatch to BullMQ worker for background processing
 */

import type { Agent, AgentContext, AgentResult, AgentMode, AgentDomain } from './types.js';
import { stashArtifacts, updateArtifactFile } from '../server/services/artifacts.js';
import { startPreview } from '../server/services/preview.js';
import { exec } from 'child_process';
import { promisify } from 'util';

// Import domain agents
import { BACAgent } from './bac-agent.js';
import { CodegenAgent } from './codegen-agent.js';
import { DocsAgent } from './docs-agent.js';

const execAsync = promisify(exec);

export class AgentOrchestrator {
  private agents: Map<string, Agent> = new Map();

  registerAgent(agent: Agent): void {
    this.agents.set(agent.name, agent);
  }

  getAgent(name: string): Agent | undefined {
    return this.agents.get(name);
  }

  getAgentsByMode(mode: AgentMode): Agent[] {
    return Array.from(this.agents.values()).filter(a => a.mode === mode);
  }

  getAgentsByDomain(domain: AgentDomain): Agent[] {
    return Array.from(this.agents.values()).filter(a => a.domain === domain);
  }

  /** List all registered agent names and their domains */
  listAgents(): Array<{ name: string; domain?: AgentDomain; mode: AgentMode }> {
    return Array.from(this.agents.values()).map(a => ({
      name: a.name,
      domain: a.domain,
      mode: a.mode,
    }));
  }

  /**
   * Auto-select an agent based on instruction content.
   * Returns the first agent whose canHandle() returns true.
   */
  selectAgent(instruction: string): Agent | null {
    for (const agent of this.agents.values()) {
      if (agent.canHandle?.(instruction)) {
        return agent;
      }
    }
    return null;
  }

  /**
   * Route an instruction to the appropriate agent.
   * If agentName is provided, use it directly.
   * Otherwise, auto-select based on instruction content.
   */
  async execute(
    agentName: string,
    context: AgentContext,
    instruction: string
  ): Promise<AgentResult> {
    const agent = this.agents.get(agentName);
    if (!agent) {
      return {
        actions: [],
        response: `Agent "${agentName}" not found. Available agents: ${Array.from(this.agents.keys()).join(', ')}`,
      };
    }

    return agent.execute(context, instruction);
  }

  /**
   * Execute by auto-selecting the best agent for the instruction.
   */
  async executeAuto(
    context: AgentContext,
    instruction: string
  ): Promise<AgentResult> {
    const agent = this.selectAgent(instruction);
    if (!agent) {
      return {
        actions: [],
        response: `No agent can handle this instruction. Available agents: ${Array.from(this.agents.keys()).join(', ')}`,
      };
    }

    return agent.execute(context, instruction);
  }

  /**
   * Apply the results of an agent execution.
   * Updates files, runs commands, triggers deploys, etc.
   */
  async applyResult(context: AgentContext, result: AgentResult): Promise<void> {
    const slug = context.project.slug;

    for (const action of result.actions) {
      switch (action.type) {
        case 'create_file': {
          const { path, content, componentId } = action.payload as { path: string; content: string; componentId?: string };
          await stashArtifacts(slug, context.project.id, [
            { path, content, componentId: componentId || null },
          ]);
          break;
        }
        case 'edit_file': {
          const { path, content } = action.payload as { path: string; content: string };
          await updateArtifactFile(slug, path, content);
          break;
        }
        case 'run_command': {
          const { command, cwd } = action.payload as { command: string; cwd?: string };
          try {
            await execAsync(command, { cwd: cwd || process.cwd(), timeout: 30_000 });
          } catch (error) {
            console.error(`Command failed: ${command}`, error);
          }
          break;
        }
        case 'preview': {
          const project = action.payload as { id: string; slug: string; architecture: any };
          try {
            await startPreview(project as any);
          } catch (error) {
            console.error('Preview start failed:', error);
          }
          break;
        }
        case 'delete_file':
        case 'deploy':
        case 'verify':
          // These are handled at the UI/API level
          break;
      }
    }
  }
}

// ── Singleton orchestrator with domain agents pre-registered ────────────────

export const orchestrator = new AgentOrchestrator();

// Register domain agents
orchestrator.registerAgent(new BACAgent());
orchestrator.registerAgent(new CodegenAgent());
orchestrator.registerAgent(new DocsAgent());
