import { useState, useEffect, useCallback } from 'react';
import { auth, setToken, clearToken, hasToken } from '../api/client';
import type { User } from '../api/types';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkAuth = useCallback(async () => {
    if (!hasToken()) {
      setLoading(false);
      return;
    }
    try {
      const res = await auth.me();
      setUser(res.user);
    } catch {
      clearToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (email: string, password: string) => {
    setError(null);
    try {
      const res = await auth.login(email, password);
      setToken(res.token);
      setUser(res.user);
      return res.user;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      setError(msg);
      throw err;
    }
  };

  const signup = async (email: string, password: string, name: string) => {
    setError(null);
    try {
      const res = await auth.signup(email, password, name);
      setToken(res.token);
      setUser(res.user);
      return res.user;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Signup failed';
      setError(msg);
      throw err;
    }
  };

  const logout = () => {
    clearToken();
    setUser(null);
  };

  return { user, loading, error, login, signup, logout, isAuthenticated: !!user };
}
