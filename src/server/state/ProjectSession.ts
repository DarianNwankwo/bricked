/**
 * ProjectSession — encapsulates all per-project mutable state that was
 * previously held as module-level variables in ui.ts.
 */

import type { BrickAppContract, BACPatch } from '../../types/bac.js';
import type { Component, FilePlan, GeneratedFile } from '../../codegen/index.js';
import type { Message } from '../../llm/index.js';
import {
  deriveBrickAppContract,
  bacToArchitecture,
  applyBACPatch,
  validateContractCompleteness,
} from '../../bac/index.js';
import { parse } from '../../parser/index.js';
import { transform } from '../../transformer/index.js';
// ── Interfaces ──────────────────────────────────────────────────────────

export interface ComponentSpec {
  description?: string;
  inputs?: string;
  outputs?: string;
  notes?: string;
  markdown?: string;
  innerComponents?: Array<{ name: string; description?: string }>;
}

export interface ArchConnectionContract {
  sourceOutput?: string;
  targetInput?: string;
  notes?: string;
}

export interface ProjectFile {
  path: string;
  content: string;
  componentId: string | null;
  generatedAt: Date;
  isManuallyEdited: boolean;
}

export interface ProjectData {
  files: Map<string, ProjectFile>;
  componentSpecs: Record<string, ComponentSpec>;
  lastGeneratedComponents: Component[];
}

export type ComponentType =
  | 'service' | 'static_site' | 'worker' | 'job' | 'function' | 'container'
  | 'database' | 'cache' | 'queue' | 'storage' | 'search'
  | 'api_gateway' | 'load_balancer' | 'cdn' | 'dns' | 'firewall'
  | 'auth' | 'monitoring' | 'logging' | 'secrets' | 'registry'
  | 'email' | 'payment' | 'analytics' | 'ml_model' | 'third_party';

export interface ArchComponent {
  id: string;
  name: string;
  type: ComponentType;
  x: number;
  y: number;
}

export interface ArchConnection {
  from: string;
  to: string;
  label?: string;
  contract?: ArchConnectionContract;
}

export interface ManualArchitecture {
  name: string;
  components: ArchComponent[];
  connections: ArchConnection[];
}

export interface DocsPatch {
  op: 'replace_all' | 'append_section' | 'replace_section';
  content: string;
  heading?: string;
}

// ── Helper functions ────────────────────────────────────────────────────

export function componentIdToIndex(id: string): number {
  const letters = id.toUpperCase().replace(/[^A-Z]/g, '');
  if (letters.length > 0) {
    let acc = 0;
    for (const letter of letters) {
      acc = acc * 26 + (letter.charCodeAt(0) - 64);
    }
    return Math.max(0, acc - 1);
  }
  const digits = parseInt(id.replace(/\D/g, ''), 10);
  return Number.isFinite(digits) ? Math.max(0, digits) : 0;
}

export function indexToComponentId(index: number): string {
  let value = Math.max(0, index) + 1;
  let label = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    value = Math.floor((value - 1) / 26);
  }
  return label;
}

export function nextComponentIndex(components: Array<{ id: string }>): number {
  if (components.length === 0) return 0;
  return Math.max(...components.map(c => componentIdToIndex(c.id))) + 1;
}

// ── ProjectSession ──────────────────────────────────────────────────────

export class ProjectSession {
  currentProjectId: string | null = null;
  currentBAC: BrickAppContract | null = null;
  manualArchitecture: ManualArchitecture | null = null;
  currentProject: ProjectData = {
    files: new Map(),
    componentSpecs: {},
    lastGeneratedComponents: [],
  };
  conversationHistory: Message[] = [];
  selectedModel: string | null = null;
  currentDiagram: string | null = null;
  currentDocs: string = '';
  nextComponentId = 0;
  bacVersion = 0;
  isGeneratingCode = false;

  // ── BAC patch extraction ────────────────────────────────────────────

