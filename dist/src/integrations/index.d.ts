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
export { registerIntegration, getIntegration, getAllIntegrations, getIntegrationsByCategory, hasIntegration, createIntegrationNode, getOutputPorts, getInputPorts, calendlyIntegration, calComIntegration, } from './registry.js';
export type { IntegrationDefinition, IntegrationType, GraphNode, GraphEdge, Graph, Port, PortSchema, PortRef, } from '../types/graph.js';
//# sourceMappingURL=index.d.ts.map