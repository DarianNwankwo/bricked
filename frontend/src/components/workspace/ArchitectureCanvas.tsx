import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  Handle,
  Position,
  type Node,
  type Edge,
  type OnConnect,
  type NodeChange,
  BackgroundVariant,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import type { ManualArchitecture, BrickAppContract, ComponentType, BACCompleteness, ComponentSpec, ArchConnection } from '../../api/types';
import { TYPE_COLORS, TYPE_ICONS } from './constants';
import EdgeEditPopover from './EdgeEditPopover';
import './ArchitectureCanvas.css';

interface ArchitectureCanvasProps {
  architecture: ManualArchitecture | null;
  bac: BrickAppContract | null;
  componentSpecs?: Record<string, ComponentSpec>;
  completeness?: BACCompleteness | null;
  edgeType?: 'default' | 'straight' | 'step';
  onAddComponent: (comp: { name: string; type: string; x: number; y: number }) => void;
  onUpdateComponent: (id: string, updates: { x?: number; y?: number; name?: string }) => void;
  onDeleteComponent: (id: string) => void;
  onAddConnection: (from: string, to: string) => void;
  onUpdateConnection?: (from: string, to: string, label?: string, contract?: string) => void;
  onDeleteConnection?: (from: string, to: string) => void;
  onNodeSelect?: (id: string | null) => void;
  onEdgeTypeChange?: (type: 'default' | 'straight' | 'step') => void;
}

// ── Enhanced Component Node ──────────────────────────────────────────

interface ComponentNodeData {
  label: string;
  type: string;
  selected?: boolean;
  isComplete?: boolean;
  connectionCount?: number;
  onRename?: (id: string, name: string) => void;
  nodeId?: string;
}

function ComponentNode({ data }: { data: ComponentNodeData }) {
  const color = TYPE_COLORS[data.type] || '#6366f1';
  const icon = TYPE_ICONS[data.type] || 'solar:server-linear';
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(data.label);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setEditName(data.label);
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }, [data.label]);

  const commitRename = useCallback(() => {
    setEditing(false);
    const trimmed = editName.trim();
    if (trimmed && trimmed !== data.label && data.onRename && data.nodeId) {
      data.onRename(data.nodeId, trimmed);
    }
  }, [editName, data]);

  return (
    <div
      className={`component-node ${data.selected ? 'selected' : ''}`}
      style={{ borderColor: color }}
      onDoubleClick={handleDoubleClick}
    >
      {/* Handles */}
      <Handle type="target" position={Position.Left} className="component-handle" />
      <Handle type="target" position={Position.Top} id="top" className="component-handle" />
      <Handle type="source" position={Position.Right} className="component-handle" />
      <Handle type="source" position={Position.Bottom} id="bottom" className="component-handle" />

      {/* Completeness dot */}
      {data.isComplete !== undefined && (
        <div
          className={`completeness-dot ${data.isComplete ? 'complete' : 'incomplete'}`}
          title={data.isComplete ? 'Spec complete' : 'Spec incomplete'}
        />
      )}

      {/* Connection count */}
      {(data.connectionCount ?? 0) > 0 && (
        <div className="connection-count">{data.connectionCount}</div>
      )}

      <div className="component-node-icon" style={{ background: `${color}20`, color }}>
        <iconify-icon icon={icon} width={16} />
      </div>
      <div className="component-node-info">
        {editing ? (
          <input
            ref={inputRef}
            className="component-node-rename"
            value={editName}
            onChange={e => setEditName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={e => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') setEditing(false);
            }}
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <div className="component-node-name">{data.label}</div>
        )}
        <div className="component-node-type">{data.type.replace(/_/g, ' ')}</div>
      </div>
    </div>
  );
}

const nodeTypes = {
  component: ComponentNode,
};

// ── Auto-layout with dagre ───────────────────────────────────────────

function autoLayout(
  nodes: Node[],
  edges: Edge[],
  direction: 'TB' | 'LR' = 'TB'
): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, nodesep: 60, ranksep: 80 });

  for (const node of nodes) {
    g.setNode(node.id, { width: 200, height: 60 });
  }
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  return nodes.map(node => {
    const pos = g.node(node.id);
    return {
      ...node,
      position: { x: pos.x - 100, y: pos.y - 30 },
    };
  });
}

// ── Main Canvas (inner, needs ReactFlowProvider) ─────────────────────

