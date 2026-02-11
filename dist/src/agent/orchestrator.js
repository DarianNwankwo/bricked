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
export class AgentOrchestrator {
    agents = new Map();
    registerAgent(agent) {
        this.agents.set(agent.name, agent);
    }
    getAgent(name) {
        return this.agents.get(name);
    }
    getAgentsByMode(mode) {
        return Array.from(this.agents.values()).filter(a => a.mode === mode);
    }
    /**
     * Route an instruction to the appropriate agent.
     * In the future, this will use the LLM to determine intent
     * and select the right agent automatically.
     */
    async execute(agentName, context, instruction) {
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
    async applyResult(_context, _result) {
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
//# sourceMappingURL=orchestrator.js.map