import { useState, useEffect } from 'react';
import { studio } from '../../api/client';
import './SettingsView.css';

export default function SettingsView() {
  const [model, setModel] = useState('');
  const [provider, setProvider] = useState('');
  const [models, setModels] = useState<Array<{ id: string; name: string; provider: string }>>([]);
  const [projectCount, setProjectCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [configRes, settingsRes] = await Promise.all([
          studio.getConfig(),
          studio.getSettings(),
        ]);
        setModel(configRes.model);
        setProvider(configRes.provider);
        setModels(configRes.models || []);
        setProjectCount(settingsRes.projectCount || 0);
      } catch (err) {
        console.error('Failed to load settings:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleModelChange = async (newModel: string) => {
    try {
      await studio.setModel(newModel);
      setModel(newModel);
    } catch (err) {
      console.error('Failed to change model:', err);
    }
  };

  const handleThemeChange = (theme: string) => {
    localStorage.setItem('brick-theme', theme);
    document.documentElement.className = theme;
  };

  // Group models by provider
  const modelsByProvider = new Map<string, typeof models>();
  for (const m of models) {
    if (!modelsByProvider.has(m.provider)) modelsByProvider.set(m.provider, []);
    modelsByProvider.get(m.provider)!.push(m);
  }

  if (loading) {
    return <div className="settings-loading animate-pulse">Loading settings...</div>;
  }

  return (
    <div className="settings-view animate-fade-in">
      <header className="settings-header">
        <h1>Preferences</h1>
      </header>

      <div className="settings-content">
        {/* Appearance */}
        <section className="settings-section">
          <h2>Appearance</h2>
          <p className="text-muted text-sm">Customize the look and feel of Brick Studio</p>
          <div className="settings-row">
            <span className="settings-label">Theme</span>
            <select
              value={localStorage.getItem('brick-theme') || 'dark'}
              onChange={(e) => handleThemeChange(e.target.value)}
              className="settings-select"
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="auto">Auto (System)</option>
            </select>
          </div>
        </section>

        {/* AI Model */}
        <section className="settings-section">
          <h2>AI Model</h2>
          <p className="text-muted text-sm">Configure the language model used for architecture generation</p>
          <div className="settings-row">
            <span className="settings-label">Model</span>
            <select
              value={model}
              onChange={(e) => handleModelChange(e.target.value)}
              className="settings-select"
            >
              {Array.from(modelsByProvider.entries()).map(([prov, list]) => (
                <optgroup key={prov} label={prov}>
                  {list.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div className="settings-row">
            <span className="settings-label">Provider</span>
            <span className="settings-value">{provider || 'Not configured'}</span>
          </div>
        </section>

        {/* GitHub */}
        <section className="settings-section">
          <h2>GitHub</h2>
          <p className="text-muted text-sm">Connect your GitHub account to push generated code</p>
          <div className="settings-row">
            <span className="settings-label">Status</span>
            <span className="settings-value">Not connected</span>
          </div>
          <button
            className="primary"
            style={{ marginTop: 8 }}
            onClick={() => window.open('/api/github/auth', '_blank', 'width=600,height=700')}
          >
            <iconify-icon icon="solar:link-linear" width={14} />
            Connect GitHub
          </button>
        </section>

        {/* Workspace */}
        <section className="settings-section">
          <h2>Workspace</h2>
          <p className="text-muted text-sm">Manage your projects and workspace settings</p>
          <div className="settings-row">
            <span className="settings-label">Total Projects</span>
            <span className="settings-value">{projectCount} project{projectCount !== 1 ? 's' : ''}</span>
          </div>
        </section>

        {/* About */}
        <section className="settings-section">
          <h2>About</h2>
          <p className="text-muted text-sm">Brick Studio - Visual Cloud Architect</p>
          <div className="settings-row">
            <span className="settings-label">Version</span>
            <span className="settings-value mono">0.2.0</span>
          </div>
        </section>
      </div>
    </div>
  );
}
