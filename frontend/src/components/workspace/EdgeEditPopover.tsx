import { useState, useEffect, useRef } from 'react';
import type { ArchConnection, ArchComponent } from '../../api/types';
import { useDebouncedCallback } from '../../hooks/useDebounce';
import './EdgeEditPopover.css';

interface EdgeEditPopoverProps {
  connection: ArchConnection;
  allComponents: ArchComponent[];
  position: { x: number; y: number };
  onUpdate: (from: string, to: string, label?: string, contract?: string) => void;
  onDelete: (from: string, to: string) => void;
  onClose: () => void;
}

export default function EdgeEditPopover({
  connection,
  allComponents,
  position,
  onUpdate,
  onDelete,
  onClose,
}: EdgeEditPopoverProps) {
  const [label, setLabel] = useState(connection.label || '');
  const [contract, setContract] = useState(connection.contract?.notes || '');
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLabel(connection.label || '');
    setContract(connection.contract?.notes || '');
  }, [connection.from, connection.to, connection.label, connection.contract]);

  // Click-away to close
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Delay to avoid immediate close from the click that opened us
    const timer = setTimeout(() => document.addEventListener('mousedown', handleClick), 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [onClose]);

  const debouncedUpdate = useDebouncedCallback(
    (l: string, c: string) => {
      onUpdate(connection.from, connection.to, l, c);
    },
    800
  );

  const sourceName = allComponents.find(c => c.id === connection.from)?.name || connection.from;
  const targetName = allComponents.find(c => c.id === connection.to)?.name || connection.to;

  return (
    <div
      ref={popoverRef}
      className="edge-popover"
      style={{ left: position.x, top: position.y }}
    >
      <div className="edge-popover-header">
        <span className="edge-popover-route">
          {sourceName} <span className="edge-popover-arrow">&rarr;</span> {targetName}
        </span>
        <button onClick={onClose} className="edge-popover-close" title="Close">
          <iconify-icon icon="solar:close-circle-linear" width={12} />
        </button>
      </div>

      <div className="edge-popover-body">
        <label className="edge-popover-label">Label</label>
        <input
          className="edge-popover-input"
          value={label}
          onChange={e => {
            setLabel(e.target.value);
            debouncedUpdate(e.target.value, contract);
          }}
          placeholder="e.g. REST, gRPC, events..."
        />

        <label className="edge-popover-label">Data Contract</label>
        <textarea
          className="edge-popover-textarea"
          value={contract}
          onChange={e => {
            setContract(e.target.value);
            debouncedUpdate(label, e.target.value);
          }}
          placeholder="Describe the data flowing through this connection..."
          rows={3}
        />
      </div>

      <div className="edge-popover-footer">
        <button
          className="edge-popover-delete"
          onClick={() => {
            onDelete(connection.from, connection.to);
            onClose();
          }}
        >
          <iconify-icon icon="solar:trash-bin-minimalistic-linear" width={12} />
          Delete connection
        </button>
      </div>
    </div>
  );
}
