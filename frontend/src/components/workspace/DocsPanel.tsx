import { useState, useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import './DocsPanel.css';

interface DocsPanelProps {
  documentation: string;
  isGenerating: boolean;
  onGenerate: () => void;
  onUpdate: (content: string) => void;
}

export default function DocsPanel({ documentation, isGenerating, onGenerate, onUpdate }: DocsPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [wasManuallyEdited, setWasManuallyEdited] = useState(false);

  const handleEditToggle = useCallback(() => {
    if (!isEditing) {
      setEditContent(documentation);
    }
    setIsEditing(!isEditing);
  }, [isEditing, documentation]);

  const handleSave = useCallback(() => {
    onUpdate(editContent);
    setIsEditing(false);
    setWasManuallyEdited(true);
  }, [editContent, onUpdate]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
    setEditContent('');
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 's' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      handleCancel();
    }
  }, [handleSave, handleCancel]);

  const statusText = useMemo(() => {
    if (!documentation) return '';
    if (wasManuallyEdited) return 'Manually edited';
    return 'Generated from architecture';
  }, [documentation, wasManuallyEdited]);

  // Empty state
  if (!documentation && !isGenerating) {
    return (
      <div className="docs-panel">
        <div className="docs-empty-state">
          <div className="docs-empty-icon">
            <iconify-icon icon="solar:document-text-linear" width={48} />
          </div>
          <h3>Generate Documentation</h3>
          <p className="text-muted text-sm">
            Generate documentation from your architecture to describe your
            project's components, connections, and contracts.
          </p>
          <button className="primary docs-generate-btn" onClick={onGenerate}>
            <iconify-icon icon="solar:magic-stick-3-linear" width={16} />
            Generate from Architecture
          </button>
        </div>
      </div>
    );
  }

  // Loading state
  if (isGenerating && !documentation) {
    return (
      <div className="docs-panel">
        <div className="docs-empty-state">
          <div className="docs-empty-icon generating">
            <iconify-icon icon="solar:document-text-linear" width={48} />
          </div>
          <h3>Generating Documentation...</h3>
          <p className="text-muted text-sm">
            Analyzing your architecture and building documentation.
          </p>
          <div className="docs-loading-bar">
            <div className="docs-loading-bar-fill" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="docs-panel">
      {/* Toolbar */}
      <div className="docs-toolbar">
        <div className="docs-toolbar-left">
          <button
            className={`primary docs-toolbar-btn ${isGenerating ? 'generating' : ''}`}
            onClick={onGenerate}
            disabled={isGenerating || isEditing}
            title="Regenerate documentation from architecture"
          >
            <iconify-icon
              icon={isGenerating ? 'solar:refresh-linear' : 'solar:magic-stick-3-linear'}
              width={14}
              style={isGenerating ? { animation: 'spin 1s linear infinite' } : undefined}
            />
            {isGenerating ? 'Generating...' : 'Generate'}
          </button>
          <button
            className={`docs-toolbar-btn ${isEditing ? 'active' : ''}`}
            onClick={handleEditToggle}
            disabled={isGenerating}
          >
            <iconify-icon
              icon={isEditing ? 'solar:eye-linear' : 'solar:pen-2-linear'}
              width={14}
            />
            {isEditing ? 'Preview' : 'Edit'}
          </button>
        </div>
        <div className="docs-toolbar-right">
          {statusText && (
            <span className="docs-status">
              <iconify-icon
                icon={wasManuallyEdited ? 'solar:pen-2-linear' : 'solar:cpu-bolt-linear'}
                width={12}
              />
              {statusText}
            </span>
          )}
          {isEditing && (
            <div className="docs-edit-actions">
              <button className="docs-toolbar-btn" onClick={handleCancel}>
                Cancel
              </button>
              <button className="primary docs-toolbar-btn" onClick={handleSave}>
                <iconify-icon icon="solar:diskette-linear" width={14} />
                Save
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="docs-content-wrapper">
        {isEditing ? (
          <textarea
            className="docs-editor"
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Write your documentation in markdown..."
            spellCheck={false}
            autoFocus
          />
        ) : (
          <div className="docs-content">
            <ReactMarkdown
              components={{
                code({ className, children, ...props }) {
                  const isInline = !className;
                  if (isInline) {
                    return <code className="docs-inline-code" {...props}>{children}</code>;
                  }
                  return (
                    <pre className="docs-code-block">
                      <code className={className} {...props}>{children}</code>
                    </pre>
                  );
                },
                h1: ({ children }) => <h1 className="docs-h1">{children}</h1>,
                h2: ({ children }) => <h2 className="docs-h2">{children}</h2>,
                h3: ({ children }) => <h3 className="docs-h3">{children}</h3>,
                h4: ({ children }) => <h4 className="docs-h4">{children}</h4>,
                a: ({ href, children }) => (
                  <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
                ),
              }}
            >
              {documentation}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
