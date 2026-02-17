// API client with auth token management

const TOKEN_KEY = 'brick-auth-token';
const SESSION_PROJECT_KEY = 'brick-session-project-id';

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function getProjectId(): string | null {
  return localStorage.getItem(SESSION_PROJECT_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function hasToken(): boolean {
  return !!getToken();
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const projectId = getProjectId();
  if (projectId) {
    headers['X-Project-Id'] = projectId;
  }

  const res = await fetch(path, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }

  return res.json();
}

// Auth
export const auth = {
  signup: (email: string, password: string, name: string) =>
    request<{ user: { id: string; email: string; name: string }; token: string }>(
      '/api/auth/signup',
      { method: 'POST', body: JSON.stringify({ email, password, name }) }
    ),
  login: (email: string, password: string) =>
    request<{ user: { id: string; email: string; name: string }; token: string }>(
      '/api/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }) }
    ),
  me: () =>
    request<{ user: { id: string; email: string; name: string } }>('/api/auth/me'),
};

// Projects
export const projects = {
  list: () =>
    request<{ projects: import('./types').Project[] }>('/api/projects'),
  get: (id: string) =>
    request<{ project: import('./types').Project }>(`/api/projects/${id}`),
  create: (data: { name: string; description?: string }) =>
    request<{ project: import('./types').Project }>(
      '/api/projects',
      { method: 'POST', body: JSON.stringify(data) }
    ),
  update: (id: string, data: Partial<import('./types').Project>) =>
    request<{ project: import('./types').Project }>(
      `/api/projects/${id}`,
      { method: 'PATCH', body: JSON.stringify(data) }
    ),
  delete: (id: string) =>
    request<{ success: boolean }>(`/api/projects/${id}`, { method: 'DELETE' }),
};

// Session/Studio (in-memory state on server)
export const studio = {
  // Chat / Generate
  generateStream: (message: string, reset?: boolean): EventSource | null => {
    // We use fetch with SSE manually since we need POST
    return null; // Implemented via streamGenerate below
  },
  build: (componentSpecs?: Record<string, import('./types').ComponentSpec>) =>
    request<{
      yaml: string;
      validation: { valid: boolean; errors?: string[] };
      cost: import('./types').CostEstimate;
      ir: unknown;
      bac: import('./types').BrickAppContract;
    }>('/api/build', { method: 'POST', body: JSON.stringify({ componentSpecs }) }),

  // BAC
  getBac: () =>
    request<{ bac: import('./types').BrickAppContract | null; validation: { valid: boolean; errors?: string[] } }>('/api/bac'),
  putBac: (bac: import('./types').BrickAppContract) =>
    request<{
      bac: import('./types').BrickAppContract;
      validation: { valid: boolean; errors?: string[] };
      completeness: unknown;
      architecture: import('./types').ManualArchitecture;
    }>('/api/bac', { method: 'PUT', body: JSON.stringify({ bac }) }),
  patchBac: (patches: import('./types').BACPatch[]) =>
    request<{
      bac: import('./types').BrickAppContract;
      validation: { valid: boolean; errors?: string[] };
      completeness: unknown;
      architecture: import('./types').ManualArchitecture;
    }>('/api/bac', { method: 'PATCH', body: JSON.stringify({ patches }) }),
  bacFromIntent: (intent: string) =>
    request<{
      bac: import('./types').BrickAppContract;
      validation: { valid: boolean; errors?: string[] };
      completeness: unknown;
      architecture: import('./types').ManualArchitecture;
    }>('/api/bac/from-intent', { method: 'POST', body: JSON.stringify({ intent }) }),

  // Architecture
  getTemplates: () =>
    request<{ templates: Array<{ id: string; name: string; description: string; icon: string; componentCount?: number }> }>('/api/templates'),
  getArchitecture: () =>
    request<{ architecture: import('./types').ManualArchitecture | null }>('/api/architecture'),
  setArchitecture: (architecture: import('./types').ManualArchitecture) =>
    request<{ architecture: import('./types').ManualArchitecture; bac: import('./types').BrickAppContract }>('/api/architecture', { method: 'POST', body: JSON.stringify({ architecture }) }),
  addComponent: (component: Partial<import('./types').ArchComponent>) =>
    request<{ architecture: import('./types').ManualArchitecture; bac: import('./types').BrickAppContract }>(
      '/api/component',
      { method: 'POST', body: JSON.stringify(component) }
    ),
  updateComponent: (id: string, updates: Partial<import('./types').ArchComponent>) =>
    request<{ architecture: import('./types').ManualArchitecture }>(
      '/api/component',
      { method: 'PUT', body: JSON.stringify({ id, ...updates }) }
    ),
  deleteComponent: (id: string) =>
    request<{ architecture: import('./types').ManualArchitecture; bac: import('./types').BrickAppContract }>(
      `/api/component?id=${id}`,
      { method: 'DELETE' }
    ),
  addConnection: (from: string, to: string, label?: string) =>
    request<{ architecture: import('./types').ManualArchitecture; bac: import('./types').BrickAppContract }>(
      '/api/connection',
      { method: 'POST', body: JSON.stringify({ from, to, label }) }
    ),
  updateConnection: (from: string, to: string, label?: string, contract?: string) =>
    request<{ architecture: import('./types').ManualArchitecture; bac: import('./types').BrickAppContract }>(
      '/api/connection',
      { method: 'PUT', body: JSON.stringify({ from, to, label, contract: contract !== undefined ? { notes: contract } : undefined }) }
    ),
  deleteConnection: (from: string, to: string) =>
    request<{ architecture: import('./types').ManualArchitecture; bac: import('./types').BrickAppContract }>(
      `/api/connection?from=${from}&to=${to}`,
      { method: 'DELETE' }
    ),

  renameArchitecture: (name: string) =>
    request<{ success: boolean; bac: import('./types').BrickAppContract }>(
      '/api/architecture/name',
      { method: 'PUT', body: JSON.stringify({ name }) }
    ),
  getTemplate: (id: string) =>
    request<{
      id: string;
      name: string;
      description: string;
      components: Array<{ id: string; name: string; type: string; techOptions: string[]; defaultTech: string }>;
      connections: Array<{ from: string; to: string; label?: string }>;
    }>(`/api/templates/${id}`),
  loadTemplate: (templateId: string) =>
    request<{ architecture: import('./types').ManualArchitecture; bac: import('./types').BrickAppContract }>(
      '/api/template',
      { method: 'POST', body: JSON.stringify({ templateId }) }
    ),
  getBacCompleteness: () =>
    request<import('./types').BACCompleteness>('/api/bac/completeness'),

  // Component Specs
  getComponentSpecs: () =>
    request<{ componentSpecs: Record<string, import('./types').ComponentSpec>; bac: import('./types').BrickAppContract }>(
      '/api/component-specs'
    ),
  setComponentSpecs: (componentSpecs: Record<string, import('./types').ComponentSpec>) =>
    request<{ success: boolean; bac: import('./types').BrickAppContract }>(
      '/api/component-specs',
      { method: 'PUT', body: JSON.stringify({ componentSpecs }) }
    ),

  // Files
  getFiles: () =>
    request<{ files: Array<{ path: string; componentId?: string; isManuallyEdited?: boolean }> }>('/api/files'),
  getFile: (path: string) =>
    request<import('./types').ProjectFile>(`/api/file?path=${encodeURIComponent(path)}`),
  updateFile: (path: string, content: string) =>
    request<{ success: boolean }>('/api/file', { method: 'PUT', body: JSON.stringify({ path, content }) }),

  // Config
  getConfig: () =>
    request<{ model: string; provider: string; models: import('./types').LLMModel[] }>('/api/config'),
  setModel: (model: string) =>
    request<{ success: boolean; model: string }>('/api/model', { method: 'POST', body: JSON.stringify({ model }) }),
  getSettings: () =>
    request<{ model: string; provider: string; projectCount: number }>('/api/settings'),
  reset: (projectId?: string) =>
    request<{ success: boolean }>('/api/reset', { method: 'POST', body: projectId ? JSON.stringify({ projectId }) : undefined }),

  // Docs
  getDocs: () =>
    request<{ documentation: string }>('/api/docs'),
  generateDocs: () =>
    request<{ documentation: string }>('/api/docs/generate', { method: 'POST' }),
  updateDocs: (documentation: string) =>
    request<{ success: boolean }>('/api/docs', { method: 'PUT', body: JSON.stringify({ documentation }) }),

  // Info
  getInfo: () =>
    request<{
      platform: string;
      version: string;
      features: Record<string, boolean | string>;
    }>('/api/info'),
};

// Features (project-scoped)
export const features = {
  list: (projectId: string) =>
    request<{ features: import('./types').Feature[] }>(`/api/projects/${projectId}/features`),
  create: (projectId: string, data: { title: string; description: string }) =>
    request<{ feature: import('./types').Feature }>(
      `/api/projects/${projectId}/features`,
      { method: 'POST', body: JSON.stringify(data) }
    ),
  update: (projectId: string, featureId: string, data: Partial<import('./types').Feature>) =>
    request<{ feature: import('./types').Feature }>(
      `/api/projects/${projectId}/features/${featureId}`,
      { method: 'PATCH', body: JSON.stringify(data) }
    ),
  delete: (projectId: string, featureId: string) =>
    request<{ success: boolean }>(
      `/api/projects/${projectId}/features/${featureId}`,
      { method: 'DELETE' }
    ),
};

// Messages (project-scoped chat history)
export const messages = {
  list: (projectId: string, limit?: number) =>
    request<{ messages: import('./types').ChatMessage[] }>(
      `/api/projects/${projectId}/messages${limit ? `?limit=${limit}` : ''}`
    ),
  create: (projectId: string, data: { role: string; content: string; contextMode?: string; metadata?: Record<string, unknown> }) =>
    request<{ message: import('./types').ChatMessage }>(
      `/api/projects/${projectId}/messages`,
      { method: 'POST', body: JSON.stringify(data) }
    ),
  clear: (projectId: string) =>
    request<{ success: boolean }>(
      `/api/projects/${projectId}/messages`,
      { method: 'DELETE' }
    ),
};

// Preview
export const preview = {
  start: (projectId: string) =>
    request<import('./types').PreviewStatus>(`/api/preview/${projectId}/start`, { method: 'POST' }),
  stop: (projectId: string) =>
    request<{ status: string }>(`/api/preview/${projectId}/stop`, { method: 'POST' }),
  status: (projectId: string) =>
    request<import('./types').PreviewStatus>(`/api/preview/${projectId}/status`),
  rebuild: (projectId: string) =>
    request<import('./types').PreviewStatus>(`/api/preview/${projectId}/rebuild`, { method: 'POST' }),
};

// Deployments
export const deployments = {
  deploy: (projectId: string, environment: string) =>
    request<{ deployment: import('./types').DeploymentInfo; message: string }>(
      `/api/deployments/${projectId}/${environment}`,
      { method: 'POST' }
    ),
  status: (deploymentId: string) =>
    request<{ deployment: import('./types').DeploymentInfo }>(`/api/deployments/${deploymentId}`),
  stop: (projectId: string, environment: string) =>
    request<{ success: boolean }>(`/api/deployments/${projectId}/${environment}`, { method: 'DELETE' }),
  history: (projectId: string, environment: string) =>
    request<{ deployments: import('./types').DeploymentInfo[] }>(`/api/deployments/${projectId}/${environment}/history`),
};

// SSE streaming helpers
export async function streamGenerate(
  message: string,
  onChunk: (chunk: string) => void,
  onDone: (data: {
    diagram?: string;
    explanation?: string;
    cost?: import('./types').CostEstimate;
    ir?: unknown;
    bac?: import('./types').BrickAppContract;
  }) => void,
  onError: (error: string) => void,
  reset?: boolean
): Promise<AbortController> {
  const controller = new AbortController();
  const token = getToken();

  try {
    const streamProjectId = getProjectId();
    const res = await fetch('/api/generate-stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(streamProjectId ? { 'X-Project-Id': streamProjectId } : {}),
      },
      body: JSON.stringify({ message, reset }),
      signal: controller.signal,
    });

    const reader = res.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    const processStream = async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.error) {
              onError(data.error);
            } else if (data.done) {
              onDone(data);
            } else if (data.chunk) {
              onChunk(data.chunk);
            }
          } catch {
            // ignore parse errors
          }
        }
      }
    };

    processStream().catch((err) => {
      if (err.name !== 'AbortError') onError(err.message);
    });
  } catch (err) {
    if ((err as Error).name !== 'AbortError') {
      onError((err as Error).message);
    }
  }

  return controller;
}

export async function streamCodegen(
  componentSpecs: Record<string, import('./types').ComponentSpec>,
  onEvent: (event: {
    status: string;
    file?: string;
    content?: string;
    progress?: number;
    total?: number;
    error?: string;
    fileCount?: number;
    strategy?: string;
    files?: string[];
    generateCount?: number;
    componentId?: string;
  }) => void,
  strategy: 'targeted_edit' | 'full_regeneration' = 'targeted_edit'
): Promise<AbortController> {
  const controller = new AbortController();
  const token = getToken();

  try {
    const codegenProjectId = getProjectId();
    const res = await fetch('/api/generate-code', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(codegenProjectId ? { 'X-Project-Id': codegenProjectId } : {}),
      },
      body: JSON.stringify({ componentSpecs, strategy }),
      signal: controller.signal,
    });

    const reader = res.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    const processStream = async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            onEvent(data);
          } catch {
            // ignore
          }
        }
      }
    };

    processStream().catch((err) => {
      if (err.name !== 'AbortError') {
        onEvent({ status: 'error', error: err.message });
      }
    });
  } catch (err) {
    if ((err as Error).name !== 'AbortError') {
      onEvent({ status: 'error', error: (err as Error).message });
    }
  }

  return controller;
}
