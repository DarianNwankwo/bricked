import { useState, useEffect, useCallback } from 'react';
import type { ArchComponent, ArchConnection, ComponentSpec, BACCompleteness } from '../../api/types';
import { TYPE_COLORS, TYPE_ICONS } from './constants';
import { useDebouncedCallback } from '../../hooks/useDebounce';
import './ComponentDetailPanel.css';

interface InnerComponent {
  name: string;
  description: string;
}

interface ComponentDetailPanelProps {
  component: ArchComponent;
  spec: ComponentSpec;
  connections: ArchConnection[];
  allComponents: ArchComponent[];
  completeness?: BACCompleteness | null;
  onUpdateSpec: (id: string, spec: ComponentSpec) => void;
  onUpdateComponent: (id: string, updates: { name?: string }) => void;
  onUpdateConnection: (from: string, to: string, label?: string, contract?: string) => void;
  onDeleteConnection: (from: string, to: string) => void;
  onDeleteComponent: (id: string) => void;
  onClose: () => void;
}

export default function ComponentDetailPanel({
  component,
  spec,
  connections,
  allComponents,
  completeness,
  onUpdateSpec,
  onUpdateComponent,
  onUpdateConnection,
  onDeleteConnection,
  onDeleteComponent,
  onClose,
}: ComponentDetailPanelProps) {
  const color = TYPE_COLORS[component.type] || '#6366f1';
  const icon = TYPE_ICONS[component.type] || 'solar:server-linear';

  // Local state for all editable fields
  const [name, setName] = useState(component.name);
  const [description, setDescription] = useState(spec.description || '');
  const [inputs, setInputs] = useState(spec.inputs || '');
  const [outputs, setOutputs] = useState(spec.outputs || '');
  const [notes, setNotes] = useState(spec.notes || '');
  const [innerComponents, setInnerComponents] = useState<InnerComponent[]>([]);
  const [saved, setSaved] = useState(false);

  // Sync when component/spec changes (e.g. selecting a different node)
  useEffect(() => {
    setName(component.name);
    setDescription(spec.description || '');
    setInputs(spec.inputs || '');
    setOutputs(spec.outputs || '');
    setNotes(spec.notes || '');
  }, [component.id, component.name, spec]);

  const showSaved = useCallback(() => {
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }, []);

  const debouncedUpdateSpec = useDebouncedCallback(
    (desc: string, inp: string, out: string, n: string) => {
      onUpdateSpec(component.id, { description: desc, inputs: inp, outputs: out, notes: n });
      showSaved();
    },
    800
  );

  const debouncedUpdateName = useDebouncedCallback(
    (newName: string) => {
      onUpdateComponent(component.id, { name: newName });
      showSaved();
    },
    800
  );

  const handleDescriptionChange = (val: string) => {
    setDescription(val);
    debouncedUpdateSpec(val, inputs, outputs, notes);
  };
  const handleInputsChange = (val: string) => {
    setInputs(val);
    debouncedUpdateSpec(description, val, outputs, notes);
  };
  const handleOutputsChange = (val: string) => {
    setOutputs(val);
    debouncedUpdateSpec(description, inputs, val, notes);
  };
  const handleNotesChange = (val: string) => {
    setNotes(val);
    debouncedUpdateSpec(description, inputs, outputs, val);
  };
  const handleNameChange = (val: string) => {
    setName(val);
    debouncedUpdateName(val);
  };

  // Find connections related to this component
  const incomingConnections = connections.filter(c => c.to === component.id);
  const outgoingConnections = connections.filter(c => c.from === component.id);
  const relatedConnections = [...outgoingConnections, ...incomingConnections];

  const getComponentName = (id: string) => {
    return allComponents.find(c => c.id === id)?.name || id;
  };

  // Check completeness for this node
  const incompleteNode = completeness?.incompleteNodes?.find(n => n.nodeId === component.id);

  // Inner components
  const handleAddInner = () => {
    setInnerComponents(prev => [...prev, { name: '', description: '' }]);
  };
  const handleUpdateInner = (idx: number, field: 'name' | 'description', val: string) => {
    setInnerComponents(prev => prev.map((ic, i) => i === idx ? { ...ic, [field]: val } : ic));
  };
  const handleRemoveInner = (idx: number) => {
    setInnerComponents(prev => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="detail-panel">
      {/* Header */}
      <div className="detail-header">
        <div className="detail-header-left">
          <div className="detail-icon" style={{ background: `${color}20`, color }}>
            <iconify-icon icon={icon} width={18} />
          </div>
          <div className="detail-header-info">
            <input
              className="detail-name-input"
              value={name}
              onChange={e => handleNameChange(e.target.value)}
              placeholder="Component name"
            />
            <span className="detail-type-badge" style={{ color, background: `${color}15` }}>
              {component.type.replace(/_/g, ' ')}
            </span>
          </div>
        </div>
        <div className="detail-header-actions">
          {saved && <span className="detail-saved">Saved</span>}
          <button onClick={() => onDeleteComponent(component.id)} className="danger" title="Delete component">
            <iconify-icon icon="solar:trash-bin-minimalistic-linear" width={14} />
          </button>
          <button onClick={onClose} title="Close panel">
            <iconify-icon icon="solar:close-circle-linear" width={14} />
          </button>
        </div>
      </div>

      {/* Completeness warning */}
      {incompleteNode && (
        <div className="detail-warning">
          <iconify-icon icon="solar:danger-triangle-linear" width={14} />
          <span>Missing: {incompleteNode.fields.join(', ')}</span>
        </div>
      )}

      {/* Scrollable content */}
      <div className="detail-body">
        {/* Description */}
        <div className="detail-section">
          <label className="detail-label">Description</label>
          <textarea
            className="detail-textarea"
            value={description}
            onChange={e => handleDescriptionChange(e.target.value)}
            placeholder="What does this component do?"
            rows={3}
          />
        </div>

        {/* Input Contract */}
        <div className="detail-section">
          <label className="detail-label">Input Contract</label>
          <textarea
            className="detail-textarea"
            value={inputs}
            onChange={e => handleInputsChange(e.target.value)}
            placeholder="What data/requests does it receive?"
            rows={2}
          />
        </div>

        {/* Output Contract */}
        <div className="detail-section">
          <label className="detail-label">Output Contract</label>
          <textarea
            className="detail-textarea"
            value={outputs}
            onChange={e => handleOutputsChange(e.target.value)}
            placeholder="What does it produce/return?"
            rows={2}
          />
        </div>

        {/* Implementation Notes */}
        <div className="detail-section">
          <label className="detail-label">Implementation Notes</label>
          <textarea
            className="detail-textarea"
            value={notes}
            onChange={e => handleNotesChange(e.target.value)}
            placeholder="Libraries, edge cases, performance notes..."
            rows={2}
          />
        </div>

        {/* Connection Contracts */}
        {relatedConnections.length > 0 && (
          <div className="detail-section">
            <label className="detail-label">Connections</label>
            <div className="detail-connections">
              {relatedConnections.map((conn, i) => {
                const isOutgoing = conn.from === component.id;
                const otherName = isOutgoing ? getComponentName(conn.to) : getComponentName(conn.from);
                return (
                  <ConnectionEditor
                    key={`${conn.from}-${conn.to}-${i}`}
                    connection={conn}
                    isOutgoing={isOutgoing}
                    otherName={otherName}
                    onUpdate={onUpdateConnection}
                    onDelete={onDeleteConnection}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Inner Components */}
        <div className="detail-section">
          <div className="detail-label-row">
            <label className="detail-label">Inner Components</label>
            <button className="detail-add-btn" onClick={handleAddInner}>
              <iconify-icon icon="solar:add-circle-linear" width={12} />
              Add
            </button>
          </div>
          {innerComponents.map((ic, idx) => (
            <div key={idx} className="detail-inner-item">
              <input
                className="detail-input"
                value={ic.name}
                onChange={e => handleUpdateInner(idx, 'name', e.target.value)}
                placeholder="Name"
              />
              <input
                className="detail-input"
                value={ic.description}
                onChange={e => handleUpdateInner(idx, 'description', e.target.value)}
                placeholder="Description"
              />
              <button className="detail-remove-btn" onClick={() => handleRemoveInner(idx)}>
                <iconify-icon icon="solar:close-circle-linear" width={12} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Sub-component for editing a single connection
function ConnectionEditor({
  connection,
  isOutgoing,
  otherName,
  onUpdate,
  onDelete,
}: {
  connection: ArchConnection;
  isOutgoing: boolean;
  otherName: string;
  onUpdate: (from: string, to: string, label?: string, contract?: string) => void;
  onDelete: (from: string, to: string) => void;
}) {
  const [label, setLabel] = useState(connection.label || '');
  const [contract, setContract] = useState(connection.contract?.notes || '');

  const debouncedUpdate = useDebouncedCallback(
    (l: string, c: string) => {
      onUpdate(connection.from, connection.to, l, c);
    },
    800
  );

  useEffect(() => {
    setLabel(connection.label || '');
    setContract(connection.contract?.notes || '');
  }, [connection.from, connection.to, connection.label, connection.contract]);

  return (
    <div className="connection-editor">
      <div className="connection-editor-header">
        <span className={`connection-dir ${isOutgoing ? 'outgoing' : 'incoming'}`}>
          {isOutgoing ? '\u2192' : '\u2190'}
        </span>
        <span className="connection-other-name">{otherName}</span>
        <button
          className="connection-delete-btn"
          onClick={() => onDelete(connection.from, connection.to)}
          title="Delete connection"
        >
          <iconify-icon icon="solar:close-circle-linear" width={12} />
        </button>
      </div>
      <input
        className="detail-input"
        value={label}
        onChange={e => {
          setLabel(e.target.value);
          debouncedUpdate(e.target.value, contract);
        }}
        placeholder="Label"
      />
      <textarea
        className="detail-textarea detail-textarea-sm"
        value={contract}
        onChange={e => {
          setContract(e.target.value);
          debouncedUpdate(label, e.target.value);
        }}
        placeholder="Data contract..."
        rows={2}
      />
    </div>
  );
}
