export type NodeShape = 'rectangle' | 'stadium' | 'cylinder' | 'circle' | 'hexagon' | 'asymmetric';
export interface MermaidNode {
    id: string;
    label: string;
    shape: NodeShape;
}
export interface MermaidEdge {
    from: string;
    to: string;
    label?: string;
}
export interface MermaidSubgraph {
    id: string;
    label: string;
    nodes: string[];
}
export interface BrickAnnotation {
    type: 'global' | 'node';
    nodeId?: string;
    key: string;
    value: string;
}
export interface MermaidAST {
    type: 'flowchart';
    direction: 'TD' | 'LR' | 'TB' | 'BT' | 'RL';
    nodes: MermaidNode[];
    edges: MermaidEdge[];
    subgraphs: MermaidSubgraph[];
    annotations: BrickAnnotation[];
}
//# sourceMappingURL=ast.d.ts.map