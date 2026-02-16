import { useState } from 'react';
import './AuthView.css';

interface AuthViewProps {
  onLogin: (email: string, password: string) => Promise<unknown>;
  onSignup: (email: string, password: string, name: string) => Promise<unknown>;
}

export default function AuthView({ onLogin, onSignup }: AuthViewProps) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'login') {
        await onLogin(email, password);
      } else {
        await onSignup(email, password, name);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-view">
      <div className="auth-card animate-fade-in">
        <div className="auth-logo">
          <iconify-icon icon="solar:layers-minimalistic-bold" width={28} style={{ color: 'var(--accent)' }} />
          <span>Brick Studio</span>
        </div>
        <p className="auth-subtitle">
          {mode === 'login' ? 'Sign in to your workspace' : 'Create your account'}
        </p>

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === 'signup' && (
            <div className="auth-field">
              <label>Name</label>
              <input
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />
            </div>
          )}
          <div className="auth-field">
            <label>Email</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus={mode === 'login'}
            />
          </div>
          <div className="auth-field">
            <label>Password</label>
            <input
              type="password"
              placeholder={mode === 'signup' ? 'At least 8 characters' : 'Your password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={mode === 'signup' ? 8 : undefined}
            />
          </div>

          {error && <div className="auth-error">{error}</div>}

          <button type="submit" className="primary auth-submit" disabled={loading}>
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="auth-switch">
          {mode === 'login' ? (
            <>
              Don't have an account?{' '}
              <button onClick={() => { setMode('signup'); setError(null); }}>Sign up</button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button onClick={() => { setMode('login'); setError(null); }}>Sign in</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
