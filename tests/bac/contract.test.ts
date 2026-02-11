import { describe, expect, it } from 'vitest';
import { deriveBrickAppContract, validateBrickAppContract } from '../../src/bac/index.js';

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
