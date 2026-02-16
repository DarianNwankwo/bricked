import { describe, expect, it } from 'vitest';
import {
  deriveBrickAppContract,
  validateBrickAppContract,
  bacToArchitecture,
  applyBACPatch,
  validateContractCompleteness,
} from '../../src/bac/index.js';
import type { BACPatch, BrickAppContract } from '../../src/types/bac.js';
import { INTENT_TO_BAC_PROMPT } from '../../src/codegen/index.js';

describe('Brick App Contract derivation', () => {
  it('derives BAC with mandatory AI opportunity assessments', () => {
    const bac = deriveBrickAppContract({
      appName: 'coach-platform',
      intent: 'Build a coaching CRM with landing page editing',
      region: 'nyc',
      components: [
        { id: 'A', name: 'Coach Copilot', type: 'service', connections: ['B'] },
        { id: 'B', name: 'Coach DB', type: 'database', connections: [] },
      ],
    });

    expect(bac.metadata.name).toBe('coach-platform');
    expect(bac.platformPolicy.modelRouter).toBe('openrouter');
    expect(bac.platformPolicy.defaultEditStrategy).toBe('targeted_edit');
    expect(bac.workflows.length).toBeGreaterThan(0);
    expect(bac.aiOpportunityAssessment.length).toBe(bac.workflows.length);
    expect(bac.systemContracts.nodes.length).toBe(2);
    expect(bac.systemContracts.edges.length).toBe(1);
    expect(bac.systemContracts.edges[0].id).toBe('A->B');
    expect(bac.systemContracts.edges[0].sourceOutputContract).toBeTruthy();
    expect(bac.systemContracts.edges[0].targetInputContract).toBeTruthy();
  });

  it('validates defer/exclude assessments require revisitTrigger', () => {
    const bac = deriveBrickAppContract({
      appName: 'sample-app',
      components: [
        { id: 'A', name: 'Web App', type: 'static_site', connections: [] },
      ],
    });

    const first = bac.aiOpportunityAssessment[0];
    first.decision = 'defer_to_v2';
    first.revisitTrigger = undefined;

    const validation = validateBrickAppContract(bac);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some(error => error.includes('revisitTrigger'))).toBe(true);
  });

  it('uses explicit connection contracts when provided', () => {
    const bac = deriveBrickAppContract({
      appName: 'contracted-app',
      components: [
        {
          id: 'A',
          name: 'API',
          type: 'service',
          connections: ['B'],
          spec: { outputs: 'User payload v2' },
        },
        {
          id: 'B',
          name: 'Worker',
          type: 'worker',
          connections: [],
          spec: { inputs: 'Task envelope' },
        },
      ],
      connections: [
        {
          from: 'A',
          to: 'B',
          label: 'user.created',
          contract: {
            sourceOutput: '{ userId: string, email: string }',
            targetInput: '{ userId: string, email: string }',
            notes: 'Must be idempotent by userId',
          },
        },
      ],
    });

    expect(bac.systemContracts.edges).toHaveLength(1);
    const edge = bac.systemContracts.edges[0];
    expect(edge.label).toBe('user.created');
    expect(edge.sourceOutputContract).toContain('userId');
    expect(edge.targetInputContract).toContain('userId');
    expect(edge.notes).toContain('idempotent');
  });
});

