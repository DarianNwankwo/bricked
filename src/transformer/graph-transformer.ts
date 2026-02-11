/**
 * Graph Transformer
 *
 * Transforms MermaidAST into a port-based Graph with typed connections.
 * Extends the existing transformer with support for:
 * - Integration nodes (Calendly, Stripe, etc.)
 * - Typed ports and contracts
 * - Multi-input/multi-output edges
 */

import type { MermaidAST, MermaidNode, MermaidEdge } from '../types/ast.js';
import type {
  Graph,
  GraphNode,
  GraphEdge,
  Port,
  VerticalType,
  NodeCategory,
  ExtendedNodeType,
  GraphNodeConfig,
} from '../types/graph.js';
import type { ComponentType } from '../types/ir.js';
import { processAnnotations, type NodeAnnotations } from '../parser/annotations.js';
import {
  inferComponentType,
  inferDatabaseEngine,
  inferDatabaseVersion,
  inferPort,
  slugify,
} from './inference.js';
import {
  hasIntegration,
  getIntegration,
  createIntegrationNode,
} from '../integrations/registry.js';
import type { IntegrationType } from '../types/graph.js';

// =============================================================================
// Integration Detection Patterns
// =============================================================================

/**
 * Patterns for detecting integrations from node labels.
 * More specific patterns should come first.
 */
const INTEGRATION_PATTERNS: { pattern: RegExp; type: IntegrationType }[] = [
  // Scheduling
  { pattern: /\bcalendly\b/i, type: 'calendly' },
  { pattern: /\bcal\.?com\b/i, type: 'cal_com' },
  { pattern: /\bacuity\b/i, type: 'acuity' },
  // Payments
  { pattern: /\bstripe\b/i, type: 'stripe' },
  { pattern: /\bsquare\b/i, type: 'square' },
  { pattern: /\bpaypal\b/i, type: 'paypal' },
  // CRM
  { pattern: /\bhubspot\b/i, type: 'hubspot' },
  { pattern: /\bsalesforce\b/i, type: 'salesforce' },
  { pattern: /\bpipedrive\b/i, type: 'pipedrive' },
  // Email
  { pattern: /\bsendgrid\b/i, type: 'sendgrid' },
  { pattern: /\bmailchimp\b/i, type: 'mailchimp' },
  { pattern: /\bpostmark\b/i, type: 'postmark' },
  // SMS
  { pattern: /\btwilio\b/i, type: 'twilio' },
  // Video
  { pattern: /\bzoom\b/i, type: 'zoom' },
  { pattern: /\bgoogle\s*meet\b/i, type: 'google_meet' },
  // Forms
  { pattern: /\btypeform\b/i, type: 'typeform' },
  { pattern: /\bjotform\b/i, type: 'jotform' },
];

/**
 * Detect integration type from node label.
 */
function detectIntegrationType(label: string): IntegrationType | null {
  for (const { pattern, type } of INTEGRATION_PATTERNS) {
    if (pattern.test(label) && hasIntegration(type)) {
      return type;
    }
  }
  return null;
}

// =============================================================================
// Port Inference for Edge Labels
// =============================================================================

/**
 * Patterns for inferring output port from edge labels.
 * Used when edge labels hint at what data is flowing.
 */
const OUTPUT_PORT_PATTERNS: { pattern: RegExp; portId: string }[] = [
  // Scheduling events
  { pattern: /\bbook(ing|ed)?\b.*\b(confirm|success|create)/i, portId: 'booking_confirmed' },
  { pattern: /\bcancel/i, portId: 'booking_cancelled' },
  { pattern: /\breschedul/i, portId: 'booking_rescheduled' },
  { pattern: /\bavailab/i, portId: 'available_slots' },
  // Payment events
  { pattern: /\bpay(ment)?.*\b(success|complete)/i, portId: 'payment_succeeded' },
  { pattern: /\bsubscri/i, portId: 'subscription_created' },
  // Generic
  { pattern: /\bwebhook/i, portId: 'webhook' },
  { pattern: /\bevent/i, portId: 'event' },
];

/**
 * Patterns for inferring input port from edge labels.
 */
const INPUT_PORT_PATTERNS: { pattern: RegExp; portId: string }[] = [
  { pattern: /\bbook(ing)?\s*(request)?/i, portId: 'booking_request' },
  { pattern: /\bcheck\s*availab/i, portId: 'availability_check' },
  { pattern: /\bpay(ment)?\s*(request|intent)?/i, portId: 'payment_intent' },
  { pattern: /\bsend\s*(email|message)/i, portId: 'send_message' },
];

/**
 * Infer output port ID from edge label.
 */
