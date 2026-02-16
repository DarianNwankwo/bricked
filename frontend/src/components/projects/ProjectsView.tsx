import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjects } from '../../hooks/useProjects';
import './ProjectsView.css';

export default function ProjectsView() {
  const navigate = useNavigate();
  const { projects, loading, createProject, deleteProject } = useProjects();
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.slug || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleNewProject = async () => {
    setCreating(true);
    try {
      const project = await createProject('Untitled Project');
      navigate(`/project/${project.id}`);
    } catch (err) {
      console.error('Failed to create project:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this project? This cannot be undone.')) return;
    await deleteProject(id);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (loading) {
    return <div className="projects-loading animate-pulse">Loading projects...</div>;
  }

  return (
    <div className="projects-view animate-fade-in">
      <header className="projects-header">
        <h1>Projects</h1>
        <div className="projects-header-actions">
          <div className="search-wrapper">
            <iconify-icon icon="solar:magnifer-linear" width={14} />
            <input
              placeholder="Search projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button className="primary" onClick={handleNewProject} disabled={creating}>
            <iconify-icon icon="solar:add-circle-linear" width={16} />
            New Project
          </button>
        </div>
      </header>

      {filtered.length === 0 ? (
        <div className="projects-empty">
          <iconify-icon icon="solar:folder-open-linear" width={48} style={{ color: 'var(--text-muted)' }} />
          <h3>{search ? 'No matching projects' : 'No projects yet'}</h3>
          <p className="text-muted">{search ? 'Try a different search term' : 'Create your first architecture project'}</p>
        </div>
      ) : (
        <table className="projects-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Last Edited</th>
              <th style={{ width: 60 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((project) => (
              <tr key={project.id} onClick={() => navigate(`/project/${project.id}`)}>
                <td>
                  <div className="project-name-cell">
                    <div className="project-icon">
                      <iconify-icon icon="solar:cloud-linear" width={16} />
                    </div>
                    <div>
                      <div className="project-name-text">{project.name}</div>
                      <div className="text-muted text-xs">{project.slug || 'draft'}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="project-status-cell">
                    <span className={`status-dot ${project.environments?.[0]?.status === 'live' ? '' : 'offline'}`} />
                    {project.environments?.[0]?.status === 'live' ? 'Live' : project.environments?.[0]?.status || 'Draft'}
                  </div>
                </td>
                <td className="text-muted">{formatDate(project.updatedAt || project.createdAt)}</td>
                <td>
                  <button className="danger" onClick={(e) => handleDelete(project.id, e)} title="Delete">
                    <iconify-icon icon="solar:trash-bin-minimalistic-linear" width={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
