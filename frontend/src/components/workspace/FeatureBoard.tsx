import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Feature, FeatureStatus } from '../../api/types';
import './FeatureBoard.css';

interface FeatureBoardProps {
  features: Feature[];
  onMove: (featureId: string, newStatus: FeatureStatus) => void;
  onAdd: (title: string, description: string) => void;
}

const COLUMNS: { id: FeatureStatus; label: string; icon: string }[] = [
  { id: 'backlog', label: 'Backlog', icon: 'solar:inbox-linear' },
  { id: 'in_progress', label: 'In Progress', icon: 'solar:play-circle-linear' },
  { id: 'review', label: 'Review', icon: 'solar:eye-linear' },
  { id: 'deployed', label: 'Deployed', icon: 'solar:cloud-check-linear' },
];

const AGENT_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  idle: { label: 'Idle', color: 'var(--text-muted)' },
  planning: { label: 'Planning...', color: 'var(--warning)' },
  building: { label: 'Building...', color: 'var(--accent)' },
  testing: { label: 'Testing...', color: '#a855f7' },
  complete: { label: 'Complete', color: 'var(--success)' },
  error: { label: 'Error', color: 'var(--error)' },
};

function FeatureCard({ feature, isDragging }: { feature: Feature; isDragging?: boolean }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: feature.id, data: { status: feature.status } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const agentInfo = feature.agentStatus ? AGENT_STATUS_LABELS[feature.agentStatus] : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="feature-card"
    >
      <div className="feature-card-title">{feature.title}</div>
      {feature.description && (
        <div className="feature-card-desc text-muted text-xs">{feature.description}</div>
      )}
      {agentInfo && (
        <div className="feature-card-agent text-xs" style={{ color: agentInfo.color }}>
          <iconify-icon icon="solar:cpu-bolt-linear" width={12} />
          {agentInfo.label}
        </div>
      )}
    </div>
  );
}

function FeatureCardOverlay({ feature }: { feature: Feature }) {
  return (
    <div className="feature-card feature-card-overlay">
      <div className="feature-card-title">{feature.title}</div>
    </div>
  );
}

export default function FeatureBoard({ features, onMove, onAdd }: FeatureBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const featureId = active.id as string;
    const overId = over.id as string;

    // Check if dropped on a column
    const column = COLUMNS.find(c => c.id === overId);
    if (column) {
      onMove(featureId, column.id);
      return;
    }

    // Check if dropped on another card — use that card's status
    const overFeature = features.find(f => f.id === overId);
    if (overFeature) {
      onMove(featureId, overFeature.status);
    }
  };

  const handleAddFeature = () => {
    if (!newTitle.trim()) return;
    onAdd(newTitle.trim(), newDesc.trim());
    setNewTitle('');
    setNewDesc('');
    setShowAddForm(false);
  };

  const activeFeature = features.find(f => f.id === activeId);

  return (
    <div className="feature-board">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="feature-columns">
          {COLUMNS.map((column) => {
            const columnFeatures = features.filter(f => f.status === column.id);
            return (
              <div key={column.id} className="feature-column" id={column.id}>
                <div className="feature-column-header">
                  <iconify-icon icon={column.icon} width={13} />
                  <span>{column.label}</span>
                  <span className="feature-count">{columnFeatures.length}</span>
                </div>
                <SortableContext
                  items={columnFeatures.map(f => f.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="feature-column-body" data-column={column.id}>
                    {columnFeatures.map((feature) => (
                      <FeatureCard
                        key={feature.id}
                        feature={feature}
                        isDragging={feature.id === activeId}
                      />
                    ))}
                    {columnFeatures.length === 0 && (
                      <div className="feature-column-empty text-xs text-muted">
                        {column.id === 'backlog' ? 'Add features below' : 'Drag features here'}
                      </div>
                    )}
                  </div>
                </SortableContext>
              </div>
            );
          })}
        </div>

        <DragOverlay>
          {activeFeature ? <FeatureCardOverlay feature={activeFeature} /> : null}
        </DragOverlay>
      </DndContext>

      {/* Add feature */}
      <div className="feature-add-section">
        {showAddForm ? (
          <div className="feature-add-form">
            <input
              placeholder="Feature title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddFeature()}
              autoFocus
            />
            <textarea
              placeholder="Description (optional)"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              rows={2}
            />
            <div className="feature-add-actions">
              <button className="primary" onClick={handleAddFeature} disabled={!newTitle.trim()}>
                Add
              </button>
              <button onClick={() => setShowAddForm(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <button className="feature-add-btn" onClick={() => setShowAddForm(true)}>
            <iconify-icon icon="solar:add-circle-linear" width={14} />
            Add Feature
          </button>
        )}
      </div>
    </div>
  );
}