function inferOutputPort(label: string | undefined, node: GraphNode): string {
  if (label) {
    for (const { pattern, portId } of OUTPUT_PORT_PATTERNS) {
      if (pattern.test(label) && node.ports.outputs.some((p) => p.id === portId)) {
        return portId;
      }
    }
  }
  // Default: first output port if available
  return node.ports.outputs[0]?.id ?? 'default_out';
}

/**
 * Infer input port ID from edge label.
 */
function inferInputPort(label: string | undefined, node: GraphNode): string {
  if (label) {
    for (const { pattern, portId } of INPUT_PORT_PATTERNS) {
      if (pattern.test(label) && node.ports.inputs.some((p) => p.id === portId)) {
        return portId;
      }
    }
  }
  // Default: first input port if available
  return node.ports.inputs[0]?.id ?? 'default_in';
}

// =============================================================================
// Infrastructure Node Ports
// =============================================================================

/**
 * Default ports for infrastructure component types.
 * These are generic and can be customized via annotations.
 */
function getInfrastructurePorts(type: ComponentType): { inputs: Port[]; outputs: Port[] } {
  switch (type) {
    case 'service':
      return {
        inputs: [
          {
            id: 'http_request',
            name: 'HTTP Request',
            direction: 'input',
            contract: { type: 'object', description: 'Incoming HTTP request' },
          },
          {
            id: 'event_trigger',
            name: 'Event Trigger',
            direction: 'input',
            contract: { type: 'object', description: 'Event from another service' },
          },
        ],
        outputs: [
          {
            id: 'http_response',
            name: 'HTTP Response',
            direction: 'output',
            contract: { type: 'object', description: 'HTTP response data' },
          },
          {
            id: 'event_emit',
            name: 'Event Emit',
            direction: 'output',
            contract: { type: 'object', description: 'Event emitted to other services' },
          },
        ],
      };

    case 'static_site':
      return {
        inputs: [],
        outputs: [
          {
            id: 'page_load',
            name: 'Page Load',
            direction: 'output',
            contract: { type: 'object', description: 'User loads a page' },
          },
          {
            id: 'form_submit',
            name: 'Form Submit',
            direction: 'output',
            contract: { type: 'object', description: 'User submits a form' },
          },
        ],
      };

    case 'worker':
      return {
        inputs: [
          {
            id: 'job_request',
            name: 'Job Request',
            direction: 'input',
            contract: { type: 'object', description: 'Background job request' },
          },
        ],
        outputs: [
          {
            id: 'job_complete',
            name: 'Job Complete',
            direction: 'output',
            contract: { type: 'object', description: 'Job completion result' },
          },
        ],
      };

    case 'job':
      return {
        inputs: [
          {
            id: 'schedule_trigger',
            name: 'Schedule Trigger',
            direction: 'input',
            contract: { type: 'object', description: 'Cron schedule trigger' },
          },
        ],
        outputs: [
          {
            id: 'job_result',
            name: 'Job Result',
            direction: 'output',
            contract: { type: 'object', description: 'Scheduled job result' },
          },
        ],
      };

    case 'database':
      return {
        inputs: [
          {
            id: 'query',
            name: 'Query',
            direction: 'input',
            contract: { type: 'object', description: 'Database query' },
          },
          {
            id: 'write',
            name: 'Write',
            direction: 'input',
            contract: { type: 'object', description: 'Database write operation' },
          },
        ],
        outputs: [
          {
            id: 'query_result',
            name: 'Query Result',
            direction: 'output',
            contract: { type: 'object', description: 'Query result data' },
          },
        ],
      };

    default:
      return { inputs: [], outputs: [] };
  }
}

// =============================================================================
// Transform Options
// =============================================================================

export interface GraphTransformOptions {
  name?: string;
  region?: string;
  vertical?: VerticalType;
}

// =============================================================================
// Main Transformer
// =============================================================================

/**
 * Transform MermaidAST into a port-based Graph.
 *
 * This is the enhanced transformer that supports:
 * - Integration detection from node labels
 * - Typed ports from integration definitions
 * - Edge labels mapped to specific ports
 */
export function transformToGraph(
  ast: MermaidAST,
  options: GraphTransformOptions = {}
): Graph {
  const annotations = processAnnotations(ast.annotations);

  const appName = options.name || annotations.global.name || 'my-app';
  const region = options.region || annotations.global.region || 'nyc';
  const vertical = options.vertical;

  // First pass: create all nodes
  const nodeMap = new Map<string, GraphNode>();

  for (const mermaidNode of ast.nodes) {
    const nodeAnnotations = annotations.nodes.get(mermaidNode.id);
    const graphNode = transformToGraphNode(mermaidNode, nodeAnnotations);
    nodeMap.set(mermaidNode.id, graphNode);
  }

  // Second pass: create edges with port inference
  const edges = transformEdges(ast.edges, nodeMap);

  return {
    name: slugify(appName),
    region,
    vertical,
    nodes: Array.from(nodeMap.values()),
    edges,
    metadata: {
      createdAt: new Date().toISOString(),
      version: '2.0.0',
    },
  };
}