  extractBacPatchBlocks(text: string): BACPatch[][] {
    const blocks: BACPatch[][] = [];
    const regex = /```bac-patch\s*\n([\s\S]*?)```/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      try {
        const parsed = JSON.parse(match[1].trim());
        if (Array.isArray(parsed)) {
          blocks.push(parsed as BACPatch[]);
        }
      } catch {
        // Skip unparseable blocks
      }
    }
    return blocks;
  }

  // ── Docs patch extraction & application ─────────────────────────────

  extractDocsUpdateBlocks(text: string): DocsPatch[] {
    const patches: DocsPatch[] = [];
    const regex = /```docs-update\s*\n([\s\S]*?)```/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      try {
        const parsed = JSON.parse(match[1].trim());
        if (Array.isArray(parsed)) {
          patches.push(...(parsed as DocsPatch[]));
        }
      } catch {
        // Skip unparseable blocks
      }
    }
    return patches;
  }

  applyDocsPatch(docs: string, patch: DocsPatch): string {
    switch (patch.op) {
      case 'replace_all':
        return patch.content;
      case 'append_section':
        return docs.trimEnd() + '\n\n' + (patch.heading ? patch.heading + '\n\n' : '') + patch.content;
      case 'replace_section': {
        if (!patch.heading) return docs;
        const headingMatch = patch.heading.match(/^(#{1,6})\s/);
        const level = headingMatch ? headingMatch[1].length : 2;
        const escaped = patch.heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const sectionRegex = new RegExp(
          `(${escaped}\\n)([\\s\\S]*?)(?=\\n#{1,${level}}\\s|$)`
        );
        if (sectionRegex.test(docs)) {
          return docs.replace(sectionRegex, `$1\n${patch.content}\n`);
        }
        return docs.trimEnd() + '\n\n' + patch.heading + '\n\n' + patch.content;
      }
      default:
        return docs;
    }
  }

  // ── BAC patches ─────────────────────────────────────────────────────

  applyBacPatchesAndSync(patches: BACPatch[]): {
    bac: BrickAppContract;
    architecture: ManualArchitecture | null;
    completeness: ReturnType<typeof validateContractCompleteness>;
  } {
    let patched = this.currentBAC!;
    for (const patch of patches) {
      patched = applyBACPatch(patched, patch);
    }
    this.currentBAC = patched;
    this.bacVersion++;

    const projected = bacToArchitecture(patched);
    if (this.manualArchitecture) {
      this.manualArchitecture.components = projected.components.map(c => ({
        id: c.id,
        name: c.name,
        type: c.type as ComponentType,
        x: c.x ?? this.manualArchitecture!.components.find(mc => mc.id === c.id)?.x ?? 100,
        y: c.y ?? this.manualArchitecture!.components.find(mc => mc.id === c.id)?.y ?? 100,
      }));
      this.manualArchitecture.connections = projected.connections.map(c => ({
        from: c.from,
        to: c.to,
        label: c.label,
        contract: c.contract,
      }));
      for (const comp of projected.components) {
        if (comp.spec) {
          this.currentProject.componentSpecs[comp.id] = comp.spec;
        }
      }
    }

    const completeness = validateContractCompleteness(patched);
    return { bac: patched, architecture: this.manualArchitecture, completeness };
  }

  // ── Architecture helpers ────────────────────────────────────────────

  manualToIR(arch: ManualArchitecture) {
    return {
      name: arch.name,
      components: arch.components.map(c => ({
        id: c.id,
        name: c.name,
        type: c.type,
        connections: arch.connections
          .filter(conn => conn.from === c.id)
          .map(conn => conn.to),
      })),
    };
  }

  manualToMermaid(arch: ManualArchitecture): string {
    const lines = ['flowchart TD'];
    lines.push(`    %% brick:name=${arch.name}`);

    const shapes: Record<string, [string, string]> = {
      service: ['[', ']'],
      static_site: ['([', '])'],
      database: ['[(', ')]'],
      worker: ['((', '))'],
      job: ['{{', '}}'],
    };

    for (const c of arch.components) {
      const [open, close] = shapes[c.type] || ['[', ']'];
      lines.push(`    ${c.id}${open}${c.name}${close}`);
    }

    for (const conn of arch.connections) {
      if (conn.label) {
        const safeLabel = String(conn.label).replace(/\|/g, '/').trim();
        lines.push(`    ${conn.from} -->|${safeLabel}| ${conn.to}`);
      } else {
        lines.push(`    ${conn.from} --> ${conn.to}`);
      }
    }

    return lines.join('\n');
  }

  refreshBACFromCurrentArchitecture(intent?: string): void {
    try {
      if (this.manualArchitecture) {
        const ir = this.manualToIR(this.manualArchitecture);
        const components: Component[] = ir.components.map(component => ({
          id: component.id,
          name: component.name,
          type: component.type,
          connections: component.connections || [],
          spec: this.currentProject.componentSpecs[component.id] || {},
        }));
        this.currentBAC = deriveBrickAppContract({
          appName: ir.name || 'brick-app',
          intent,
          components,
          connections: this.manualArchitecture.connections.map(connection => ({
            from: connection.from,
            to: connection.to,
            label: connection.label,
            contract: connection.contract ? {
              sourceOutput: connection.contract.sourceOutput,
              targetInput: connection.contract.targetInput,
              notes: connection.contract.notes,
            } : undefined,
          })),
          existing: this.currentBAC,
        });
        if (this.currentBAC) {
          for (const node of this.currentBAC.systemContracts.nodes) {
            const archComponent = this.manualArchitecture!.components.find(c => c.id === node.nodeId);
            if (archComponent) {
              node.x = archComponent.x;
              node.y = archComponent.y;
            }
          }
        }
        return;
      }

      if (this.currentDiagram) {
        const ast = parse(this.currentDiagram);
        const ir = transform(ast);
        const components: Component[] = ir.components.map(component => ({
          id: component.id,
          name: component.name,
          type: component.type,
          connections: component.connections || [],
          spec: this.currentProject.componentSpecs[component.id] || {},
        }));
        this.currentBAC = deriveBrickAppContract({
          appName: ir.name || 'brick-app',
          intent,
          region: ir.region,
          components,
          connections: ir.components.flatMap(component =>
            (component.connections || []).map(to => ({ from: component.id, to }))
          ),
          existing: this.currentBAC,
        });
        return;
      }
    } catch {
      // Keep previous BAC when architecture parsing fails.
    }
  }

  // ── Reset ───────────────────────────────────────────────────────────

  reset(): void {
    this.conversationHistory = [];
    this.currentDiagram = null;
    this.currentProject = { files: new Map(), componentSpecs: {}, lastGeneratedComponents: [] };
    this.manualArchitecture = null;
    this.nextComponentId = 0;
    this.currentBAC = null;
    this.currentDocs = '';
    this.currentProjectId = null;
    this.bacVersion = 0;
    this.isGeneratingCode = false;
    this.selectedModel = null;
  }

}

// ── Utility ─────────────────────────────────────────────────────────────

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}
