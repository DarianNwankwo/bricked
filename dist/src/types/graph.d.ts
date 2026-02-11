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
import type { ComponentType, IRComponentConfig } from './ir.js';
/**
 * JSON Schema subset for defining port data contracts.
 * Keeps it simple - full JSON Schema is overkill for most use cases.
 */
export interface PortSchema {
    type: 'object' | 'string' | 'number' | 'boolean' | 'array';
    properties?: Record<string, PortSchemaProperty>;
    items?: PortSchemaProperty;
    required?: string[];
    description?: string;
}
export interface PortSchemaProperty {
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    format?: 'date-time' | 'email' | 'uri' | 'uuid';
    description?: string;
    enum?: string[];
}
/**
 * A port defines a typed input or output on a node.
 * Ports have contracts that describe what data flows through them.
 */
export interface Port {
    id: string;
    name: string;
    direction: 'input' | 'output';
    contract: PortSchema;
    required?: boolean;
    description?: string;
}
/**
 * First-class integration types for external services.
 * These map to pre-built integration particles with known ports.
 */
export type IntegrationType = 'calendly' | 'cal_com' | 'acuity' | 'stripe' | 'square' | 'paypal' | 'hubspot' | 'salesforce' | 'pipedrive' | 'sendgrid' | 'mailchimp' | 'postmark' | 'twilio' | 'zoom' | 'google_meet' | 'typeform' | 'jotform';
/**
 * Node category determines how the node is rendered and configured.
 */
export type NodeCategory = 'infrastructure' | 'integration' | 'custom';
/**
 * Extended node type union - includes both infrastructure and integrations.
 */
export type ExtendedNodeType = ComponentType | IntegrationType;
/**
 * Graph node with typed ports - extends the concept of IRComponent
 * to support multi-input/multi-output with contracts.
 */
export interface GraphNode {
    id: string;
    name: string;
    type: ExtendedNodeType;
    category: NodeCategory;
    /**
     * Typed ports for inputs and outputs.
     * Integrations come with predefined ports; infrastructure nodes can have custom ports.
     */
    ports: {
        inputs: Port[];
        outputs: Port[];
    };
    /**
     * Configuration for infrastructure components (backwards compatible).
     * For integrations, this holds credentials/settings.
     */
    config: GraphNodeConfig;
    /**
     * Optional metadata for UI/vertical-specific features.
     */
    metadata?: Record<string, unknown>;
}
/**
 * Extended config that supports both infrastructure and integrations.
 */
export interface GraphNodeConfig extends IRComponentConfig {
    integrationId?: string;
    webhookSecret?: string;
    apiKeyEnvVar?: string;
    vertical?: VerticalType;
}
/**
 * Reference to a specific port on a node.
 */
export interface PortRef {
    nodeId: string;
    portId: string;
}
/**
 * Edge connecting two ports across nodes.
 * Enables typed data flow with optional transformations.
 */
export interface GraphEdge {
    id: string;
    from: PortRef;
    to: PortRef;
    /**
     * Optional label for UI display.
     */
    label?: string;
    /**
     * Optional transformation expression (future: JSONata or similar).
     * For now, null means pass-through.
     */
    transform?: string | null;
    /**
     * Whether this edge is required for the target node to function.
     */
    required?: boolean;
}
/**
 * Target vertical for vertical-specific templates and defaults.
 */
export type VerticalType = 'coaching' | 'fitness' | 'consulting' | 'healthcare' | 'ecommerce' | 'saas' | 'general';
/**
 * Port-based graph - the enhanced IR for integration-first architectures.
 */
export interface Graph {
    name: string;
    region: string;
    vertical?: VerticalType;
    /**
     * All nodes in the graph (services, integrations, databases, etc.).
     */
    nodes: GraphNode[];
    /**
     * Typed edges connecting ports across nodes.
     */
    edges: GraphEdge[];
    /**
     * Graph-level metadata.
     */
    metadata?: {
        createdAt?: string;
        version?: string;
        description?: string;
    };
}
/**
 * Integration definition - template for creating integration nodes.
 * The registry holds these definitions; instances become GraphNodes.
 */
export interface IntegrationDefinition {
    type: IntegrationType;
    name: string;
    description: string;
    category: 'scheduling' | 'payments' | 'crm' | 'email' | 'sms' | 'video' | 'forms';
    /**
     * Predefined ports for this integration.
     */
    ports: {
        inputs: Port[];
        outputs: Port[];
    };
    /**
     * Required configuration fields.
     */
    requiredConfig: string[];
    /**
     * Documentation URL.
     */
    docsUrl?: string;
    /**
     * Icon identifier for UI.
     */
    icon?: string;
}
/**
 * Type guard for integration types.
 */
export declare function isIntegrationType(type: string): type is IntegrationType;
/**
 * Type guard for infrastructure component types.
 */
export declare function isComponentType(type: string): type is ComponentType;
//# sourceMappingURL=graph.d.ts.map