function CanvasInner({
  architecture,
  bac,
  componentSpecs,
  completeness,
  edgeType = 'default',
  onAddComponent,
  onUpdateComponent,
  onDeleteComponent,
  onAddConnection,
  onUpdateConnection,
  onDeleteConnection,
  onNodeSelect,
  onEdgeTypeChange,
}: ArchitectureCanvasProps) {
  const [showPalette, setShowPalette] = useState(false);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<{ connection: ArchConnection; position: { x: number; y: number } } | null>(null);
  const reactFlowInstance = useReactFlow();
  const canvasRef = useRef<HTMLDivElement>(null);

  // Compute connection counts per node
  const connectionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    if (architecture) {
      for (const conn of architecture.connections) {
        counts[conn.from] = (counts[conn.from] || 0) + 1;
        counts[conn.to] = (counts[conn.to] || 0) + 1;
      }
    }
    return counts;
  }, [architecture]);

  // Check which nodes are complete
  const incompleteNodeIds = useMemo(() => {
    const set = new Set<string>();
    if (completeness?.incompleteNodes) {
      for (const n of completeness.incompleteNodes) set.add(n.nodeId);
    }
    return set;
  }, [completeness]);

  // Handler for inline rename from node double-click
  const handleNodeRename = useCallback((id: string, name: string) => {
    onUpdateComponent(id, { name });
  }, [onUpdateComponent]);

  // Convert architecture to ReactFlow nodes/edges
  const initialNodes: Node[] = useMemo(() => {
    if (!architecture) return [];
    return architecture.components.map((c) => ({
      id: c.id,
      type: 'component',
      position: { x: c.x, y: c.y },
      data: {
        label: c.name,
        type: c.type,
        selected: c.id === selectedNode,
        isComplete: completeness ? !incompleteNodeIds.has(c.id) : undefined,
        connectionCount: connectionCounts[c.id] || 0,
        onRename: handleNodeRename,
        nodeId: c.id,
      },
    }));
  }, [architecture, selectedNode, completeness, incompleteNodeIds, connectionCounts, handleNodeRename]);

  const initialEdges: Edge[] = useMemo(() => {
    if (!architecture) return [];
    return architecture.connections.map((c, i) => ({
      id: `e-${c.from}-${c.to}-${i}`,
      source: c.from,
      target: c.to,
      label: c.label || '',
      type: edgeType === 'step' ? 'smoothstep' : edgeType === 'straight' ? 'straight' : 'default',
      animated: true,
      style: { stroke: '#404040', strokeWidth: 1.5 },
      labelStyle: { fill: '#737373', fontSize: 10 },
    }));
  }, [architecture, edgeType]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync when architecture changes
  useMemo(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const onConnect: OnConnect = useCallback(
    (params) => {
      if (params.source && params.target) {
        onAddConnection(params.source, params.target);
      }
    },
    [onAddConnection]
  );

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChange(changes);

      for (const change of changes) {
        if (change.type === 'position' && change.position && !change.dragging) {
          onUpdateComponent(change.id, { x: change.position.x, y: change.position.y });
        }
      }
    },
    [onNodesChange, onUpdateComponent]
  );

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    const newId = selectedNode === node.id ? null : node.id;
    setSelectedNode(newId);
    onNodeSelect?.(newId);
    setSelectedEdge(null);
  }, [selectedNode, onNodeSelect]);

  const handlePaneClick = useCallback(() => {
    setSelectedNode(null);
    onNodeSelect?.(null);
    setSelectedEdge(null);
  }, [onNodeSelect]);

  const handleEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    if (!architecture) return;
    // Find the matching connection
    const conn = architecture.connections.find(
      c => c.from === edge.source && c.to === edge.target
    );
    if (!conn || !onUpdateConnection) return;

    // Get edge center position in screen coords
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return;

    // Use source and target node positions to approximate edge center
    const sourceNode = architecture.components.find(c => c.id === edge.source);
    const targetNode = architecture.components.find(c => c.id === edge.target);
    if (!sourceNode || !targetNode) return;

    const midX = (sourceNode.x + targetNode.x) / 2 + 100; // offset for node width
    const midY = (sourceNode.y + targetNode.y) / 2 + 30;
    const projected = reactFlowInstance.flowToScreenPosition({ x: midX, y: midY });

    setSelectedEdge({
      connection: conn,
      position: { x: projected.x - canvasRect.left, y: projected.y - canvasRect.top },
    });
    setSelectedNode(null);
    onNodeSelect?.(null);
  }, [architecture, onUpdateConnection, reactFlowInstance, onNodeSelect]);

  const handleDeleteSelected = useCallback(() => {
    if (selectedNode) {
      onDeleteComponent(selectedNode);
      setSelectedNode(null);
      onNodeSelect?.(null);
    }
  }, [selectedNode, onDeleteComponent, onNodeSelect]);

  const handleAddFromPalette = useCallback((type: ComponentType) => {
    const name = type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    onAddComponent({
      name,
      type,
      x: 200 + Math.random() * 200,
      y: 150 + Math.random() * 200,
    });
    setShowPalette(false);
  }, [onAddComponent]);

  // Auto-layout
  const handleAutoLayout = useCallback(() => {
    if (!architecture || architecture.components.length === 0) return;
    const laid = autoLayout(nodes, edges);
    setNodes(laid);
    // Batch-update positions to server
    for (const node of laid) {
      onUpdateComponent(node.id, { x: node.position.x, y: node.position.y });
    }
    setTimeout(() => reactFlowInstance.fitView({ padding: 0.3 }), 50);
  }, [architecture, nodes, edges, setNodes, onUpdateComponent, reactFlowInstance]);

  // Edge type cycle
  const handleEdgeTypeCycle = useCallback(() => {
    const cycle: Array<'default' | 'straight' | 'step'> = ['default', 'straight', 'step'];
    const idx = cycle.indexOf(edgeType);
    const next = cycle[(idx + 1) % cycle.length];
    onEdgeTypeChange?.(next);
  }, [edgeType, onEdgeTypeChange]);

  const edgeTypeIcon = edgeType === 'straight' ? 'solar:line-linear'
    : edgeType === 'step' ? 'solar:stairs-linear'
    : 'solar:graph-new-linear';

  // Empty state
  if (!architecture || architecture.components.length === 0) {
    return (
      <div className="architecture-empty">
        <iconify-icon icon="solar:graph-new-linear" width={48} style={{ color: 'var(--text-muted)' }} />
        <h3>No components yet</h3>
        <p className="text-muted text-sm">
          Use the chat to describe your architecture, or add components manually.
        </p>
        <button className="primary" onClick={() => setShowPalette(true)}>
          <iconify-icon icon="solar:add-circle-linear" width={14} />
          Add Component
        </button>

        {showPalette && (
          <div className="component-palette">
            {Object.entries(TYPE_ICONS).map(([type, icon]) => (
              <button
                key={type}
                className="palette-item"
                onClick={() => handleAddFromPalette(type as ComponentType)}
              >
                <iconify-icon icon={icon} width={16} style={{ color: TYPE_COLORS[type] }} />
                <span>{type.replace(/_/g, ' ')}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="architecture-canvas" ref={canvasRef}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        onPaneClick={handlePaneClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#2a2a2a" />
        <Controls showInteractive={false} />
        <MiniMap
          style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8 }}
          nodeColor={(node) => TYPE_COLORS[node.data?.type as string] || '#6366f1'}
          maskColor="rgba(0,0,0,0.7)"
        />

        {/* Toolbar */}
        <Panel position="top-right">
          <div className="canvas-toolbar">
            <button onClick={() => setShowPalette(!showPalette)} title="Add component">
              <iconify-icon icon="solar:add-circle-linear" width={16} />
            </button>
            <button onClick={handleAutoLayout} title="Auto-layout (dagre)">
              <iconify-icon icon="solar:sort-from-top-to-bottom-linear" width={16} />
            </button>
            <button onClick={() => reactFlowInstance.fitView({ padding: 0.3 })} title="Fit to view">
              <iconify-icon icon="solar:maximize-linear" width={16} />
            </button>
            <button onClick={handleEdgeTypeCycle} title={`Edge type: ${edgeType}`}>
              <iconify-icon icon={edgeTypeIcon} width={16} />
            </button>
            {selectedNode && (
              <button onClick={handleDeleteSelected} className="danger" title="Delete selected">
                <iconify-icon icon="solar:trash-bin-minimalistic-linear" width={16} />
              </button>
            )}
          </div>
        </Panel>

        {/* Component palette */}
        {showPalette && (
          <Panel position="top-right">
            <div className="component-palette" style={{ marginTop: 44 }}>
              {Object.entries(TYPE_ICONS).map(([type, icon]) => (
                <button
                  key={type}
                  className="palette-item"
                  onClick={() => handleAddFromPalette(type as ComponentType)}
                >
                  <iconify-icon icon={icon} width={16} style={{ color: TYPE_COLORS[type] }} />
                  <span>{type.replace(/_/g, ' ')}</span>
                </button>
              ))}
            </div>
          </Panel>
        )}
      </ReactFlow>

      {/* Edge edit popover */}
      {selectedEdge && onUpdateConnection && onDeleteConnection && (
        <EdgeEditPopover
          connection={selectedEdge.connection}
          allComponents={architecture.components}
          position={selectedEdge.position}
          onUpdate={onUpdateConnection}
          onDelete={onDeleteConnection}
          onClose={() => setSelectedEdge(null)}
        />
      )}
    </div>
  );
}

// ── Wrapper with ReactFlowProvider ───────────────────────────────────

export default function ArchitectureCanvas(props: ArchitectureCanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}
