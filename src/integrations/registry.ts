/**
 * Integration Registry
 *
 * Central registry for all integration definitions.
 * Integrations are first-class citizens with predefined ports and contracts.
 */

import type {
  IntegrationDefinition,
  IntegrationType,
  GraphNode,
  Port,
} from '../types/graph.js';

// Import integration definitions
import { calendlyIntegration, calComIntegration } from './scheduling/index.js';

// =============================================================================
// Registry
// =============================================================================

/**
 * Map of all registered integrations.
 */
const integrations = new Map<IntegrationType, IntegrationDefinition>();

/**
 * Register an integration definition.
 */
export function registerIntegration(definition: IntegrationDefinition): void {
  integrations.set(definition.type, definition);
}

/**
 * Get an integration definition by type.
 */
export function getIntegration(type: IntegrationType): IntegrationDefinition | undefined {
  return integrations.get(type);
}

/**
 * Get all registered integrations.
 */
export function getAllIntegrations(): IntegrationDefinition[] {
  return Array.from(integrations.values());
}

/**
 * Get integrations by category.
 */
export function getIntegrationsByCategory(
  category: IntegrationDefinition['category']
): IntegrationDefinition[] {
  return getAllIntegrations().filter((i) => i.category === category);
}

/**
 * Check if an integration type is registered.
 */
export function hasIntegration(type: string): type is IntegrationType {
  return integrations.has(type as IntegrationType);
}

// =============================================================================
// Node Factory
// =============================================================================

/**
 * Create a GraphNode from an integration definition.
 * This is how integrations become nodes in the graph.
 */
export function createIntegrationNode(
  type: IntegrationType,
  id: string,
  config: Record<string, unknown> = {}
): GraphNode | null {
  const definition = getIntegration(type);
  if (!definition) {
    return null;
  }

  return {
    id,
    name: definition.name,
    type: definition.type,
    category: 'integration',
    ports: {
      inputs: definition.ports.inputs.map((p) => ({ ...p })),
      outputs: definition.ports.outputs.map((p) => ({ ...p })),
    },
    config: {
      integrationId: config.integrationId as string | undefined,
      apiKeyEnvVar: config.apiKeyEnvVar as string | undefined,
      ...config,
    },
  };
}

/**
 * Get the available output ports for an integration.
 * Useful for UI to show what can be connected.
 */
export function getOutputPorts(type: IntegrationType): Port[] {
  const definition = getIntegration(type);
  return definition?.ports.outputs ?? [];
}

/**
 * Get the available input ports for an integration.
 */
export function getInputPorts(type: IntegrationType): Port[] {
  const definition = getIntegration(type);
  return definition?.ports.inputs ?? [];
}

// =============================================================================
// Initialize Registry
// =============================================================================

/**
 * Register all built-in integrations.
 * Called on module load.
 */
function initializeRegistry(): void {
  // Scheduling
  registerIntegration(calendlyIntegration);
  registerIntegration(calComIntegration);

  // CRM: Now handled by foundational data layer (Contacts, Notes, Contact Interactions)

  // Future: Add more integrations as they're built
  // registerIntegration(stripeIntegration);
  // registerIntegration(sendgridIntegration);
  // registerIntegration(twilioIntegration);
}

// Auto-initialize on import
initializeRegistry();

// =============================================================================
// Exports
// =============================================================================

export {
  calendlyIntegration,
  calComIntegration,
} from './scheduling/index.js';

