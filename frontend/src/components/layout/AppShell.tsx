import { type ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { User } from '../../api/types';
import './AppShell.css';

interface AppShellProps {
  children: ReactNode;
  user: User;
  onLogout: () => void;
}

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: 'solar:widget-5-linear', section: 'Workspace' },
  { path: '/projects', label: 'All Projects', icon: 'solar:folder-with-files-linear', section: 'Workspace' },
  { path: '/settings', label: 'Preferences', icon: 'solar:settings-linear', section: 'Settings' },
];

export default function AppShell({ children, user, onLogout }: AppShellProps) {
  const navigate = useNavigate();
  const location = useLocation();

  // Hide sidebar in workspace view
  const isWorkspace = location.pathname.startsWith('/project/');
  if (isWorkspace) {
    return <>{children}</>;
  }

  const sections = new Map<string, typeof NAV_ITEMS>();
  for (const item of NAV_ITEMS) {
    if (!sections.has(item.section)) sections.set(item.section, []);
    sections.get(item.section)!.push(item);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-header" onClick={() => navigate('/')}>
          <div className="sidebar-logo-icon">
            <iconify-icon icon="solar:layers-minimalistic-bold" width={14} />
          </div>
          <span className="sidebar-logo">Brick Studio</span>
        </div>

        <nav className="sidebar-nav">
          {Array.from(sections.entries()).map(([section, items]) => (
            <div key={section}>
              <div className="nav-section-title">{section}</div>
              {items.map((item) => (
                <div
                  key={item.path}
                  className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
                  onClick={() => navigate(item.path)}
                >
                  <iconify-icon icon={item.icon} width={16} />
                  {item.label}
                </div>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-user-avatar">
              {user.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{user.name}</div>
              <div className="sidebar-user-plan">Pro Plan</div>
            </div>
            <button className="sidebar-logout" onClick={onLogout} title="Log out">
              <iconify-icon icon="solar:logout-linear" width={16} />
            </button>
          </div>
        </div>
      </aside>

      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
