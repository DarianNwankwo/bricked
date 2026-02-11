export class MermaidParseError extends Error {
    line;
    constructor(message, line) {
        super(line ? `Line ${line}: ${message}` : message);
        this.line = line;
        this.name = 'MermaidParseError';
    }
}
const SHAPE_PATTERNS = [
    { pattern: /^\(\((.+)\)\)$/, shape: 'circle' }, // ((text)) = worker
    { pattern: /^\(\[(.+)\]\)$/, shape: 'stadium' }, // ([text]) = static_site
    { pattern: /^\[\((.+)\)\]$/, shape: 'cylinder' }, // [(text)] = database
    { pattern: /^\{\{(.+)\}\}$/, shape: 'hexagon' }, // {{text}} = job
    { pattern: /^>(.+)\]$/, shape: 'asymmetric' }, // >text] = queue
    { pattern: /^\[(.+)\]$/, shape: 'rectangle' }, // [text] = service
];
const EDGE_PATTERNS = [
    /^(\w+)\s*-->\s*\|([^|]+)\|\s*(\w+)$/, // A --> |label| B
    /^(\w+)\s*-->\s*(\w+)$/, // A --> B
    /^(\w+)\s*--->\s*(\w+)$/, // A ---> B (long arrow)
    /^(\w+)\s*-\.->?\s*(\w+)$/, // A -.-> B (dotted)
    /^(\w+)\s*==>\s*(\w+)$/, // A ==> B (thick)
];
const MULTI_TARGET_EDGE = /^(.+?)\s*-->\s*(.+)$/;
function parseNodeDefinition(text) {
    const match = text.match(/^(\w+)(.*)$/);
    if (!match)
        return null;
    const [, id, rest] = match;
    const trimmedRest = rest.trim();
    if (!trimmedRest) {
        return { id, label: id, shape: 'rectangle' };
    }
    for (const { pattern, shape } of SHAPE_PATTERNS) {
        const shapeMatch = trimmedRest.match(pattern);
        if (shapeMatch) {
            return { id, label: shapeMatch[1].trim(), shape };
        }
    }
    return null;
}
function parseEdge(line) {
    // First check for labeled edge: A -->|label| B
    const labeledMatch = line.match(/^(.+?)\s*-->\s*\|([^|]+)\|\s*(.+)$/);
    if (labeledMatch) {
        const [, sourcesPart, label, targetsPart] = labeledMatch;
        const sourceNodes = parseNodesPart(sourcesPart);
        const targetNodes = parseNodesPart(targetsPart);
        if (sourceNodes.length === 0 || targetNodes.length === 0)
            return null;
        const edges = [];
        for (const source of sourceNodes) {
            for (const target of targetNodes) {
                edges.push({ from: source.id, to: target.id, label: label.trim() });
            }
        }
        return { edges, nodes: [...sourceNodes, ...targetNodes] };
    }
    // Fall back to unlabeled edge
    const multiMatch = line.match(MULTI_TARGET_EDGE);
    if (!multiMatch)
        return null;
    const [, sourcesPart, targetsPart] = multiMatch;
    const sourceNodes = parseNodesPart(sourcesPart);
    const targetNodes = parseNodesPart(targetsPart);
    if (sourceNodes.length === 0 || targetNodes.length === 0)
        return null;
    const edges = [];
    for (const source of sourceNodes) {
        for (const target of targetNodes) {
            edges.push({ from: source.id, to: target.id });
        }
    }
    const allNodes = [...sourceNodes, ...targetNodes];
    return { edges, nodes: allNodes };
}
function parseNodesPart(part) {
    const nodes = [];
    if (part.includes('&')) {
        const parts = part.split('&').map(p => p.trim());
        for (const p of parts) {
            const node = parseNodeDefinition(p);
            if (node)
                nodes.push(node);
        }
    }
    else {
        const node = parseNodeDefinition(part.trim());
        if (node)
            nodes.push(node);
    }
    return nodes;
}
function parseAnnotation(line) {
    const match = line.match(/^%%\s*brick:(.+)$/);
    if (!match)
        return null;
    const content = match[1].trim();
    const nodeMatch = content.match(/^(\w+):(\w+)=(.+)$/);
    if (nodeMatch) {
        const [, nodeId, key, value] = nodeMatch;
        return { type: 'node', nodeId, key, value };
    }
    const globalMatch = content.match(/^(\w+)=(.+)$/);
    if (globalMatch) {
        const [, key, value] = globalMatch;
        return { type: 'global', key, value };
    }
    return null;
}
export function parseMermaid(input) {
    const lines = input.split('\n').map(line => line.trim());
    const ast = {
        type: 'flowchart',
        direction: 'TD',
        nodes: [],
        edges: [],
        subgraphs: [],
        annotations: [],
    };
    const nodeMap = new Map();
    let inSubgraph = false;
    let currentSubgraph = null;
    const subgraphStack = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNum = i + 1;
        if (!line || line.startsWith('%%') && !line.includes('brick:')) {
            continue;
        }
        const annotation = parseAnnotation(line);
        if (annotation) {
            ast.annotations.push(annotation);
            continue;
        }
        const flowchartMatch = line.match(/^flowchart\s+(TD|LR|TB|BT|RL)$/i);
        if (flowchartMatch) {
            ast.direction = flowchartMatch[1].toUpperCase();
            continue;
        }
        const graphMatch = line.match(/^graph\s+(TD|LR|TB|BT|RL)$/i);
        if (graphMatch) {
            ast.direction = graphMatch[1].toUpperCase();
            continue;
        }
        if (line.match(/^subgraph\s+/i)) {
            const subgraphMatch = line.match(/^subgraph\s+(\w+)(?:\s*\["?([^"\]]+)"?\])?$/i);
            if (subgraphMatch) {
                if (currentSubgraph) {
                    subgraphStack.push(currentSubgraph);
                }
                currentSubgraph = {
                    id: subgraphMatch[1],
                    label: subgraphMatch[2] || subgraphMatch[1],
                    nodes: [],
                };
                inSubgraph = true;
            }
            continue;
        }
        if (line === 'end' && inSubgraph) {
            if (currentSubgraph) {
                ast.subgraphs.push(currentSubgraph);
                currentSubgraph = subgraphStack.pop() || null;
                inSubgraph = subgraphStack.length > 0 || currentSubgraph !== null;
            }
            continue;
        }
        const edgeResult = parseEdge(line);
        if (edgeResult) {
            for (const node of edgeResult.nodes) {
                if (!nodeMap.has(node.id)) {
                    nodeMap.set(node.id, { id: node.id, label: node.label, shape: node.shape });
                    if (currentSubgraph) {
                        currentSubgraph.nodes.push(node.id);
                    }
                }
            }
            ast.edges.push(...edgeResult.edges);
            continue;
        }
        const nodeOnly = parseNodeDefinition(line);
        if (nodeOnly && !nodeMap.has(nodeOnly.id)) {
            nodeMap.set(nodeOnly.id, { id: nodeOnly.id, label: nodeOnly.label, shape: nodeOnly.shape });
            if (currentSubgraph) {
                currentSubgraph.nodes.push(nodeOnly.id);
            }
        }
    }
    ast.nodes = Array.from(nodeMap.values());
    return ast;
}
//# sourceMappingURL=mermaid-parser.js.map