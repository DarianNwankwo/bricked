import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { studio, projects, streamGenerate, streamCodegen, preview } from '../../api/client';
import type {
  ManualArchitecture,
  BrickAppContract,
  ComponentSpec,
  ProjectFile,
  ChatMessage,
  CostEstimate,
  Feature,
  FeatureStatus,
  PreviewStatus,
  BACCompleteness,
} from '../../api/types';

interface TemplateSummary {
  id: string;
  name: string;
  description: string;
  icon: string;
  componentCount?: number;
}
import FeatureBoard from './FeatureBoard';
import ArchitectureCanvas from './ArchitectureCanvas';
import ComponentDetailPanel from './ComponentDetailPanel';
import CodeEditor from './CodeEditor';
import ChatPanel from './ChatPanel';
import PreviewPanel from './PreviewPanel';
import './WorkspaceView.css';

type CanvasMode = 'architecture' | 'code' | 'preview' | 'docs';

export default function WorkspaceView() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  // Core state
  const [architecture, setArchitecture] = useState<ManualArchitecture | null>(null);
  const [bac, setBac] = useState<BrickAppContract | null>(null);
  const [componentSpecs, setComponentSpecs] = useState<Record<string, ComponentSpec>>({});
  const [files, setFiles] = useState<Map<string, ProjectFile>>(new Map());
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [diagram, setDiagram] = useState<string | null>(null);
  const [cost, setCost] = useState<CostEstimate | null>(null);
  const [projectName, setProjectName] = useState('Untitled Project');

  // UI state
  const [canvasMode, setCanvasMode] = useState<CanvasMode>('architecture');
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [completeness, setCompleteness] = useState<BACCompleteness | null>(null);
  const [edgeType, setEdgeType] = useState<'default' | 'straight' | 'step'>('default');
  const [isEditingName, setIsEditingName] = useState(false);
  const [editingName, setEditingName] = useState('');

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState('');

  // Code gen state
  const [isGenerating, setIsGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState<{ file: string; progress: number; total: number } | null>(null);

  // Features (Kanban)
  const [features, setFeatures] = useState<Feature[]>([]);

  // Templates
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);

  // Preview state
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>({ status: 'not_started' });

  // Models
  const [models, setModels] = useState<Array<{ id: string; name: string; provider: string }>>([]);
  const [selectedModel, setSelectedModel] = useState('');

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        // Track which project the session belongs to.
        // If the project changed, reset the session to avoid stale state.
        const SESSION_PROJECT_KEY = 'brick-session-project-id';
        const lastSessionProject = localStorage.getItem(SESSION_PROJECT_KEY);
        if (projectId && projectId !== lastSessionProject) {
          await studio.reset();
          localStorage.setItem(SESSION_PROJECT_KEY, projectId);
        }

        // Load project name from database if available
        if (projectId) {
          try {
            const projRes = await projects.get(projectId);
            if (projRes.project?.name) setProjectName(projRes.project.name);
          } catch {
            // Project may not exist in DB yet
          }
        }

        const [archRes, configRes, templateRes] = await Promise.all([
          studio.getArchitecture(),
          studio.getConfig(),
          studio.getTemplates(),
        ]);

        if (archRes.architecture) {
          setArchitecture(archRes.architecture);
          if (archRes.architecture.name) setProjectName(archRes.architecture.name);
        } else {
          setShowTemplates(true);
        }

        setModels(configRes.models || []);
        setSelectedModel(configRes.model);
        setTemplates(templateRes.templates || []);

        // Load BAC
        const bacRes = await studio.getBac();
        if (bacRes.bac) setBac(bacRes.bac);

        // Load files
        const filesRes = await studio.getFiles();
        if (filesRes.files && filesRes.files.length > 0) {
          const fileMap = new Map<string, ProjectFile>();
          for (const f of filesRes.files) {
            fileMap.set(f.path, { path: f.path, content: '', componentId: f.componentId });
          }
          setFiles(fileMap);
        }

        // Load component specs
        const specsRes = await studio.getComponentSpecs();
        setComponentSpecs(specsRes.componentSpecs || {});

      } catch (err) {
        console.error('Failed to load workspace data:', err);
      }
    };

    loadData();
  }, [projectId]);

  // Send chat message
  const sendMessage = useCallback(async (content: string) => {
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    setIsStreaming(true);
    setStreamContent('');

    let fullContent = '';

    await streamGenerate(
      content,
      (chunk) => {
        fullContent += chunk;
        setStreamContent(fullContent);
      },
      (data) => {
        const assistantMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: fullContent,
          timestamp: new Date().toISOString(),
          diagram: data.diagram,
          cost: data.cost as CostEstimate,
        };
        setMessages(prev => [...prev, assistantMsg]);
        setStreamContent('');
        setIsStreaming(false);

        if (data.diagram) setDiagram(data.diagram);
        if (data.cost) setCost(data.cost as CostEstimate);
        if (data.bac) setBac(data.bac as BrickAppContract);

        // Refresh architecture after diagram update
        studio.getArchitecture().then(res => {
          if (res.architecture) setArchitecture(res.architecture);
        });
      },
      (error) => {
        const errMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'system',
          content: `Error: ${error}`,
          timestamp: new Date().toISOString(),
        };
        setMessages(prev => [...prev, errMsg]);
        setIsStreaming(false);
        setStreamContent('');
      }
    );
  }, []);

  // Generate code
  const generateCode = useCallback(async () => {
    setIsGenerating(true);
    setGenProgress(null);
    setCanvasMode('code');

    await streamCodegen(
      componentSpecs,
      (event) => {
        if (event.status === 'generating') {
          setGenProgress({
            file: event.file || '',
            progress: event.progress || 0,
            total: event.total || 0,
          });
        } else if (event.status === 'file_complete' && event.file && event.content) {
          setFiles(prev => {
            const next = new Map(prev);
            next.set(event.file!, {
              path: event.file!,
              content: event.content!,
              componentId: event.componentId,
            });
            return next;
          });
          if (!selectedFile) setSelectedFile(event.file!);
        } else if (event.status === 'complete') {
          setIsGenerating(false);
          setGenProgress(null);
        } else if (event.error) {
          setIsGenerating(false);
          setGenProgress(null);
        }
      }
    );
  }, [componentSpecs, selectedFile]);

  // Template selection
  const selectTemplate = useCallback(async (templateId: string) => {
    try {
      const res = await studio.loadTemplate(templateId);
      setArchitecture(res.architecture);
      if (res.bac) setBac(res.bac);
      setShowTemplates(false);
    } catch (err) {
      console.error('Failed to apply template:', err);
    }
  }, []);

  // Architecture CRUD
  const handleAddComponent = useCallback(async (component: { name: string; type: string; x: number; y: number }) => {
    try {
      const res = await studio.addComponent(component as Partial<import('../../api/types').ArchComponent>);
      setArchitecture(res.architecture);
      if (res.bac) setBac(res.bac);
    } catch (err) {
      console.error('Failed to add component:', err);
    }
  }, []);

  const handleUpdateComponent = useCallback(async (id: string, updates: { x?: number; y?: number; name?: string }) => {
    try {
      const res = await studio.updateComponent(id, updates);
      setArchitecture(res.architecture);
    } catch (err) {
      console.error('Failed to update component:', err);
    }
  }, []);

  const handleDeleteComponent = useCallback(async (id: string) => {
    try {
      const res = await studio.deleteComponent(id);
      setArchitecture(res.architecture);
      if (res.bac) setBac(res.bac);
    } catch (err) {
      console.error('Failed to delete component:', err);
    }
  }, []);

  const handleAddConnection = useCallback(async (from: string, to: string) => {
    try {
      const res = await studio.addConnection(from, to);
      setArchitecture(res.architecture);
      if (res.bac) setBac(res.bac);
    } catch (err) {
      console.error('Failed to add connection:', err);
    }
  }, []);

  const handleUpdateConnection = useCallback(async (from: string, to: string, label?: string, contract?: string) => {
    try {
      const res = await studio.updateConnection(from, to, label, contract);
      setArchitecture(res.architecture);
      if (res.bac) setBac(res.bac);
    } catch (err) {
      console.error('Failed to update connection:', err);
    }
  }, []);

  const handleDeleteConnection = useCallback(async (from: string, to: string) => {
    try {
      const res = await studio.deleteConnection(from, to);
      setArchitecture(res.architecture);
      if (res.bac) setBac(res.bac);
      setSelectedComponentId(null);
    } catch (err) {
      console.error('Failed to delete connection:', err);
    }
  }, []);

  const handleUpdateSpec = useCallback(async (componentId: string, spec: ComponentSpec) => {
    const updated = { ...componentSpecs, [componentId]: spec };
    setComponentSpecs(updated);
    try {
      const res = await studio.setComponentSpecs(updated);
      if (res.bac) setBac(res.bac);
    } catch (err) {
      console.error('Failed to update spec:', err);
    }
  }, [componentSpecs]);

  const handleRenameArchitecture = useCallback(async (name: string) => {
    setProjectName(name);
    try {
      const res = await studio.renameArchitecture(name);
      if (res.bac) setBac(res.bac);
      // Also update the database project name so dashboard shows it correctly
      if (projectId) {
        projects.update(projectId, { name }).catch(console.error);
      }
    } catch (err) {
      console.error('Failed to rename architecture:', err);
    }
  }, [projectId]);

  const handleNodeSelect = useCallback((id: string | null) => {
    setSelectedComponentId(id);
  }, []);

  // Fetch completeness whenever architecture or specs change
  useEffect(() => {
    if (!architecture) return;
    studio.getBacCompleteness()
      .then(res => setCompleteness(res))
      .catch(() => setCompleteness(null));
  }, [architecture, componentSpecs]);

  // Feature management (Kanban)
  const handleFeatureMove = useCallback((featureId: string, newStatus: FeatureStatus) => {
    setFeatures(prev =>
      prev.map(f => f.id === featureId ? { ...f, status: newStatus, updatedAt: new Date().toISOString() } : f)
    );
    // If moving to in_progress, could trigger agent work
    if (newStatus === 'in_progress') {
      const feature = features.find(f => f.id === featureId);
      if (feature) {
        setFeatures(prev =>
          prev.map(f => f.id === featureId ? { ...f, agentStatus: 'planning' } : f)
        );
      }
    }
  }, [features]);

  const handleAddFeature = useCallback((title: string, description: string) => {
    const newFeature: Feature = {
      id: crypto.randomUUID(),
      title,
      description,
      status: 'backlog',
      projectId: projectId || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setFeatures(prev => [...prev, newFeature]);
  }, [projectId]);

  // Preview management
  const startPreview = useCallback(async () => {
    if (!projectId) return;
    try {
      setPreviewStatus({ status: 'starting' });
      const res = await preview.start(projectId);
      setPreviewStatus(res);
      setCanvasMode('preview');
    } catch (err) {
      setPreviewStatus({ status: 'error', error: err instanceof Error ? err.message : 'Failed to start preview' });
    }
  }, [projectId]);

  const stopPreview = useCallback(async () => {
    if (!projectId) return;
    try {
      await preview.stop(projectId);
      setPreviewStatus({ status: 'not_started' });
    } catch (err) {
      console.error('Failed to stop preview:', err);
    }
  }, [projectId]);

  // Template gallery
  if (showTemplates && !architecture) {
    return (
      <div className="workspace-templates animate-fade-in">
        <header className="workspace-header">
          <div className="workspace-header-left">
            <button onClick={() => navigate('/')} title="Back to dashboard">
              <iconify-icon icon="solar:arrow-left-linear" width={16} />
            </button>
            <div className="workspace-logo">
              <iconify-icon icon="solar:layers-minimalistic-bold" width={16} style={{ color: 'var(--accent)' }} />
              <span>Brick Studio</span>
            </div>
          </div>
        </header>
        <div className="template-gallery">
          <h2>Choose a starting template</h2>
          <p className="text-muted">Select an architecture pattern or start from scratch</p>
          <div className="template-grid">
            <div className="template-card" onClick={() => setShowTemplates(false)}>
              <div className="template-icon">
                <iconify-icon icon="solar:pen-new-square-linear" width={24} />
              </div>
              <div className="template-name">Blank Canvas</div>
              <div className="template-desc text-muted text-sm">Start from scratch with an empty architecture</div>
            </div>
            {templates.map((t) => (
              <div key={t.id} className="template-card" onClick={() => selectTemplate(t.id)}>
                <div className="template-icon">
                  <iconify-icon icon="solar:layers-minimalistic-linear" width={24} />
                </div>
                <div className="template-name">{t.name}</div>
                <div className="template-desc text-muted text-sm">{t.description}</div>
                {t.componentCount != null && (
                  <div className="template-components text-xs text-muted">
                    {t.componentCount} components
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="workspace animate-fade-in">
      {/* Header */}
      <header className="workspace-header">
        <div className="workspace-header-left">
          <button onClick={() => navigate('/')} title="Back to dashboard">
            <iconify-icon icon="solar:arrow-left-linear" width={16} />
          </button>
          <div className="workspace-logo">
            <iconify-icon icon="solar:layers-minimalistic-bold" width={16} style={{ color: 'var(--accent)' }} />
            {isEditingName ? (
              <input
                className="workspace-name-input"
                value={editingName}
                onChange={e => setEditingName(e.target.value)}
                onBlur={() => {
                  setIsEditingName(false);
                  if (editingName.trim() && editingName.trim() !== projectName) {
                    handleRenameArchitecture(editingName.trim());
                  }
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  if (e.key === 'Escape') setIsEditingName(false);
                }}
                autoFocus
              />
            ) : (
              <span
                className="workspace-name-editable"
                onClick={() => { setEditingName(projectName); setIsEditingName(true); }}
                title="Click to rename"
              >
                {projectName}
              </span>
            )}
          </div>
        </div>

        <div className="workspace-tabs">
          <button
            className={`tab ${canvasMode === 'architecture' ? 'active' : ''}`}
            onClick={() => setCanvasMode('architecture')}
          >
            <iconify-icon icon="solar:graph-new-linear" width={14} />
            Architecture
          </button>
          <button
            className={`tab ${canvasMode === 'code' ? 'active' : ''}`}
            onClick={() => setCanvasMode('code')}
          >
            <iconify-icon icon="solar:code-linear" width={14} />
            Code
          </button>
          <button
            className={`tab ${canvasMode === 'preview' ? 'active' : ''}`}
            onClick={() => setCanvasMode('preview')}
          >
            <iconify-icon icon="solar:monitor-smartphone-linear" width={14} />
            Preview
          </button>
          <button
            className={`tab ${canvasMode === 'docs' ? 'active' : ''}`}
            onClick={() => setCanvasMode('docs')}
          >
            <iconify-icon icon="solar:document-text-linear" width={14} />
            Docs
          </button>
        </div>

        <div className="workspace-header-right">
          {architecture && (
            <>
              <button onClick={generateCode} disabled={isGenerating} className="primary">
                <iconify-icon icon={isGenerating ? 'solar:refresh-linear' : 'solar:code-linear'} width={14} />
                {isGenerating ? 'Generating...' : 'Generate Code'}
              </button>
              <button onClick={startPreview} disabled={previewStatus.status === 'starting'}>
                <iconify-icon icon="solar:play-linear" width={14} />
                Demo
              </button>
            </>
          )}
          {cost && (
            <div className="workspace-cost text-sm">
              ~${((cost.monthly || 0) / 100).toFixed(0)}/mo
            </div>
          )}
        </div>
      </header>

      {/* Main workspace */}
      <div className="workspace-body">
        {/* Left panel — Feature Board */}
        {leftPanelOpen && (
          <aside className="workspace-left">
            <div className="panel-header">
              <span>Features</span>
              <button onClick={() => setLeftPanelOpen(false)} title="Collapse">
                <iconify-icon icon="solar:sidebar-minimalistic-linear" width={14} />
              </button>
            </div>
            <FeatureBoard
              features={features}
              onMove={handleFeatureMove}
              onAdd={handleAddFeature}
            />
          </aside>
        )}

        {!leftPanelOpen && (
          <button className="panel-toggle left" onClick={() => setLeftPanelOpen(true)}>
            <iconify-icon icon="solar:sidebar-minimalistic-linear" width={14} />
          </button>
        )}

        {/* Center canvas + detail panel */}
        <div className="workspace-center">
          {canvasMode === 'architecture' && (
            <div className="architecture-layout">
              <ArchitectureCanvas
                architecture={architecture}
                bac={bac}
                componentSpecs={componentSpecs}
                completeness={completeness}
                edgeType={edgeType}
                onAddComponent={handleAddComponent}
                onUpdateComponent={handleUpdateComponent}
                onDeleteComponent={handleDeleteComponent}
                onAddConnection={handleAddConnection}
                onUpdateConnection={handleUpdateConnection}
                onDeleteConnection={handleDeleteConnection}
                onNodeSelect={handleNodeSelect}
                onEdgeTypeChange={setEdgeType}
              />
              {selectedComponentId && architecture && (() => {
                const comp = architecture.components.find(c => c.id === selectedComponentId);
                if (!comp) return null;
                return (
                  <ComponentDetailPanel
                    component={comp}
                    spec={componentSpecs[selectedComponentId] || {}}
                    connections={architecture.connections}
                    allComponents={architecture.components}
                    completeness={completeness}
                    onUpdateSpec={handleUpdateSpec}
                    onUpdateComponent={handleUpdateComponent}
                    onUpdateConnection={handleUpdateConnection}
                    onDeleteConnection={handleDeleteConnection}
                    onDeleteComponent={(id) => {
                      handleDeleteComponent(id);
                      setSelectedComponentId(null);
                    }}
                    onClose={() => setSelectedComponentId(null)}
                  />
                );
              })()}
            </div>
          )}

          {canvasMode === 'code' && (
            <CodeEditor
              files={files}
              selectedFile={selectedFile}
              onSelectFile={setSelectedFile}
              onUpdateFile={(path, content) => {
                setFiles(prev => {
                  const next = new Map(prev);
                  const existing = next.get(path);
                  if (existing) {
                    next.set(path, { ...existing, content, isManuallyEdited: true });
                  }
                  return next;
                });
                studio.updateFile(path, content).catch(console.error);
              }}
              isGenerating={isGenerating}
              genProgress={genProgress}
            />
          )}

          {canvasMode === 'preview' && (
            <PreviewPanel
              status={previewStatus}
              onStart={startPreview}
              onStop={stopPreview}
              projectId={projectId || ''}
            />
          )}

          {canvasMode === 'docs' && (
            <div className="docs-panel">
              <div className="docs-empty">
                <iconify-icon icon="solar:document-text-linear" width={40} style={{ color: 'var(--text-muted)' }} />
                <p className="text-muted">Documentation will be generated alongside your code.</p>
                <p className="text-muted text-sm">Generate code first, then docs will appear here.</p>
              </div>
            </div>
          )}
        </div>

        {/* Right panel — Chat + Activity */}
        {rightPanelOpen && (
          <aside className="workspace-right">
            <div className="panel-header">
              <span>Chat</span>
              <button onClick={() => setRightPanelOpen(false)} title="Collapse">
                <iconify-icon icon="solar:sidebar-minimalistic-linear" width={14} style={{ transform: 'scaleX(-1)' }} />
              </button>
            </div>
            <ChatPanel
              messages={messages}
              isStreaming={isStreaming}
              streamContent={streamContent}
              onSend={sendMessage}
            />
          </aside>
        )}

        {!rightPanelOpen && (
          <button className="panel-toggle right" onClick={() => setRightPanelOpen(true)}>
            <iconify-icon icon="solar:chat-round-dots-linear" width={14} />
          </button>
        )}
      </div>

      {/* Gen progress bar */}
      {isGenerating && genProgress && (
        <div className="gen-progress-bar">
          <div className="gen-progress-fill" style={{ width: `${(genProgress.progress / genProgress.total) * 100}%` }} />
          <span className="gen-progress-text text-xs">
            Generating {genProgress.file} ({genProgress.progress}/{genProgress.total})
          </span>
        </div>
      )}
    </div>
  );
}
