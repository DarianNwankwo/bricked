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
export declare class AgentOrchestrator {
    private agents;
    registerAgent(agent: Agent): void;
    getAgent(name: string): Agent | undefined;
    getAgentsByMode(mode: AgentMode): Agent[];
    getAgentsByDomain(domain: AgentDomain): Agent[];
    /** List all registered agent names and their domains */
    listAgents(): Array<{
        name: string;
        domain?: AgentDomain;
        mode: AgentMode;
    }>;
    /**
     * Auto-select an agent based on instruction content.
     * Returns the first agent whose canHandle() returns true.
     */
    selectAgent(instruction: string): Agent | null;
    /**
     * Route an instruction to the appropriate agent.
     * If agentName is provided, use it directly.
     * Otherwise, auto-select based on instruction content.
     */
    execute(agentName: string, context: AgentContext, instruction: string): Promise<AgentResult>;
    /**
     * Execute by auto-selecting the best agent for the instruction.
     */
    executeAuto(context: AgentContext, instruction: string): Promise<AgentResult>;
    /**
     * Apply the results of an agent execution.
     * Updates files, runs commands, triggers deploys, etc.
     */
    applyResult(context: AgentContext, result: AgentResult): Promise<void>;
}
export declare const orchestrator: AgentOrchestrator;
//# sourceMappingURL=orchestrator.d.ts.map