describe('bacToArchitecture round-trip', () => {
  it('projects BAC back to components and connections', () => {
    const bac = deriveBrickAppContract({
      appName: 'round-trip-app',
      components: [
        { id: 'A', name: 'Frontend', type: 'static_site', connections: ['B'], spec: { description: 'React SPA', inputs: 'User interaction', outputs: 'API calls' } },
        { id: 'B', name: 'API', type: 'service', connections: ['C'], spec: { description: 'REST API', inputs: 'HTTP requests', outputs: 'JSON responses' } },
        { id: 'C', name: 'Database', type: 'database', connections: [], spec: { description: 'PostgreSQL', inputs: 'SQL queries', outputs: 'Result sets' } },
      ],
    });

    const projected = bacToArchitecture(bac);

    expect(projected.components).toHaveLength(3);
    expect(projected.components.map(c => c.id).sort()).toEqual(['A', 'B', 'C']);

    const frontend = projected.components.find(c => c.id === 'A')!;
    expect(frontend.name).toBe('Frontend');
    expect(frontend.type).toBe('static_site');
    expect(frontend.spec.description).toBe('React SPA');
    expect(frontend.spec.inputs).toBe('User interaction');
    expect(frontend.spec.outputs).toBe('API calls');
    expect(frontend.connections).toContain('B');

    expect(projected.connections).toHaveLength(2); // A->B, B->C
    const abConn = projected.connections.find(c => c.from === 'A' && c.to === 'B');
    expect(abConn).toBeDefined();
  });

  it('preserves x/y positions in node contracts', () => {
    const bac = deriveBrickAppContract({
      appName: 'positioned-app',
      components: [
        { id: 'A', name: 'Service', type: 'service', connections: [] },
      ],
    });

    // Manually set position
    bac.systemContracts.nodes[0].x = 100;
    bac.systemContracts.nodes[0].y = 200;

    const projected = bacToArchitecture(bac);
    expect(projected.components[0].x).toBe(100);
    expect(projected.components[0].y).toBe(200);
  });

  it('round-trips TBD values by omitting them in spec', () => {
    const bac = deriveBrickAppContract({
      appName: 'tbd-app',
      components: [
        { id: 'A', name: 'Service', type: 'service', connections: [] },
      ],
    });

    // Defaults will be TBD
    expect(bac.systemContracts.nodes[0].inputContract).toBe('TBD');
    const projected = bacToArchitecture(bac);
    expect(projected.components[0].spec.inputs).toBeUndefined();
  });
});

describe('applyBACPatch', () => {
  function makeTestBAC(): BrickAppContract {
    return deriveBrickAppContract({
      appName: 'patch-test',
      components: [
        { id: 'A', name: 'API', type: 'service', connections: ['B'], spec: { inputs: 'HTTP requests', outputs: 'JSON' } },
        { id: 'B', name: 'DB', type: 'database', connections: [] },
      ],
    });
  }

  it('updates a node contract field', () => {
    const bac = makeTestBAC();
    const patched = applyBACPatch(bac, {
      op: 'update_node_contract',
      nodeId: 'A',
      fields: { inputContract: '{ method: string, path: string, body: unknown }' },
    });

    expect(patched.systemContracts.nodes.find(n => n.nodeId === 'A')!.inputContract).toBe('{ method: string, path: string, body: unknown }');
    // Original unchanged
    expect(bac.systemContracts.nodes.find(n => n.nodeId === 'A')!.inputContract).toBe('HTTP requests');
  });

  it('updates an edge contract field', () => {
    const bac = makeTestBAC();
    const patched = applyBACPatch(bac, {
      op: 'update_edge_contract',
      edgeId: 'A->B',
      fields: { sourceOutputContract: '{ userId: string }', notes: 'Primary key lookup' },
    });

    const edge = patched.systemContracts.edges.find(e => e.id === 'A->B')!;
    expect(edge.sourceOutputContract).toBe('{ userId: string }');
    expect(edge.notes).toBe('Primary key lookup');
  });

  it('updates metadata', () => {
    const bac = makeTestBAC();
    // Force a different updatedAt by backdating the original
    bac.metadata.updatedAt = '2020-01-01T00:00:00.000Z';
    const patched = applyBACPatch(bac, {
      op: 'update_metadata',
      fields: { name: 'new-name', vertical: 'fintech' },
    });

    expect(patched.metadata.name).toBe('new-name');
    expect(patched.metadata.vertical).toBe('fintech');
    expect(patched.metadata.updatedAt).not.toBe('2020-01-01T00:00:00.000Z');
  });

  it('updates product outcome', () => {
    const bac = makeTestBAC();
    const patched = applyBACPatch(bac, {
      op: 'update_product_outcome',
      fields: { summary: 'A better API' },
    });

    expect(patched.productOutcome.summary).toBe('A better API');
  });

  it('adds and removes nodes', () => {
    const bac = makeTestBAC();
    const withNode = applyBACPatch(bac, {
      op: 'add_node',
      node: { nodeId: 'C', nodeName: 'Cache', nodeType: 'cache', inputContract: 'key', outputContract: 'value' },
    });
    expect(withNode.systemContracts.nodes).toHaveLength(3);

    const withoutNode = applyBACPatch(withNode, {
      op: 'remove_node',
      nodeId: 'C',
    });
    expect(withoutNode.systemContracts.nodes).toHaveLength(2);
  });

  it('removes edges when removing a node', () => {
    const bac = makeTestBAC();
    expect(bac.systemContracts.edges.length).toBeGreaterThan(0);

    const patched = applyBACPatch(bac, { op: 'remove_node', nodeId: 'A' });
    expect(patched.systemContracts.edges).toHaveLength(0);
  });

  it('adds and removes edges', () => {
    const bac = makeTestBAC();
    const withEdge = applyBACPatch(bac, {
      op: 'add_edge',
      edge: { id: 'B->A', fromNodeId: 'B', toNodeId: 'A', sourceOutputContract: 'data', targetInputContract: 'data' },
    });
    expect(withEdge.systemContracts.edges).toHaveLength(2);

    const withoutEdge = applyBACPatch(withEdge, { op: 'remove_edge', edgeId: 'B->A' });
    expect(withoutEdge.systemContracts.edges).toHaveLength(1);
  });
});