/**
 * Transform a MermaidNode into a GraphNode.
 */
function transformToGraphNode(
  node: MermaidNode,
  nodeAnnotations?: NodeAnnotations
): GraphNode {
  // Check if this is an integration node
  const integrationType = detectIntegrationType(node.label);

  if (integrationType) {
    // Create from integration definition
    const integrationNode = createIntegrationNode(integrationType, node.id);
    if (integrationNode) {
      // Override name with label if different
      integrationNode.name = slugify(node.label);
      return integrationNode;
    }
  }

  // Otherwise, create infrastructure node
  const componentType = inferComponentType(node.shape);
  const config = buildInfrastructureConfig(node, componentType, nodeAnnotations);
  const ports = getInfrastructurePorts(componentType);

  return {
    id: node.id,
    name: slugify(node.label),
    type: componentType,
    category: 'infrastructure',
    ports,
    config,
  };
}

/**
 * Build config for infrastructure nodes (backward compatible with IRComponentConfig).
 */
function buildInfrastructureConfig(
  node: MermaidNode,
  type: ComponentType,
  annotations?: NodeAnnotations
): GraphNodeConfig {
  const config: GraphNodeConfig = {};

  // Apply annotations
  if (annotations) {
    if (annotations.port) config.port = annotations.port;
    if (annotations.schedule) config.schedule = annotations.schedule;
    if (annotations.instanceCount) config.instanceCount = annotations.instanceCount;
    if (annotations.instanceSize) config.instanceSize = annotations.instanceSize;
    if (annotations.buildCommand) config.buildCommand = annotations.buildCommand;
    if (annotations.runCommand) config.runCommand = annotations.runCommand;
    if (annotations.outputDir) config.outputDir = annotations.outputDir;
    if (annotations.envVars) config.envVars = annotations.envVars;
  }

  // Type-specific inference
  switch (type) {
    case 'service':
      if (!config.port) {
        config.port = inferPort(node.label);
      }
      break;

    case 'static_site':
      if (!config.outputDir) {
        config.outputDir = inferOutputDir(node.label);
      }
      break;

    case 'database':
      config.engine = annotations?.engine
        ? mapEngineString(annotations.engine)
        : inferDatabaseEngine(node.label);
      config.version = annotations?.version || inferDatabaseVersion(config.engine);
      break;

    case 'job':
      if (!config.schedule && annotations?.schedule) {
        config.schedule = annotations.schedule;
      }
      break;
  }

  return config;
}

/**
 * Transform MermaidEdges into typed GraphEdges.
 */
function transformEdges(
  mermaidEdges: MermaidEdge[],
  nodeMap: Map<string, GraphNode>
): GraphEdge[] {
  const edges: GraphEdge[] = [];
  let edgeCounter = 0;

  for (const edge of mermaidEdges) {
    const fromNode = nodeMap.get(edge.from);
    const toNode = nodeMap.get(edge.to);

    if (!fromNode || !toNode) {
      continue;
    }

    // Infer ports from edge label
    const fromPortId = inferOutputPort(edge.label, fromNode);
    const toPortId = inferInputPort(edge.label, toNode);

    edges.push({
      id: `edge-${++edgeCounter}`,
      from: { nodeId: edge.from, portId: fromPortId },
      to: { nodeId: edge.to, portId: toPortId },
      label: edge.label,
    });
  }

  return edges;
}

// =============================================================================
// Helper Functions
// =============================================================================

function inferOutputDir(label: string): string {
  const lowerLabel = label.toLowerCase();

  if (/next\.?js/i.test(lowerLabel)) return '.next';
  if (/react|vite|vue|angular/i.test(lowerLabel)) return 'dist';
  if (/hugo/i.test(lowerLabel)) return 'public';
  if (/gatsby/i.test(lowerLabel)) return 'public';
  if (/astro/i.test(lowerLabel)) return 'dist';

  return 'dist';
}

function mapEngineString(engine: string): import('../types/ir.js').DatabaseEngine {
  const normalized = engine.toUpperCase();
  if (normalized === 'POSTGRES' || normalized === 'POSTGRESQL') return 'PG';
  if (normalized === 'MYSQL' || normalized === 'MARIA' || normalized === 'MARIADB') return 'MYSQL';
  if (normalized === 'REDIS') return 'REDIS';
  if (normalized === 'MONGO' || normalized === 'MONGODB') return 'MONGODB';
  return 'PG';
}

// =============================================================================
// Exports
// =============================================================================

export { detectIntegrationType, getInfrastructurePorts };
