import { useState, useEffect, useCallback } from 'react';
import { projects } from '../api/client';
import type { Project } from '../api/types';

export function useProjects() {
  const [projectList, setProjectList] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const res = await projects.list();
      setProjectList(res.projects || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createProject = async (name: string, description?: string) => {
    const res = await projects.create({ name, description });
    await refresh();
    return res.project;
  };

  const deleteProject = async (id: string) => {
    await projects.delete(id);
    await refresh();
  };

  return { projects: projectList, loading, error, refresh, createProject, deleteProject };
}
