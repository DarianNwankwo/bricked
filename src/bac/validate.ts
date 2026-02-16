import type { BrickAppContract } from '../types/bac.js';

export interface BACValidationResult {
  valid: boolean;
  errors: string[];
}

function nonEmpty(value: string | undefined | null): boolean {
  return Boolean(value && value.trim().length > 0);
}

export function validateBrickAppContract(contract: BrickAppContract): BACValidationResult {
  const errors: string[] = [];

  if (!contract || contract.version !== '1.0') {
    errors.push('version must be "1.0"');
  }

  if (!nonEmpty(contract.metadata?.name)) {
    errors.push('metadata.name is required');
  }

  if (!contract.productOutcome || !nonEmpty(contract.productOutcome.summary)) {
    errors.push('productOutcome.summary is required');
  }

  const workflowIds = new Set((contract.workflows || []).map(w => w.id));
  if (workflowIds.size === 0) {
    errors.push('at least one workflow is required');
  }

  for (const workflow of contract.workflows || []) {
    if (!nonEmpty(workflow.id) || !nonEmpty(workflow.name)) {
      errors.push('workflow id and name are required');
    }
  }

  const aiByWorkflow = new Map(
    (contract.aiOpportunityAssessment || []).map(assessment => [assessment.workflowId, assessment])
  );

  for (const workflowId of workflowIds) {
    const assessment = aiByWorkflow.get(workflowId);
    if (!assessment) {
      errors.push(`missing aiOpportunityAssessment for workflow ${workflowId}`);
      continue;
    }

    if (assessment.proposedMode === 'none_for_now' && assessment.decision === 'include_in_v1') {
      errors.push(`workflow ${workflowId} has include_in_v1 with proposedMode none_for_now`);
    }

    if (!nonEmpty(assessment.reason)) {
      errors.push(`workflow ${workflowId} requires aiOpportunityAssessment.reason`);
    }

    if (
      (assessment.decision === 'defer_to_v2' || assessment.decision === 'exclude') &&
      !nonEmpty(assessment.revisitTrigger)
    ) {
      errors.push(`workflow ${workflowId} requires revisitTrigger when decision is ${assessment.decision}`);
    }
  }

  if (contract.platformPolicy?.modelRouter !== 'openrouter' && contract.platformPolicy?.modelRouter !== 'none') {
    errors.push('platformPolicy.modelRouter must be "openrouter" or "none"');
  }

  if (
    contract.platformPolicy?.defaultEditStrategy !== 'targeted_edit' &&
    contract.platformPolicy?.defaultEditStrategy !== 'full_regeneration'
  ) {
    errors.push('platformPolicy.defaultEditStrategy must be targeted_edit or full_regeneration');
  }

  if (!contract.systemContracts || !Array.isArray(contract.systemContracts.nodes) || contract.systemContracts.nodes.length === 0) {
    errors.push('systemContracts.nodes is required and must contain at least one node contract');
  } else {
    const nodeIds = new Set<string>();
    for (const node of contract.systemContracts.nodes) {
      if (!nonEmpty(node.nodeId) || !nonEmpty(node.nodeName) || !nonEmpty(node.nodeType)) {
        errors.push('systemContracts.nodes entries require nodeId, nodeName, and nodeType');
      }
      if (!nonEmpty(node.inputContract)) {
        errors.push(`node ${node.nodeId} requires inputContract`);
      }
      if (!nonEmpty(node.outputContract)) {
        errors.push(`node ${node.nodeId} requires outputContract`);
      }
      nodeIds.add(node.nodeId);
    }

    if (!contract.systemContracts.edges || !Array.isArray(contract.systemContracts.edges)) {
      errors.push('systemContracts.edges must be an array');
    } else {
      const edgeIds = new Set<string>();
      for (const edge of contract.systemContracts.edges) {
        if (!nonEmpty(edge.id)) {
          errors.push('systemContracts.edges entries require id');
        } else if (edgeIds.has(edge.id)) {
          errors.push(`duplicate edge contract id: ${edge.id}`);
        } else {
          edgeIds.add(edge.id);
        }

        if (!nodeIds.has(edge.fromNodeId)) {
          errors.push(`edge ${edge.id} has unknown fromNodeId ${edge.fromNodeId}`);
        }
        if (!nodeIds.has(edge.toNodeId)) {
          errors.push(`edge ${edge.id} has unknown toNodeId ${edge.toNodeId}`);
        }
        if (!nonEmpty(edge.sourceOutputContract)) {
          errors.push(`edge ${edge.id} requires sourceOutputContract`);
        }
        if (!nonEmpty(edge.targetInputContract)) {
          errors.push(`edge ${edge.id} requires targetInputContract`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export interface ContractCompletenessResult {
  complete: boolean;
  incompleteNodes: Array<{ nodeId: string; nodeName: string; fields: string[] }>;
  incompleteEdges: Array<{ edgeId: string; fields: string[] }>;
}

/**
 * Check whether all node and edge contracts are fully specified
 * (no 'TBD' or empty values). This must pass before code generation.
 */
export function validateContractCompleteness(contract: BrickAppContract): ContractCompletenessResult {
  const incompleteNodes: ContractCompletenessResult['incompleteNodes'] = [];
  const incompleteEdges: ContractCompletenessResult['incompleteEdges'] = [];

  for (const node of contract.systemContracts?.nodes || []) {
    const fields: string[] = [];
    if (isTBDOrEmpty(node.inputContract)) fields.push('inputContract');
    if (isTBDOrEmpty(node.outputContract)) fields.push('outputContract');
    if (fields.length > 0) {
      incompleteNodes.push({ nodeId: node.nodeId, nodeName: node.nodeName, fields });
    }
  }

  for (const edge of contract.systemContracts?.edges || []) {
    const fields: string[] = [];
    if (isTBDOrEmpty(edge.sourceOutputContract)) fields.push('sourceOutputContract');
    if (isTBDOrEmpty(edge.targetInputContract)) fields.push('targetInputContract');
    if (fields.length > 0) {
      incompleteEdges.push({ edgeId: edge.id, fields });
    }
  }

  return {
    complete: incompleteNodes.length === 0 && incompleteEdges.length === 0,
    incompleteNodes,
    incompleteEdges,
  };
}

function isTBDOrEmpty(value: string | undefined | null): boolean {
  if (!value) return true;
  const trimmed = value.trim().toLowerCase();
  return trimmed === '' || trimmed === 'tbd';
}
