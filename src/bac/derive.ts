import type {
  AIOpportunityAssessment,
  AIOpportunityDecision,
  AIOpportunityMode,
  BACEdgeContract,
  AIFlowSpec,
  AIFlowType,
  AILeverage,
  BACEntity,
  BACIntegration,
  BACNodeContract,
  BACWorkflow,
  BACPatch,
  BrickAppContract,
} from '../types/bac.js';

export interface BACComponent {
  id: string;
  name: string;
  type: string;
  connections?: string[];
  spec?: {
    description?: string;
    inputs?: string;
    outputs?: string;
    notes?: string;
  };
}

export interface BACConnection {
  from: string;
  to: string;
  label?: string;
  contract?: {
    sourceOutput?: string;
    targetInput?: string;
    notes?: string;
  };
}

export interface DeriveBACParams {
  appName: string;
  intent?: string;
  region?: string;
  components: BACComponent[];
  connections?: BACConnection[];
  existing?: BrickAppContract | null;
}

function nowIso(): string {
  return new Date().toISOString();
}

function toId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function workflowId(component: BACComponent): string {
  return `wf-${toId(component.name || component.id || 'workflow')}`;
}

function connectionId(from: string, to: string): string {
  return `${from}->${to}`;
}

function deriveConnectionsFromComponents(components: BACComponent[]): BACConnection[] {
  const seen = new Set<string>();
  const connections: BACConnection[] = [];

  for (const component of components) {
    for (const to of component.connections || []) {
      const id = connectionId(component.id, to);
      if (seen.has(id)) continue;
      seen.add(id);
      connections.push({ from: component.id, to });
    }
  }

  return connections;
}

function inferLeverage(component: BACComponent): AILeverage {
  const haystack = `${component.name} ${component.spec?.description || ''}`.toLowerCase();
  if (haystack.match(/\b(ai|agent|assistant|copilot|llm|model)\b/)) return 'high';
  if (component.type === 'static_site' || component.type === 'service' || component.type === 'worker') return 'medium';
  return 'low';
}

function inferMode(component: BACComponent, leverage: AILeverage): AIOpportunityMode {
  if (leverage === 'low') return 'none_for_now';
  if (component.type === 'worker' || component.type === 'job' || component.type === 'queue') return 'agent_workflow';
  if (component.type === 'database' || component.type === 'cache' || component.type === 'search') return 'backend_ai_service';
  return 'chat_agent';
}

function inferDecision(leverage: AILeverage): AIOpportunityDecision {
  if (leverage === 'high') return 'include_in_v1';
  if (leverage === 'medium') return 'defer_to_v2';
  return 'exclude';
}

function deriveWorkflows(components: BACComponent[]): BACWorkflow[] {
  return components
    .filter(c => c.type !== 'database' && c.type !== 'cache' && c.type !== 'storage')
    .map(c => ({
      id: workflowId(c),
      name: c.name,
      description: c.spec?.description || `${c.name} workflow`,
      components: [c.id, ...(c.connections || [])],
    }));
}

function deriveEntities(components: BACComponent[]): BACEntity[] {
  const entities: BACEntity[] = components
    .filter(c => c.type === 'database' || c.type === 'cache' || c.type === 'search')
    .map(c => ({
      id: `entity-${toId(c.name || c.id)}`,
      name: c.name,
      description: `${c.name} managed data entity`,
    }));

  if (entities.length === 0) {
    entities.push({
      id: 'entity-core-record',
      name: 'CoreRecord',
      description: 'Primary domain entity inferred from architecture',
    });
  }

  return entities;
}

function deriveIntegrations(components: BACComponent[]): BACIntegration[] {
  return components
    .filter(c => c.type === 'third_party' || c.type === 'payment' || c.type === 'email' || c.type === 'analytics')
    .map(c => ({
      id: `integration-${toId(c.name || c.id)}`,
      name: c.name,
      category: 'external' as const,
      purpose: c.spec?.description || `${c.name} integration`,
    }));
}

function deriveAIOpportunities(
  workflows: BACWorkflow[],
  components: BACComponent[],
  existing: BrickAppContract | null
): AIOpportunityAssessment[] {
  const existingByWorkflow = new Map(
    (existing?.aiOpportunityAssessment || []).map(assessment => [assessment.workflowId, assessment])
  );

  return workflows.map(workflow => {
    const component = components.find(c => c.name === workflow.name) || components.find(c => c.id === workflow.components[0]);
    const leverage = component ? inferLeverage(component) : 'medium';
    const proposedMode = component ? inferMode(component, leverage) : 'none_for_now';
    const decision = inferDecision(leverage);
    const preserved = existingByWorkflow.get(workflow.id);

    return {
      workflowId: workflow.id,
      leverage,
      proposedMode: preserved?.proposedMode || proposedMode,
      expectedValue:
        preserved?.expectedValue ||
        `Improve ${workflow.name} throughput and quality through AI-assisted execution`,
      risks: preserved?.risks || ['hallucination', 'latency', 'context quality'],
      decision: preserved?.decision || decision,
      reason:
        preserved?.reason ||
        (decision === 'include_in_v1'
          ? 'High leverage and strong user-facing impact'
          : decision === 'defer_to_v2'
            ? 'Valuable but can follow core workflow stabilization'
            : 'Low leverage for v1 and better solved deterministically'),
      revisitTrigger:
        preserved?.revisitTrigger ||
        (decision === 'include_in_v1' ? undefined : 'Revisit when workflow volume or friction increases'),
    };
  });
}

