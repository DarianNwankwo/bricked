/**
 * Agent Abstraction Layer — Type Definitions
 *
 * Defines the interface for agents that operate in two modes:
 * - Build Within: Generate new features via Brick's pipeline (planCode, generateFile, deploy)
 * - Augment On Top: Edit code via external agents (Claude Code, Codex)
 */

import type { GeneratedFile } from '../codegen/index.js';
import type { BrickAppContract } from '../types/bac.js';

export interface AgentContext {
  project: {
    id: string;
    name: string;
    slug: string;
    architecture: {
      components: Array<{
        id: string;
        name: string;
        type: string;
        spec?: {
          description?: string;
          inputs?: string;
          outputs?: string;
          notes?: string;
        };
      }>;
      connections: Array<{ from: string; to: string; label?: string }>;
    };
  };
  files: GeneratedFile[];
  conversationHistory: ChatMessage[];
  userPreferences: Record<string, unknown>;
  bac?: BrickAppContract;
  systemContext?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export type AgentActionType =
  | 'create_file'
  | 'edit_file'
  | 'delete_file'
  | 'run_command'
  | 'deploy'
  | 'preview'
  | 'verify';

export interface VerificationCheck {
  name: string;
  url: string;
  passed: boolean;
  httpStatus?: number;
  consoleErrors?: string[];
  screenshotPath?: string;
  error?: string;
}

export interface VerificationResult {
  passed: boolean;
  checks: VerificationCheck[];
  timestamp: string;
}

export interface AgentAction {
  type: AgentActionType;
  payload: Record<string, unknown>;
}

export interface AgentResult {
  actions: AgentAction[];
  response: string;
  updatedFiles?: GeneratedFile[];
}

export type AgentMode = 'build_within' | 'augment';

export type AgentDomain = 'bac' | 'codegen' | 'docs';

export interface Agent {
  name: string;
  mode: AgentMode;
  domain?: AgentDomain;
  execute(context: AgentContext, instruction: string): Promise<AgentResult>;
  canHandle?(instruction: string): boolean;
}
