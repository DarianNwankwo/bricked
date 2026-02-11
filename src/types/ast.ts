export type NodeShape =
  | 'rectangle'    // [text] = service
  | 'stadium'      // ([text]) = static_site
  | 'cylinder'     // [(text)] = database
  | 'circle'       // ((text)) = worker
  | 'hexagon'      // {{text}} = job
  | 'asymmetric';  // >text] = queue

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
