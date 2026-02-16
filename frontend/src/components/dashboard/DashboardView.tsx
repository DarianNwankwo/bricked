import { useNavigate } from 'react-router-dom';
import { useProjects } from '../../hooks/useProjects';
import './DashboardView.css';

export default function DashboardView() {
  const navigate = useNavigate();
  const { projects, loading, createProject } = useProjects();

  const liveCount = projects.filter(p => p.environments?.some(e => e.status === 'live')).length;
  const draftCount = projects.filter(p => !p.environments?.some(e => e.status === 'live')).length;

  const handleNewProject = async () => {
    try {
      const project = await createProject('Untitled Project');
      navigate(`/project/${project.id}`);
    } catch (err) {
      console.error('Failed to create project:', err);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="animate-pulse">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="dashboard animate-fade-in">
      <header className="dashboard-header">
        <div>
          <h1>Dashboard</h1>
          <p className="text-muted">Overview of your projects and deployments</p>
        </div>
        <button className="primary" onClick={handleNewProject}>
          <iconify-icon icon="solar:add-circle-linear" width={16} />
          New Project
        </button>
      </header>

      {/* Stats row */}
      <div className="dashboard-stats">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
            <iconify-icon icon="solar:folder-with-files-bold" width={20} />
          </div>
          <div className="stat-info">
            <div className="stat-value">{projects.length}</div>
            <div className="stat-label">Total Projects</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--success-dim)', color: 'var(--success)' }}>
            <iconify-icon icon="solar:cloud-check-bold" width={20} />
          </div>
          <div className="stat-info">
            <div className="stat-value">{liveCount}</div>
            <div className="stat-label">Live Deployments</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--warning-dim)', color: 'var(--warning)' }}>
            <iconify-icon icon="solar:pen-new-square-bold" width={20} />
          </div>
          <div className="stat-info">
            <div className="stat-value">{draftCount}</div>
            <div className="stat-label">Drafts</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(168,85,247,0.15)', color: '#a855f7' }}>
            <iconify-icon icon="solar:cpu-bolt-bold" width={20} />
          </div>
          <div className="stat-info">
            <div className="stat-value">Healthy</div>
            <div className="stat-label">Platform Status</div>
          </div>
        </div>
      </div>

      {/* Recent projects */}
      <div className="dashboard-section">
        <div className="section-header">
          <h2>Recent Projects</h2>
          <button onClick={() => navigate('/projects')}>
            View all
            <iconify-icon icon="solar:arrow-right-linear" width={14} />
          </button>
        </div>

        {projects.length === 0 ? (
          <div className="dashboard-empty">
            <iconify-icon icon="solar:layers-minimalistic-linear" width={48} style={{ color: 'var(--text-muted)' }} />
            <h3>No projects yet</h3>
            <p className="text-muted">Create your first architecture project to get started</p>
            <button className="primary" onClick={handleNewProject}>
              <iconify-icon icon="solar:add-circle-linear" width={16} />
              Create Project
            </button>
          </div>
        ) : (
          <div className="project-grid">
            {projects.slice(0, 6).map((project) => (
              <div
                key={project.id}
                className="project-card"
                onClick={() => navigate(`/project/${project.id}`)}
              >
                <div className="project-card-header">
                  <div className="project-card-icon">
                    <iconify-icon icon="solar:cloud-linear" width={18} />
                  </div>
                  <div className="project-card-status">
                    <span className={`status-dot ${project.environments?.[0]?.status === 'live' ? '' : 'offline'}`} />
                    <span className="text-xs">
                      {project.environments?.[0]?.status === 'live' ? 'Live' : 'Draft'}
                    </span>
                  </div>
                </div>
                <div className="project-card-name">{project.name}</div>
                <div className="project-card-slug text-muted text-xs">{project.slug || 'draft'}</div>
                <div className="project-card-footer text-muted text-xs">
                  {formatDate(project.updatedAt || project.createdAt)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