function deriveAIFlows(assessments: AIOpportunityAssessment[]): AIFlowSpec[] {
  const flows: AIFlowSpec[] = [];

  for (const assessment of assessments) {
    if (assessment.decision !== 'include_in_v1') continue;
    if (assessment.proposedMode === 'none_for_now') continue;

    const type = assessment.proposedMode as AIFlowType;
    const flowId = `ai-${assessment.workflowId}`;

    flows.push({
      id: flowId,
      name: `${assessment.workflowId} AI flow`,
      type,
      trigger: type === 'agent_workflow' ? 'event' : 'user_action',
      contextSources: ['workflow_state', 'project_memory'],
      tools: type === 'backend_ai_service'
        ? [{ name: 'vector_search', scope: 'read' }]
        : [{ name: 'project_editor', scope: 'write' }],
      outputContract: {
        format: 'structured_event',
        fields: ['summary', 'actions', 'confidence'],
      },
      guardrails: ['Respect role permissions', 'Do not execute destructive actions without confirmation'],
      fallback: 'human_review',
      successMetrics: ['latency_p95', 'task_completion_rate', 'edit_acceptance_rate'],
      audit: {
        logInputs: true,
        logOutputs: true,
        logActions: true,
      },
    });
  }

  return flows;
}

function deriveSystemNodeContracts(
  components: BACComponent[],
  existing: BrickAppContract | null
): BACNodeContract[] {
  const existingByNodeId = new Map(
    (existing?.systemContracts?.nodes || []).map(node => [node.nodeId, node])
  );

  return components.map(component => {
    const preserved = existingByNodeId.get(component.id);

    return {
      nodeId: component.id,
      nodeName: component.name,
      nodeType: component.type,
      description: component.spec?.description || preserved?.description,
      inputContract: component.spec?.inputs || preserved?.inputContract || 'TBD',
      outputContract: component.spec?.outputs || preserved?.outputContract || 'TBD',
      notes: component.spec?.notes || preserved?.notes,
    };
  });
}

function deriveSystemEdgeContracts(
  connections: BACConnection[],
  nodeContracts: BACNodeContract[],
  existing: BrickAppContract | null
): BACEdgeContract[] {
  const nodeById = new Map(nodeContracts.map(node => [node.nodeId, node]));
  const existingByEdgeId = new Map(
    (existing?.systemContracts?.edges || []).map(edge => [edge.id, edge])
  );

  return connections.map(connection => {
    const id = connectionId(connection.from, connection.to);
    const preserved = existingByEdgeId.get(id);
    const sourceNode = nodeById.get(connection.from);
    const targetNode = nodeById.get(connection.to);

    return {
      id,
      fromNodeId: connection.from,
      toNodeId: connection.to,
      label: connection.label || preserved?.label,
      sourceOutputContract:
        connection.contract?.sourceOutput ||
        preserved?.sourceOutputContract ||
        sourceNode?.outputContract ||
        'TBD',
      targetInputContract:
        connection.contract?.targetInput ||
        preserved?.targetInputContract ||
        targetNode?.inputContract ||
        'TBD',
      notes:
        connection.contract?.notes ||
        preserved?.notes,
    };
  });
}

