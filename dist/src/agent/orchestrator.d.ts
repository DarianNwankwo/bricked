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
export declare class AgentOrchestrator {
    private agents;
    registerAgent(agent: Agent): void;
    getAgent(name: string): Agent | undefined;
    getAgentsByMode(mode: AgentMode): Agent[];
    /**
     * Route an instruction to the appropriate agent.
     * In the future, this will use the LLM to determine intent
     * and select the right agent automatically.
     */
    execute(agentName: string, context: AgentContext, instruction: string): Promise<AgentResult>;
    /**
     * Apply the results of an agent execution.
     * Updates files, runs commands, triggers deploys, etc.
     */
    applyResult(_context: AgentContext, _result: AgentResult): Promise<void>;
}
export declare const orchestrator: AgentOrchestrator;
//# sourceMappingURL=orchestrator.d.ts.map