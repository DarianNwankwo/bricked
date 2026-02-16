/**
 * Codegen Agent — generates code files from BAC contracts
 *
 * Takes a BAC, plans file structure via planCodeStructure,
 * generates files via generateFile/generateFileFromBAC.
 */

import type { AgentContext, AgentResult, AgentDomain } from './types.js';
import { BaseAgent } from './base.js';
import { planCodeStructureFromBAC, planCodeStructure, type Component } from '../codegen/planner.js';
import {
  generateFileFromBAC,
  generateFile,
  generateAllFiles,
  type GeneratedFile,
} from '../codegen/generator.js';
import type { BrickAppContract } from '../types/bac.js';

export class CodegenAgent extends BaseAgent {
  readonly name = 'codegen-agent';
  readonly domain: AgentDomain = 'codegen';

  canHandle(instruction: string): boolean {
    const lower = instruction.toLowerCase();
    return (
      lower.includes('generate') ||
      lower.includes('code') ||
      lower.includes('implement') ||
      lower.includes('build') ||
      lower.includes('create file')
    );
  }

  async execute(context: AgentContext, instruction: string): Promise<AgentResult> {
    const { project, bac, files: existingFiles } = context;
    const config = this.getLLMConfig();

    // Build component list
    const components: Component[] = project.architecture.components.map(c => ({
      id: c.id,
      name: c.name,
      type: c.type,
      spec: c.spec,
      connections: project.architecture.connections
        .filter(conn => conn.from === c.id)
        .map(conn => conn.to),
    }));

    let generatedFiles: GeneratedFile[];

    if (bac) {
      // BAC-aware code generation
      const plan = await planCodeStructureFromBAC(bac, project.name, config);
      const existingMap = new Map(existingFiles.map(f => [f.path, f.content]));

      generatedFiles = [];
      for (const file of plan.files) {
        const generated = await generateFileFromBAC({
          file,
          components,
          existingFiles: existingMap,
          config,
          bac,
        });
        generatedFiles.push(generated);
        existingMap.set(file.path, generated.content);
      }
    } else {
      // Basic code generation from architecture
      generatedFiles = await generateAllFiles({
        files: (await planCodeStructure(components, project.name, config)).files,
        components,
        config,
      });
    }

    // Convert to agent actions
    const actions = generatedFiles.map(f =>
      this.createFileAction(f.path, f.content, f.componentId || undefined)
    );

    return {
      actions,
      response: `Generated ${generatedFiles.length} files for "${project.name}".`,
      updatedFiles: generatedFiles,
    };
  }
}
