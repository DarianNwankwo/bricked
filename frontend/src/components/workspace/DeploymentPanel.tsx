import { useState, useEffect, useRef, useCallback } from 'react';
import './DeploymentPanel.css';

interface Environment {
  id: string;
  name: string;
  status: 'not_deployed' | 'deploying' | 'live' | 'failed' | 'stopped';
  url?: string;
  lastDeployedAt?: string;
  monthlyCostCents?: number;
}

interface DeploymentPanelProps {
  projectId: string;
  environments: Environment[];
  estimatedMonthlyCostCents?: number;
  onDeploy: (environment: string) => Promise<{ deploymentId: string }>;
  onStop: (environment: string) => Promise<void>;
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${diffDay}d ago`;
}

function formatCost(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function statusDotClass(status: Environment['status']): string {
  switch (status) {
    case 'live': return '';
    case 'deploying': return 'building';
    case 'failed': return 'error';
    case 'stopped':
    case 'not_deployed':
    default: return 'offline';
  }
}

function statusLabel(status: Environment['status']): string {
  switch (status) {
    case 'live': return 'Live';
    case 'deploying': return 'Deploying';
    case 'failed': return 'Failed';
    case 'stopped': return 'Stopped';
    case 'not_deployed':
    default: return 'Not deployed';
  }
}

export default function DeploymentPanel({
  projectId,
  environments,
  estimatedMonthlyCostCents,
  onDeploy,
  onStop,
}: DeploymentPanelProps) {
  const [activeDeployment, setActiveDeployment] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [deployingEnv, setDeployingEnv] = useState<string | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll log viewer to bottom
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // SSE log streaming
  useEffect(() => {
    if (!activeDeployment) return;

    const controller = new AbortController();
    const token = localStorage.getItem('brick-auth-token');
    const sessionProjectId = localStorage.getItem('brick-session-project-id');

    const headers: Record<string, string> = {
      'Accept': 'text/event-stream',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (sessionProjectId) headers['X-Project-Id'] = sessionProjectId;

    fetch(`/api/deployments/${activeDeployment}/logs`, {
      headers,
      signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok || !response.body) return;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            try {
              const parsed = JSON.parse(data);
              if (parsed.message) {
                setLogs(prev => [...prev, parsed.message]);
              }
              if (parsed.status === 'live' || parsed.status === 'failed') {
                // Deployment finished
                setDeployingEnv(null);
              }
            } catch {
              // Plain text log line
              setLogs(prev => [...prev, data]);
            }
          }
        }
      }
    }).catch((err) => {
      if (err.name !== 'AbortError') {
        setLogs(prev => [...prev, `[Error] ${err.message}`]);
      }
    });

    return () => controller.abort();
  }, [activeDeployment]);

  const handleDeploy = useCallback(async (envName: string) => {
    setDeployingEnv(envName);
    setLogs([]);
    try {
      const result = await onDeploy(envName);
      setActiveDeployment(result.deploymentId);
    } catch (err: any) {
      setLogs([`[Error] Failed to start deployment: ${err.message || 'Unknown error'}`]);
      setDeployingEnv(null);
    }
  }, [onDeploy]);

  const handleStop = useCallback(async (envName: string) => {
    try {
      await onStop(envName);
    } catch (err: any) {
      setLogs(prev => [...prev, `[Error] Failed to stop: ${err.message || 'Unknown error'}`]);
    }
  }, [onStop]);

  const handleCloseLog = useCallback(() => {
    setActiveDeployment(null);
    setLogs([]);
  }, []);

  // Empty state — no environments yet
  if (environments.length === 0) {
    return (
      <div className="deploy-empty">
        <iconify-icon icon="solar:cloud-upload-linear" width={48} style={{ color: 'var(--text-muted)' }} />
        <h3>Deploy your app</h3>
        <p className="text-muted text-sm">
          Set up your first environment to deploy your generated app.
        </p>
        <button className="primary" onClick={() => handleDeploy('development')}>
          <iconify-icon icon="solar:rocket-linear" width={14} />
          Deploy to Development
        </button>
      </div>
    );
  }

  return (
    <div className="deploy-panel">
      {/* Environment cards */}
      <div className="deploy-env-grid">
        {environments.map((env) => (
          <div key={env.id} className="deploy-env-card">
            <div className="deploy-env-header">
              <span className={`status-dot ${statusDotClass(env.status)}`} />
              <span className="deploy-env-name">{env.name}</span>
              <span className="deploy-env-status text-xs text-muted">{statusLabel(env.status)}</span>
            </div>

            {env.url && env.status === 'live' && (
              <a
                href={env.url}
                target="_blank"
                rel="noopener noreferrer"
                className="deploy-env-url text-xs mono truncate"
              >
                {env.url}
              </a>
            )}

            <div className="deploy-env-meta">
              {env.lastDeployedAt && (
                <span className="text-xs text-muted">
                  Deployed {formatRelativeTime(env.lastDeployedAt)}
                </span>
              )}
              {env.monthlyCostCents != null && env.monthlyCostCents > 0 && (
                <span className="text-xs text-muted">
                  {formatCost(env.monthlyCostCents)}/mo
                </span>
              )}
            </div>

            <div className="deploy-env-actions">
              {env.status === 'deploying' || env.status === 'live' ? (
                <button
                  className="danger"
                  onClick={() => handleStop(env.name)}
                >
                  <iconify-icon icon="solar:stop-linear" width={14} />
                  Stop
                </button>
              ) : (
                <button
                  className="primary"
                  onClick={() => handleDeploy(env.name)}
                  disabled={deployingEnv === env.name}
                >
                  <iconify-icon icon="solar:rocket-linear" width={14} />
                  {env.status === 'failed' ? 'Redeploy' : 'Deploy'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Cost estimate */}
      {estimatedMonthlyCostCents != null && estimatedMonthlyCostCents > 0 && (
        <div className="deploy-cost-estimate">
          <iconify-icon icon="solar:wallet-linear" width={14} style={{ color: 'var(--text-muted)' }} />
          <span className="text-sm text-muted">
            Estimated: ~{formatCost(estimatedMonthlyCostCents)}/mo
          </span>
        </div>
      )}

      {/* Active deployment log viewer */}
      {activeDeployment && (
        <div className="deploy-log-viewer">
          <div className="deploy-log-header">
            <div className="deploy-log-status">
              {deployingEnv ? (
                <>
                  <span className="status-dot building" />
                  <span className="text-sm">Deploying...</span>
                </>
              ) : (
                <>
                  <span className="status-dot" />
                  <span className="text-sm">Deployment complete</span>
                </>
              )}
            </div>
            <button onClick={handleCloseLog} title="Close logs">
              <iconify-icon icon="solar:close-circle-linear" width={16} />
            </button>
          </div>
          <div className="deploy-log-content mono">
            {logs.map((line, i) => (
              <div key={i} className="deploy-log-line">{line}</div>
            ))}
            <div ref={logEndRef} />
          </div>
        </div>
      )}
    </div>
  );
}
