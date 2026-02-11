/**
 * Agent Orchestrator
 *
 * Routes instructions to the appropriate agent mode:
 * - Build Within: Uses Brick's pipeline (planCode, generateFile, deploy)
 * - Augment On Top: Uses external agents (Claude Code, Codex)
 *
 * This is a design skeleton — implementation follows after Workstreams 1-3
 * prove the pattern with site design iteration.
 */

import type { Agent, AgentContext, AgentResult, AgentMode } from './types.js';

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

  /**
   * Route an instruction to the appropriate agent.
   * In the future, this will use the LLM to determine intent
   * and select the right agent automatically.
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
   * Apply the results of an agent execution.
   * Updates files, runs commands, triggers deploys, etc.
   */
  async applyResult(_context: AgentContext, _result: AgentResult): Promise<void> {
    // TODO: Implement action application
    // - create_file: write to project files
    // - edit_file: apply edits to existing files
    // - delete_file: remove from project files
    // - run_command: execute shell commands
    // - deploy: trigger deployment pipeline
    // - preview: launch preview server
  }
}

export const orchestrator = new AgentOrchestrator();
