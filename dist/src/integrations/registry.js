/**
 * Integration Registry
 *
 * Central registry for all integration definitions.
 * Integrations are first-class citizens with predefined ports and contracts.
 */
// Import integration definitions
import { calendlyIntegration, calComIntegration } from './scheduling/index.js';
// =============================================================================
// Registry
// =============================================================================
/**
 * Map of all registered integrations.
 */
const integrations = new Map();
/**
 * Register an integration definition.
 */
export function registerIntegration(definition) {
    integrations.set(definition.type, definition);
}
/**
 * Get an integration definition by type.
 */
export function getIntegration(type) {
    return integrations.get(type);
}
/**
 * Get all registered integrations.
 */
export function getAllIntegrations() {
    return Array.from(integrations.values());
}
/**
 * Get integrations by category.
 */
export function getIntegrationsByCategory(category) {
    return getAllIntegrations().filter((i) => i.category === category);
}
/**
 * Check if an integration type is registered.
 */
export function hasIntegration(type) {
    return integrations.has(type);
}
// =============================================================================
// Node Factory
// =============================================================================
/**
 * Create a GraphNode from an integration definition.
 * This is how integrations become nodes in the graph.
 */
export function createIntegrationNode(type, id, config = {}) {
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
            integrationId: config.integrationId,
            apiKeyEnvVar: config.apiKeyEnvVar,
            ...config,
        },
    };
}
/**
 * Get the available output ports for an integration.
 * Useful for UI to show what can be connected.
 */
export function getOutputPorts(type) {
    const definition = getIntegration(type);
    return definition?.ports.outputs ?? [];
}
/**
 * Get the available input ports for an integration.
 */
export function getInputPorts(type) {
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
function initializeRegistry() {
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
export { calendlyIntegration, calComIntegration, } from './scheduling/index.js';
//# sourceMappingURL=registry.js.map