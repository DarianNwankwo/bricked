/**
 * Graph Transformer
 *
 * Transforms MermaidAST into a port-based Graph with typed connections.
 * Extends the existing transformer with support for:
 * - Integration nodes (Calendly, Stripe, etc.)
 * - Typed ports and contracts
 * - Multi-input/multi-output edges
 */
import type { MermaidAST } from '../types/ast.js';
import type { Graph, Port, VerticalType } from '../types/graph.js';
import type { ComponentType } from '../types/ir.js';
import type { IntegrationType } from '../types/graph.js';
/**
 * Detect integration type from node label.
 */
declare function detectIntegrationType(label: string): IntegrationType | null;
/**
 * Default ports for infrastructure component types.
 * These are generic and can be customized via annotations.
 */
declare function getInfrastructurePorts(type: ComponentType): {
    inputs: Port[];
    outputs: Port[];
};
export interface GraphTransformOptions {
    name?: string;
    region?: string;
    vertical?: VerticalType;
}
/**
 * Transform MermaidAST into a port-based Graph.
 *
 * This is the enhanced transformer that supports:
 * - Integration detection from node labels
 * - Typed ports from integration definitions
 * - Edge labels mapped to specific ports
 */
export declare function transformToGraph(ast: MermaidAST, options?: GraphTransformOptions): Graph;
export { detectIntegrationType, getInfrastructurePorts };
//# sourceMappingURL=graph-transformer.d.ts.map