describe('validateContractCompleteness', () => {
  it('returns complete when all contracts are filled', () => {
    const bac = deriveBrickAppContract({
      appName: 'complete-app',
      components: [
        { id: 'A', name: 'API', type: 'service', connections: ['B'], spec: { inputs: 'HTTP requests', outputs: 'JSON responses' } },
        { id: 'B', name: 'DB', type: 'database', connections: [], spec: { inputs: 'SQL queries', outputs: 'Result sets' } },
      ],
      connections: [
        { from: 'A', to: 'B', contract: { sourceOutput: 'Query params', targetInput: 'Query params' } },
      ],
    });

    const result = validateContractCompleteness(bac);
    expect(result.complete).toBe(true);
    expect(result.incompleteNodes).toHaveLength(0);
    expect(result.incompleteEdges).toHaveLength(0);
  });

  it('detects TBD node contracts', () => {
    const bac = deriveBrickAppContract({
      appName: 'incomplete-app',
      components: [
        { id: 'A', name: 'API', type: 'service', connections: [] },
      ],
    });

    // Default derivation sets TBD for nodes without specs
    const result = validateContractCompleteness(bac);
    expect(result.complete).toBe(false);
    expect(result.incompleteNodes).toHaveLength(1);
    expect(result.incompleteNodes[0].nodeId).toBe('A');
    expect(result.incompleteNodes[0].fields).toContain('inputContract');
    expect(result.incompleteNodes[0].fields).toContain('outputContract');
  });

  it('detects TBD edge contracts', () => {
    const bac = deriveBrickAppContract({
      appName: 'edge-incomplete-app',
      components: [
        { id: 'A', name: 'API', type: 'service', connections: ['B'], spec: { inputs: 'HTTP', outputs: 'JSON' } },
        { id: 'B', name: 'DB', type: 'database', connections: [], spec: { inputs: 'SQL', outputs: 'Data' } },
      ],
    });

    // Edge contracts default to node contracts (which are filled), so they should be complete
    // But if we manually set them to TBD...
    bac.systemContracts.edges[0].sourceOutputContract = 'TBD';
    const result = validateContractCompleteness(bac);
    expect(result.complete).toBe(false);
    expect(result.incompleteEdges).toHaveLength(1);
    expect(result.incompleteEdges[0].fields).toContain('sourceOutputContract');
  });

  it('treats empty strings as incomplete', () => {
    const bac = deriveBrickAppContract({
      appName: 'empty-app',
      components: [
        { id: 'A', name: 'API', type: 'service', connections: [], spec: { inputs: '', outputs: '' } },
      ],
    });

    const result = validateContractCompleteness(bac);
    expect(result.complete).toBe(false);
  });
});

