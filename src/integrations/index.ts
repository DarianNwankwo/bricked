/**
 * Integrations Module
 *
 * First-class integrations for external services.
 * This is a core differentiator for the coaching/fitness vertical.
 *
 * Usage:
 *   import { getIntegration, createIntegrationNode } from './integrations';
 *
 *   const calendly = getIntegration('calendly');
 *   const node = createIntegrationNode('calendly', 'scheduling-1');
 */

export {
  // Registry functions
  registerIntegration,
  getIntegration,
  getAllIntegrations,
  getIntegrationsByCategory,
  hasIntegration,
  createIntegrationNode,
  getOutputPorts,
  getInputPorts,
  // Integration definitions
  calendlyIntegration,
  calComIntegration,
} from './registry.js';

// Re-export types for convenience
export type {
  IntegrationDefinition,
  IntegrationType,
  GraphNode,
  GraphEdge,
  Graph,
  Port,
  PortSchema,
  PortRef,
} from '../types/graph.js';
