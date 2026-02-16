/**
 * Base Agent — abstract base class for domain-scoped agents
 *
 * Provides common infrastructure for BAC, Codegen, and Docs agents:
 * - Standard execute/canHandle interface
 * - LLM config resolution with per-agent model override
 * - Progress event emission pattern
 */

import type {
  Agent,
  AgentContext,
  AgentResult,
  AgentAction,
  AgentMode,
  AgentDomain,
} from './types.js';
import { getLLMConfig, type LLMConfig } from '../llm/config.js';

export abstract class BaseAgent implements Agent {
  abstract readonly name: string;
  abstract readonly domain: AgentDomain;
  readonly mode: AgentMode = 'build_within';

  /** Optional per-agent model override (e.g. 'anthropic/claude-sonnet-4-20250514') */
  modelOverride?: string;

  abstract execute(context: AgentContext, instruction: string): Promise<AgentResult>;

  /** Default canHandle — subclasses should override for smarter routing */
  canHandle(_instruction: string): boolean {
    return true;
  }

  /** Get LLM config, applying agent-level model override if set */
  protected getLLMConfig(): LLMConfig {
    const config = getLLMConfig();
    if (this.modelOverride) {
      return { ...config, model: this.modelOverride };
    }
    return config;
  }

  /** Helper to create a file-creation action */
  protected createFileAction(path: string, content: string, componentId?: string): AgentAction {
    return {
      type: 'create_file',
      payload: { path, content, componentId },
    };
  }

  /** Helper to create a file-edit action */
  protected editFileAction(path: string, content: string): AgentAction {
    return {
      type: 'edit_file',
      payload: { path, content },
    };
  }
}