describe('intent-to-BAC structural validity', () => {
  it('INTENT_TO_BAC_PROMPT contains BAC schema definition', () => {
    expect(INTENT_TO_BAC_PROMPT).toContain('systemContracts');
    expect(INTENT_TO_BAC_PROMPT).toContain('nodes');
    expect(INTENT_TO_BAC_PROMPT).toContain('edges');
    expect(INTENT_TO_BAC_PROMPT).toContain('inputContract');
    expect(INTENT_TO_BAC_PROMPT).toContain('outputContract');
    expect(INTENT_TO_BAC_PROMPT).toContain('sourceOutputContract');
    expect(INTENT_TO_BAC_PROMPT).toContain('targetInputContract');
    expect(INTENT_TO_BAC_PROMPT).toContain('productOutcome');
    expect(INTENT_TO_BAC_PROMPT).toContain('domainModel');
    expect(INTENT_TO_BAC_PROMPT).toContain('workflows');
    expect(INTENT_TO_BAC_PROMPT).toContain('aiOpportunityAssessment');
  });

  it('validates a well-formed BAC produced from hypothetical LLM output', () => {
    // Simulate what the LLM would produce from the INTENT_TO_BAC_PROMPT
    const simulatedBac: BrickAppContract = {
      version: '1.0',
      metadata: {
        name: 'coaching-crm',
        vertical: 'saas',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        source: 'derived',
      },
      productOutcome: {
        summary: 'A CRM for coaches to manage clients and sessions',
        userJobs: ['Track client sessions', 'Manage coaching relationships'],
        nonGoals: ['Video conferencing'],
      },
      domainModel: {
        entities: [
          { id: 'client', name: 'Client', description: 'A coaching client' },
          { id: 'session', name: 'Session', description: 'A coaching session' },
        ],
      },
      workflows: [
        { id: 'wf-onboard', name: 'Client Onboarding', description: 'Register new client', components: ['A', 'B'] },
      ],
      integrations: [],
      runtime: { region: 'auto', constraints: [] },
      observability: { qualityGates: [] },
      systemContracts: {
        nodes: [
          { nodeId: 'A', nodeName: 'Web App', nodeType: 'static_site', description: 'React SPA', inputContract: '{ route: string }', outputContract: '{ html: string }' },
          { nodeId: 'B', nodeName: 'API Server', nodeType: 'service', description: 'REST API', inputContract: '{ method: string, path: string, body: unknown }', outputContract: '{ status: number, data: unknown }' },
          { nodeId: 'C', nodeName: 'Database', nodeType: 'database', description: 'PostgreSQL', inputContract: '{ query: string, params: unknown[] }', outputContract: '{ rows: unknown[] }' },
        ],
        edges: [
          { id: 'A->B', fromNodeId: 'A', toNodeId: 'B', label: 'API calls', sourceOutputContract: '{ method: string, path: string }', targetInputContract: '{ method: string, path: string, body: unknown }' },
          { id: 'B->C', fromNodeId: 'B', toNodeId: 'C', label: 'DB queries', sourceOutputContract: '{ query: string }', targetInputContract: '{ query: string, params: unknown[] }' },
        ],
      },
      platformPolicy: { modelRouter: 'openrouter', defaultEditStrategy: 'targeted_edit' },
      aiOpportunityAssessment: [
        { workflowId: 'wf-onboard', leverage: 'low', proposedMode: 'none_for_now', expectedValue: 'N/A', risks: [], decision: 'exclude', reason: 'Simple CRUD', revisitTrigger: 'When AI coaching is needed' },
      ],
      aiFlows: [],
    };

    const validation = validateBrickAppContract(simulatedBac);
    expect(validation.valid).toBe(true);

    // Verify contract completeness
    const completeness = validateContractCompleteness(simulatedBac);
    expect(completeness.complete).toBe(true);

    // Verify round-trip through bacToArchitecture
    const projected = bacToArchitecture(simulatedBac);
    expect(projected.components).toHaveLength(3);
    expect(projected.connections).toHaveLength(2);
    expect(projected.components.map(c => c.id).sort()).toEqual(['A', 'B', 'C']);
  });

  it('detects invalid BAC from hypothetical LLM output', () => {
    // Simulate a BAC with missing required fields
    const incompleteBac: BrickAppContract = {
      version: '1.0',
      metadata: { name: 'test', vertical: '', createdAt: '', updatedAt: '', source: 'derived' },
      productOutcome: { summary: '', userJobs: [], nonGoals: [] },
      domainModel: { entities: [] },
      workflows: [
        { id: 'wf-1', name: 'Test', description: 'Test', components: ['A'] },
      ],
      integrations: [],
      runtime: { region: 'auto', constraints: [] },
      observability: { qualityGates: [] },
      systemContracts: {
        nodes: [
          { nodeId: 'A', nodeName: 'API', nodeType: 'service', inputContract: 'TBD', outputContract: 'TBD' },
        ],
        edges: [],
      },
      platformPolicy: { modelRouter: 'openrouter', defaultEditStrategy: 'targeted_edit' },
      aiOpportunityAssessment: [
        { workflowId: 'wf-1', leverage: 'low', proposedMode: 'none_for_now', expectedValue: '', risks: [], decision: 'defer_to_v2', reason: 'Later', revisitTrigger: undefined },
      ],
      aiFlows: [],
    };

    // Should fail validation because defer_to_v2 missing revisitTrigger
    const validation = validateBrickAppContract(incompleteBac);
    expect(validation.valid).toBe(false);

    // Should be incomplete because of TBD contracts
    const completeness = validateContractCompleteness(incompleteBac);
    expect(completeness.complete).toBe(false);
    expect(completeness.incompleteNodes).toHaveLength(1);
  });
});