export function deriveBrickAppContract(params: DeriveBACParams): BrickAppContract {
  const { appName, intent, region, components, connections, existing } = params;
  const createdAt = existing?.metadata.createdAt || nowIso();
  const updatedAt = nowIso();
  const normalizedConnections = connections || deriveConnectionsFromComponents(components);

  const workflows = deriveWorkflows(components);
  const aiOpportunityAssessment = deriveAIOpportunities(workflows, components, existing || null);
  const aiFlows = deriveAIFlows(aiOpportunityAssessment);
  const systemNodeContracts = deriveSystemNodeContracts(components, existing || null);
  const systemEdgeContracts = deriveSystemEdgeContracts(normalizedConnections, systemNodeContracts, existing || null);

  return {
    version: '1.0',
    metadata: {
      name: appName || existing?.metadata.name || 'brick-app',
      vertical: existing?.metadata.vertical,
      createdAt,
      updatedAt,
      source: 'derived',
    },
    productOutcome: {
      summary: existing?.productOutcome.summary || intent || `Build and operate ${appName}`,
      userJobs: existing?.productOutcome.userJobs || ['Design application workflows', 'Deploy and iterate quickly'],
      nonGoals: existing?.productOutcome.nonGoals || ['Manual infrastructure authoring'],
    },
    domainModel: {
      entities: deriveEntities(components),
    },
    workflows,
    integrations: deriveIntegrations(components),
    runtime: {
      region: region || existing?.runtime.region,
      constraints: existing?.runtime.constraints || [
        { key: 'deployment_platform', value: 'digitalocean_app_platform' },
        { key: 'change_strategy', value: 'targeted_edit_default' },
      ],
    },
    observability: {
      qualityGates: existing?.observability.qualityGates || [
        {
          id: 'gate-ai-audit',
          name: 'AI Audit Trail',
          description: 'All AI-assisted actions must be logged for review',
          required: true,
        },
        {
          id: 'gate-release-check',
          name: 'Release Validation',
          description: 'Build and validation checks pass before deploy',
          required: true,
        },
      ],
    },
    systemContracts: {
      nodes: systemNodeContracts,
      edges: systemEdgeContracts,
    },
    platformPolicy: {
      modelRouter: 'openrouter',
      defaultEditStrategy: 'targeted_edit',
    },
    aiOpportunityAssessment,
    aiFlows,
  };
}

/**
 * Project a BAC back to architecture components and connections.
 * This is the reverse of deriveBrickAppContract — used to sync graph
 * when BAC is edited directly.
 */
export function bacToArchitecture(bac: BrickAppContract): {
  components: Array<{
    id: string;
    name: string;
    type: string;
    x?: number;
    y?: number;
    spec: {
      description?: string;
      inputs?: string;
      outputs?: string;
      notes?: string;
    };
    connections: string[];
  }>;
  connections: Array<{
    from: string;
    to: string;
    label?: string;
    contract?: {
      sourceOutput?: string;
      targetInput?: string;
      notes?: string;
    };
  }>;
} {
  const nodes = bac.systemContracts?.nodes || [];
  const edges = bac.systemContracts?.edges || [];

  // Build adjacency from edges
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    const list = adjacency.get(edge.fromNodeId) || [];
    list.push(edge.toNodeId);
    adjacency.set(edge.fromNodeId, list);
  }

  const components = nodes.map(node => ({
    id: node.nodeId,
    name: node.nodeName,
    type: node.nodeType,
    x: node.x,
    y: node.y,
    spec: {
      description: node.description,
      inputs: node.inputContract !== 'TBD' ? node.inputContract : undefined,
      outputs: node.outputContract !== 'TBD' ? node.outputContract : undefined,
      notes: node.notes,
    },
    connections: adjacency.get(node.nodeId) || [],
  }));

  const connections = edges.map(edge => ({
    from: edge.fromNodeId,
    to: edge.toNodeId,
    label: edge.label,
    contract: {
      sourceOutput: edge.sourceOutputContract !== 'TBD' ? edge.sourceOutputContract : undefined,
      targetInput: edge.targetInputContract !== 'TBD' ? edge.targetInputContract : undefined,
      notes: edge.notes,
    },
  }));

  return { components, connections };
}

/**
 * Apply a structured patch to a BAC, returning a new BAC.
 * Immutable — never mutates the input.
 */
export function applyBACPatch(bac: BrickAppContract, patch: BACPatch): BrickAppContract {
  const result: BrickAppContract = JSON.parse(JSON.stringify(bac));
  result.metadata.updatedAt = new Date().toISOString();

  switch (patch.op) {
    case 'update_node_contract': {
      const node = result.systemContracts.nodes.find(n => n.nodeId === patch.nodeId);
      if (node) {
        Object.assign(node, patch.fields);
      }
      break;
    }
    case 'update_edge_contract': {
      const edge = result.systemContracts.edges.find(e => e.id === patch.edgeId);
      if (edge) {
        Object.assign(edge, patch.fields);
      }
      break;
    }
    case 'update_metadata': {
      Object.assign(result.metadata, patch.fields);
      break;
    }
    case 'update_product_outcome': {
      Object.assign(result.productOutcome, patch.fields);
      break;
    }
    case 'add_node': {
      result.systemContracts.nodes.push(patch.node);
      break;
    }
    case 'remove_node': {
      result.systemContracts.nodes = result.systemContracts.nodes.filter(
        n => n.nodeId !== patch.nodeId
      );
      // Also remove edges referencing this node
      result.systemContracts.edges = result.systemContracts.edges.filter(
        e => e.fromNodeId !== patch.nodeId && e.toNodeId !== patch.nodeId
      );
      break;
    }
    case 'add_edge': {
      result.systemContracts.edges.push(patch.edge);
      break;
    }
    case 'remove_edge': {
      result.systemContracts.edges = result.systemContracts.edges.filter(
        e => e.id !== patch.edgeId
      );
      break;
    }
  }

  return result;
}
