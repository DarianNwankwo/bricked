/**
 * Port-Based Graph Abstraction
 *
 * This module extends Brick's IR with typed ports and contracts,
 * enabling integration-first architectures for verticals like coaching/fitness.
 *
 * Key concepts:
 * - Port: A typed input or output on a node with a defined contract
 * - Contract: Schema defining what data flows through a port
 * - Edge: Connection between specific ports on different nodes
 * - Integration: First-class external service with predefined ports
 */
// =============================================================================
// Conversion Utilities (for backward compatibility)
// =============================================================================
/**
 * Type guard for integration types.
 */
export function isIntegrationType(type) {
    const integrationTypes = [
        'calendly', 'cal_com', 'acuity',
        'stripe', 'square', 'paypal',
        'hubspot', 'salesforce', 'pipedrive',
        'sendgrid', 'mailchimp', 'postmark',
        'twilio',
        'zoom', 'google_meet',
        'typeform', 'jotform'
    ];
    return integrationTypes.includes(type);
}
/**
 * Type guard for infrastructure component types.
 */
export function isComponentType(type) {
    const componentTypes = [
        'service', 'static_site', 'worker', 'job', 'database'
    ];
    return componentTypes.includes(type);
}
//# sourceMappingURL=graph.js.map