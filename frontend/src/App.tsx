import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import AuthView from './components/auth/AuthView';
import AppShell from './components/layout/AppShell';
import DashboardView from './components/dashboard/DashboardView';
import ProjectsView from './components/projects/ProjectsView';
import WorkspaceView from './components/workspace/WorkspaceView';
import SettingsView from './components/settings/SettingsView';

export default function App() {
  const { user, loading, login, signup, logout, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-secondary)',
        color: 'var(--text-secondary)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <iconify-icon icon="solar:layers-minimalistic-bold" width="32" style={{ color: 'var(--accent)', marginBottom: 12 }} />
          <div style={{ fontSize: 13 }}>Loading...</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthView onLogin={login} onSignup={signup} />;
  }

  return (
    <AppShell user={user!} onLogout={logout}>
      <Routes>
        <Route path="/" element={<DashboardView />} />
        <Route path="/projects" element={<ProjectsView />} />
        <Route path="/project/:projectId" element={<WorkspaceView />} />
        <Route path="/settings" element={<SettingsView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}

// Declare iconify-icon for TypeScript
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'iconify-icon': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          icon: string;
          width?: number | string;
          height?: number | string;
          inline?: boolean;
        },
        HTMLElement
      >;
    }
  }
}
