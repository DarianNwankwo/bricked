import { useState, useEffect, useRef, useCallback } from 'react';
import type { Feature, FeatureStatus } from '../../api/types';
import './FeatureBoard.css';

interface FeatureBoardProps {
  features: Feature[];
  onAdd: (title: string, description: string) => void;
  onEdit: (featureId: string, updates: { title?: string; description?: string }) => void;
  onDelete: (featureId: string) => void;
  onStartNow: (featureId: string) => void;
  onCancelTimer: (featureId: string) => void;
  onTimerExpire: (featureId: string) => void;
  onRequestContext: (featureId: string) => void;
}

const COLUMNS: { id: FeatureStatus; label: string; icon: string; emptyText: string }[] = [
  { id: 'backlog', label: 'Backlog', icon: 'solar:inbox-linear', emptyText: 'Add features below \u2014 agents pick them up automatically' },
  { id: 'in_progress', label: 'In Progress', icon: 'solar:play-circle-linear', emptyText: 'Agent is working...' },
  { id: 'review', label: 'Review', icon: 'solar:eye-linear', emptyText: 'Awaiting your review' },
  { id: 'deployed', label: 'Deployed', icon: 'solar:cloud-check-linear', emptyText: 'Shipped!' },
];

const AGENT_STATUS_CONFIG: Record<string, { label: string; color: string; icon: string; animate?: boolean }> = {
  waiting: { label: 'Waiting...', color: 'var(--text-muted)', icon: 'solar:clock-circle-linear' },
  needs_context: { label: 'Needs context', color: 'var(--warning)', icon: 'solar:chat-round-dots-linear' },
  planning: { label: 'Planning...', color: 'var(--warning)', icon: 'solar:map-linear', animate: true },
  building: { label: 'Building...', color: 'var(--accent)', icon: 'solar:code-linear', animate: true },
  testing: { label: 'Testing...', color: '#a855f7', icon: 'solar:test-tube-linear', animate: true },
  complete: { label: 'Complete', color: 'var(--success)', icon: 'solar:check-circle-linear' },
  error: { label: 'Error', color: 'var(--error)', icon: 'solar:danger-triangle-linear' },
};

const TIMER_DURATION = 180000; // 3 minutes in ms

