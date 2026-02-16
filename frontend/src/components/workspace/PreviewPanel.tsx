import type { PreviewStatus } from '../../api/types';
import './PreviewPanel.css';

interface PreviewPanelProps {
  status: PreviewStatus;
  onStart: () => void;
  onStop: () => void;
  projectId: string;
}

export default function PreviewPanel({ status, onStart, onStop, projectId }: PreviewPanelProps) {
  const isRunning = status.status === 'running';
  const isStarting = status.status === 'starting';

  // Find the main web service URL
  const previewUrl = status.urls
    ? Object.values(status.urls)[0]
    : status.services?.find(s => s.port)
      ? `http://localhost:${status.services.find(s => s.port)!.port}`
      : null;

  if (status.status === 'not_started') {
    return (
      <div className="preview-empty">
        <iconify-icon icon="solar:monitor-smartphone-linear" width={48} style={{ color: 'var(--text-muted)' }} />
        <h3>Preview your app</h3>
        <p className="text-muted text-sm">
          Start a local Docker preview to see your generated app running.
        </p>
        <button className="primary" onClick={onStart}>
          <iconify-icon icon="solar:play-linear" width={14} />
          Start Preview
        </button>
      </div>
    );
  }

  if (isStarting) {
    return (
      <div className="preview-empty">
        <div className="preview-spinner animate-spin">
          <iconify-icon icon="solar:refresh-linear" width={32} />
        </div>
        <h3>Starting preview...</h3>
        <p className="text-muted text-sm">Docker containers are spinning up</p>
      </div>
    );
  }

  if (status.status === 'error') {
    return (
      <div className="preview-empty">
        <iconify-icon icon="solar:danger-triangle-linear" width={48} style={{ color: 'var(--error)' }} />
        <h3>Preview failed</h3>
        <p className="text-muted text-sm">{status.error || 'An error occurred'}</p>
        <div className="preview-actions">
          <button className="primary" onClick={onStart}>
            <iconify-icon icon="solar:refresh-linear" width={14} />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="preview-panel">
      <div className="preview-toolbar">
        <div className="preview-status-bar">
          <span className="status-dot" />
          <span className="text-sm">Running</span>
          {previewUrl && (
            <span className="preview-url text-xs text-muted mono">{previewUrl}</span>
          )}
        </div>
        <div className="preview-actions">
          {previewUrl && (
            <button onClick={() => window.open(previewUrl, '_blank')} title="Open in new tab">
              <iconify-icon icon="solar:arrow-to-top-right-linear" width={14} />
            </button>
          )}
          <button onClick={onStart} title="Rebuild">
            <iconify-icon icon="solar:refresh-linear" width={14} />
          </button>
          <button onClick={onStop} className="danger" title="Stop preview">
            <iconify-icon icon="solar:stop-linear" width={14} />
          </button>
        </div>
      </div>

      {/* Services list */}
      {status.services && status.services.length > 0 && (
        <div className="preview-services">
          {status.services.map((svc, i) => (
            <div key={i} className="preview-service">
              <span className={`status-dot ${svc.status === 'running' ? '' : 'building'}`} />
              <span className="text-sm">{svc.name}</span>
              {svc.port && <span className="text-xs text-muted mono">:{svc.port}</span>}
              <span className="text-xs text-muted">{svc.status}</span>
            </div>
          ))}
        </div>
      )}

      {/* Preview iframe */}
      {previewUrl && isRunning && (
        <div className="preview-iframe-wrapper">
          <iframe
            src={previewUrl}
            className="preview-iframe"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            title="Preview"
          />
        </div>
      )}
    </div>
  );
}
