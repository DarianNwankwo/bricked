/**
 * BAC Agent — generates and updates BrickAppContract from project descriptions
 *
 * Takes a project description + existing BAC, reasons about architecture,
 * and emits BAC patches through deriveBrickAppContract / applyBACPatch.
 */

import type { AgentContext, AgentResult, AgentDomain } from './types.js';
import { BaseAgent } from './base.js';
import {
  deriveBrickAppContract,
  applyBACPatch,
  type DeriveBACParams,
  type BACComponent,
  type BACConnection,
} from '../bac/derive.js';
import type { BrickAppContract, BACPatch } from '../types/bac.js';

export class BACAgent extends BaseAgent {
  readonly name = 'bac-agent';
  readonly domain: AgentDomain = 'bac';

  canHandle(instruction: string): boolean {
    const lower = instruction.toLowerCase();
    return (
      lower.includes('architecture') ||
      lower.includes('bac') ||
      lower.includes('contract') ||
      lower.includes('component') ||
      lower.includes('design') ||
      lower.includes('system')
    );
  }

  async execute(context: AgentContext, instruction: string): Promise<AgentResult> {
    const { project, bac: existingBAC } = context;

    // Build component list from project architecture
    const components: BACComponent[] = project.architecture.components.map(c => ({
      id: c.id,
      name: c.name,
      type: c.type,
      spec: c.spec,
    }));

    const connections: BACConnection[] = project.architecture.connections.map(c => ({
      from: c.from,
      to: c.to,
      label: c.label,
    }));

    const params: DeriveBACParams = {
      appName: project.name,
      intent: instruction,
      components,
      connections,
      existing: existingBAC || null,
    };

    const bac = deriveBrickAppContract(params);

    return {
      actions: [],
      response: `BAC generated for "${project.name}" with ${bac.systemContracts.nodes.length} nodes and ${bac.systemContracts.edges.length} edges.`,
      updatedFiles: [],
    };
  }

  /**
   * Apply a set of BAC patches to an existing contract.
   * Used when the agent produces incremental updates rather than a full regeneration.
   */
  applyPatches(bac: BrickAppContract, patches: BACPatch[]): BrickAppContract {
    let result = bac;
    for (const patch of patches) {
      result = applyBACPatch(result, patch);
    }
    return result;
  }
}