function formatCountdown(ms: number): string {
  if (ms <= 0) return '0:00';
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function TimerBar({ remaining, total }: { remaining: number; total: number }) {
  const fraction = Math.max(0, Math.min(1, remaining / total));
  return (
    <div className="feature-timer-bar">
      <div className="feature-timer-bar-fill" style={{ width: `${fraction * 100}%` }} />
    </div>
  );
}

interface FeatureCardProps {
  feature: Feature;
  timerEnd: number | null;
  cancelled: boolean;
  onEdit: FeatureBoardProps['onEdit'];
  onDelete: FeatureBoardProps['onDelete'];
  onStartNow: FeatureBoardProps['onStartNow'];
  onCancelTimer: FeatureBoardProps['onCancelTimer'];
  onTimerExpire: FeatureBoardProps['onTimerExpire'];
  onRequestContext: FeatureBoardProps['onRequestContext'];
}

function FeatureCard({
  feature,
  timerEnd,
  cancelled,
  onEdit,
  onDelete,
  onStartNow,
  onCancelTimer,
  onTimerExpire,
  onRequestContext,
}: FeatureCardProps) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(feature.title);
  const [editDesc, setEditDesc] = useState(feature.description);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [remaining, setRemaining] = useState<number>(0);
  const expiredRef = useRef(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const isBacklog = feature.status === 'backlog';
  const hasTimer = isBacklog && timerEnd !== null && !cancelled;
  const agentInfo = feature.agentStatus ? AGENT_STATUS_CONFIG[feature.agentStatus] : null;
  const needsContext = feature.agentStatus === 'needs_context';

  // Timer countdown
  useEffect(() => {
    if (!hasTimer || timerEnd === null) {
      setRemaining(0);
      return;
    }

    expiredRef.current = false;

    const tick = () => {
      const left = timerEnd - Date.now();
      setRemaining(Math.max(0, left));
      if (left <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        onTimerExpire(feature.id);
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [hasTimer, timerEnd, feature.id, onTimerExpire]);

  // Focus title input when entering edit mode
  useEffect(() => {
    if (editing && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [editing]);

  const startEditing = useCallback(() => {
    setEditTitle(feature.title);
    setEditDesc(feature.description);
    setEditing(true);
  }, [feature.title, feature.description]);

  const saveEdit = useCallback(() => {
    const updates: { title?: string; description?: string } = {};
    if (editTitle.trim() && editTitle.trim() !== feature.title) {
      updates.title = editTitle.trim();
    }
    if (editDesc.trim() !== feature.description) {
      updates.description = editDesc.trim();
    }
    if (updates.title !== undefined || updates.description !== undefined) {
      onEdit(feature.id, updates);
    }
    setEditing(false);
  }, [editTitle, editDesc, feature.id, feature.title, feature.description, onEdit]);

  const cancelEdit = useCallback(() => {
    setEditing(false);
  }, []);

  const handleEditKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      saveEdit();
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  }, [saveEdit, cancelEdit]);

  const handleDelete = useCallback(() => {
    onDelete(feature.id);
    setConfirmingDelete(false);
  }, [feature.id, onDelete]);

  return (
    <div className={`feature-card${needsContext ? ' feature-card--needs-context' : ''}${editing ? ' feature-card--editing' : ''}`}>
      {/* Needs context banner */}
      {needsContext && !editing && (
        <div className="feature-context-banner">
          <iconify-icon icon="solar:chat-round-dots-linear" width={13} />
          <span>Agent needs more context</span>
          <button
            className="feature-context-btn"
            onClick={() => onRequestContext(feature.id)}
          >
            Provide context
          </button>
        </div>
      )}

      {/* Card body */}
      {editing ? (
        <div className="feature-card-edit">
          <input
            ref={titleInputRef}
            className="feature-edit-title"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={handleEditKeyDown}
            placeholder="Feature title"
          />
          <textarea
            className="feature-edit-desc"
            value={editDesc}
            onChange={(e) => setEditDesc(e.target.value)}
            onKeyDown={handleEditKeyDown}
            placeholder="Description (optional)"
            rows={3}
          />
          <div className="feature-edit-actions">
            <button className="feature-edit-save" onClick={saveEdit} disabled={!editTitle.trim()}>
              Save
            </button>
            <button className="feature-edit-cancel" onClick={cancelEdit}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="feature-card-content">
            <div className="feature-card-title" onDoubleClick={startEditing}>
              {feature.title}
            </div>
            {feature.description && (
              <div className="feature-card-desc">{feature.description}</div>
            )}
          </div>

          {/* Agent status badge */}
          {agentInfo && (
            <div
              className={`feature-agent-badge${agentInfo.animate ? ' feature-agent-badge--animated' : ''}`}
              style={{ color: agentInfo.color }}
            >
              <iconify-icon icon={agentInfo.icon} width={12} />
              <span>{agentInfo.label}</span>
            </div>
          )}

          {/* Timer section */}
          {hasTimer && remaining > 0 && (
            <div className="feature-timer">
              <TimerBar remaining={remaining} total={TIMER_DURATION} />
              <div className="feature-timer-row">
                <span className="feature-timer-text">
                  Agent starts in {formatCountdown(remaining)}
                </span>
                <button
                  className="feature-timer-cancel"
                  onClick={() => onCancelTimer(feature.id)}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Cancelled timer note */}
          {isBacklog && cancelled && (
            <div className="feature-timer-cancelled">
              <iconify-icon icon="solar:pause-circle-linear" width={12} />
              <span>Auto-start cancelled</span>
            </div>
          )}

          {/* Delete confirmation */}
          {confirmingDelete && (
            <div className="feature-delete-confirm">
              <span>Delete this feature?</span>
              <button className="feature-delete-yes" onClick={handleDelete}>Yes</button>
              <button className="feature-delete-no" onClick={() => setConfirmingDelete(false)}>No</button>
            </div>
          )}

          {/* Action buttons row */}
          {!confirmingDelete && (
            <div className="feature-card-actions">
              <button
                className="feature-action-btn"
                title="Edit"
                onClick={startEditing}
              >
                <iconify-icon icon="solar:pen-linear" width={13} />
              </button>
              <button
                className="feature-action-btn feature-action-btn--danger"
                title="Delete"
                onClick={() => setConfirmingDelete(true)}
              >
                <iconify-icon icon="solar:trash-bin-minimalistic-linear" width={13} />
              </button>
              {isBacklog && !cancelled && (
                <button
                  className="feature-action-btn feature-action-btn--start"
                  title="Start Now"
                  onClick={() => onStartNow(feature.id)}
                >
                  <iconify-icon icon="solar:play-linear" width={13} />
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function FeatureBoard({
  features,
  onAdd,
  onEdit,
  onDelete,
  onStartNow,
  onCancelTimer,
  onTimerExpire,
  onRequestContext,
}: FeatureBoardProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  // Timer state: featureId -> timestamp when timer expires
  const [timers, setTimers] = useState<Map<string, number>>(new Map());
  // Track which timers have been cancelled by the user
  const [cancelledTimers, setCancelledTimers] = useState<Set<string>>(new Set());
  // Track known feature IDs to detect new ones
  const prevFeatureIdsRef = useRef<Set<string>>(new Set());

  // Detect new features and set timers for them
  useEffect(() => {
    const currentIds = new Set(features.map(f => f.id));
    const prevIds = prevFeatureIdsRef.current;

    const newFeatures: string[] = [];
    for (const id of currentIds) {
      if (!prevIds.has(id)) {
        // Only add timers for backlog features
        const feat = features.find(f => f.id === id);
        if (feat && feat.status === 'backlog') {
          newFeatures.push(id);
        }
      }
    }

    if (newFeatures.length > 0) {
      setTimers(prev => {
        const next = new Map(prev);
        const expireAt = Date.now() + TIMER_DURATION;
        for (const id of newFeatures) {
          if (!next.has(id)) {
            next.set(id, expireAt);
          }
        }
        return next;
      });
    }

    prevFeatureIdsRef.current = currentIds;
  }, [features]);

  // Handle cancel timer: mark as cancelled
  const handleCancelTimer = useCallback((featureId: string) => {
    setCancelledTimers(prev => {
      const next = new Set(prev);
      next.add(featureId);
      return next;
    });
    onCancelTimer(featureId);
  }, [onCancelTimer]);

  // Handle start now: remove timer and forward
  const handleStartNow = useCallback((featureId: string) => {
    setTimers(prev => {
      const next = new Map(prev);
      next.delete(featureId);
      return next;
    });
    setCancelledTimers(prev => {
      const next = new Set(prev);
      next.delete(featureId);
      return next;
    });
    onStartNow(featureId);
  }, [onStartNow]);

  // Handle timer expire: remove timer entry
  const handleTimerExpire = useCallback((featureId: string) => {
    setTimers(prev => {
      const next = new Map(prev);
      next.delete(featureId);
      return next;
    });
    onTimerExpire(featureId);
  }, [onTimerExpire]);

  // Handle delete: also clean up timer state
  const handleDelete = useCallback((featureId: string) => {
    setTimers(prev => {
      const next = new Map(prev);
      next.delete(featureId);
      return next;
    });
    setCancelledTimers(prev => {
      const next = new Set(prev);
      next.delete(featureId);
      return next;
    });
    onDelete(featureId);
  }, [onDelete]);

  const handleAddFeature = useCallback(() => {
    if (!newTitle.trim()) return;
    onAdd(newTitle.trim(), newDesc.trim());
    setNewTitle('');
    setNewDesc('');
    setShowAddForm(false);
  }, [newTitle, newDesc, onAdd]);

  const handleAddKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAddFeature();
    } else if (e.key === 'Escape') {
      setShowAddForm(false);
    }
  }, [handleAddFeature]);

  return (
    <div className="feature-board">
      <div className="feature-columns">
        {COLUMNS.map((column) => {
          const columnFeatures = features.filter(f => f.status === column.id);
          return (
            <div key={column.id} className="feature-column">
              <div className="feature-column-header">
                <iconify-icon icon={column.icon} width={13} />
                <span>{column.label}</span>
                <span className="feature-count">{columnFeatures.length}</span>
              </div>
              <div className="feature-column-body">
                {columnFeatures.map((feature) => (
                  <FeatureCard
                    key={feature.id}
                    feature={feature}
                    timerEnd={timers.get(feature.id) ?? null}
                    cancelled={cancelledTimers.has(feature.id)}
                    onEdit={onEdit}
                    onDelete={handleDelete}
                    onStartNow={handleStartNow}
                    onCancelTimer={handleCancelTimer}
                    onTimerExpire={handleTimerExpire}
                    onRequestContext={onRequestContext}
                  />
                ))}
                {columnFeatures.length === 0 && (
                  <div className="feature-column-empty">
                    {column.emptyText}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add feature */}
      <div className="feature-add-section">
        {showAddForm ? (
          <div className="feature-add-form">
            <input
              placeholder="Feature title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={handleAddKeyDown}
              autoFocus
            />
            <textarea
              placeholder="Description (optional)"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              onKeyDown={handleAddKeyDown}
              rows={2}
            />
            <div className="feature-add-actions">
              <button className="primary" onClick={handleAddFeature} disabled={!newTitle.trim()}>
                Add
              </button>
              <button onClick={() => { setShowAddForm(false); setNewTitle(''); setNewDesc(''); }}>
                Cancel
              </button>
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
