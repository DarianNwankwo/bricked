/**
 * Integration Registry
 *
 * Central registry for all integration definitions.
 * Integrations are first-class citizens with predefined ports and contracts.
 */
import type { IntegrationDefinition, IntegrationType, GraphNode, Port } from '../types/graph.js';
/**
 * Register an integration definition.
 */
export declare function registerIntegration(definition: IntegrationDefinition): void;
/**
 * Get an integration definition by type.
 */
export declare function getIntegration(type: IntegrationType): IntegrationDefinition | undefined;
/**
 * Get all registered integrations.
 */
export declare function getAllIntegrations(): IntegrationDefinition[];
/**
 * Get integrations by category.
 */
export declare function getIntegrationsByCategory(category: IntegrationDefinition['category']): IntegrationDefinition[];
/**
 * Check if an integration type is registered.
 */
export declare function hasIntegration(type: string): type is IntegrationType;
/**
 * Create a GraphNode from an integration definition.
 * This is how integrations become nodes in the graph.
 */
export declare function createIntegrationNode(type: IntegrationType, id: string, config?: Record<string, unknown>): GraphNode | null;
/**
 * Get the available output ports for an integration.
 * Useful for UI to show what can be connected.
 */
export declare function getOutputPorts(type: IntegrationType): Port[];
/**
 * Get the available input ports for an integration.
 */
export declare function getInputPorts(type: IntegrationType): Port[];
export { calendlyIntegration, calComIntegration, } from './scheduling/index.js';
//# sourceMappingURL=registry.d.ts.map