import { useMemo, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import type { ProjectFile } from '../../api/types';
import './CodeEditor.css';

interface CodeEditorProps {
  files: Map<string, ProjectFile>;
  selectedFile: string | null;
  onSelectFile: (path: string) => void;
  onUpdateFile: (path: string, content: string) => void;
  isGenerating: boolean;
  genProgress: { file: string; progress: number; total: number } | null;
}

function getLanguage(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    json: 'json',
    md: 'markdown',
    html: 'html',
    css: 'css',
    yml: 'yaml',
    yaml: 'yaml',
    sql: 'sql',
    py: 'python',
    dockerfile: 'dockerfile',
    env: 'plaintext',
  };
  if (path.toLowerCase().includes('dockerfile')) return 'dockerfile';
  return map[ext] || 'plaintext';
}

function getFileIcon(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    ts: 'solar:code-square-linear',
    tsx: 'solar:code-square-linear',
    js: 'solar:code-square-linear',
    json: 'solar:document-text-linear',
    md: 'solar:document-text-linear',
    html: 'solar:code-linear',
    css: 'solar:palette-linear',
    yml: 'solar:settings-linear',
    yaml: 'solar:settings-linear',
    sql: 'solar:database-linear',
    py: 'solar:code-square-linear',
  };
  return map[ext] || 'solar:document-linear';
}

function buildFileTree(files: Map<string, ProjectFile>): TreeNode[] {
  const root: TreeNode[] = [];
  const dirs = new Map<string, TreeNode>();

  const sortedPaths = Array.from(files.keys()).sort();

  for (const filePath of sortedPaths) {
    const parts = filePath.split('/');
    let currentLevel = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const fullPath = parts.slice(0, i + 1).join('/');
      const isFile = i === parts.length - 1;

      if (isFile) {
        currentLevel.push({
          name: part,
          path: filePath,
          isDir: false,
          children: [],
        });
      } else {
        let dir = dirs.get(fullPath);
        if (!dir) {
          dir = { name: part, path: fullPath, isDir: true, children: [] };
          dirs.set(fullPath, dir);
          currentLevel.push(dir);
        }
        currentLevel = dir.children;
      }
    }
  }

  return root;
}

interface TreeNode {
  name: string;
  path: string;
  isDir: boolean;
  children: TreeNode[];
}

function FileTreeItem({
  node,
  selectedFile,
  onSelect,
  depth = 0,
}: {
  node: TreeNode;
  selectedFile: string | null;
  onSelect: (path: string) => void;
  depth?: number;
}) {
  if (node.isDir) {
    return (
      <div className="file-tree-dir">
        <div className="file-tree-item dir" style={{ paddingLeft: 8 + depth * 14 }}>
          <iconify-icon icon="solar:folder-linear" width={14} style={{ color: 'var(--warning)' }} />
          <span>{node.name}</span>
        </div>
        {node.children.map((child) => (
          <FileTreeItem
            key={child.path}
            node={child}
            selectedFile={selectedFile}
            onSelect={onSelect}
            depth={depth + 1}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={`file-tree-item ${selectedFile === node.path ? 'selected' : ''}`}
      style={{ paddingLeft: 8 + depth * 14 }}
      onClick={() => onSelect(node.path)}
    >
      <iconify-icon icon={getFileIcon(node.path)} width={14} />
      <span>{node.name}</span>
    </div>
  );
}

export default function CodeEditor({
  files,
  selectedFile,
  onSelectFile,
  onUpdateFile,
  isGenerating,
  genProgress,
}: CodeEditorProps) {
  const fileTree = useMemo(() => buildFileTree(files), [files]);

  const currentFile = selectedFile ? files.get(selectedFile) : null;
  const language = selectedFile ? getLanguage(selectedFile) : 'plaintext';

  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      if (selectedFile && value !== undefined) {
        onUpdateFile(selectedFile, value);
      }
    },
    [selectedFile, onUpdateFile]
  );

  if (files.size === 0) {
    return (
      <div className="code-editor-empty">
        <iconify-icon icon="solar:code-linear" width={40} style={{ color: 'var(--text-muted)' }} />
        <p className="text-muted">No files generated yet.</p>
        <p className="text-muted text-sm">
          {isGenerating
            ? 'Code generation in progress...'
            : 'Click "Generate Code" to create files from your architecture.'}
        </p>
      </div>
    );
  }

  return (
    <div className="code-editor">
      {/* File tree */}
      <div className="file-tree">
        <div className="file-tree-header">
          <span>Files</span>
          <span className="text-xs text-muted">{files.size}</span>
        </div>
        <div className="file-tree-body">
          {fileTree.map((node) => (
            <FileTreeItem
              key={node.path}
              node={node}
              selectedFile={selectedFile}
              onSelect={onSelectFile}
            />
          ))}
        </div>
      </div>

      {/* Editor */}
      <div className="editor-panel">
        {selectedFile && (
          <div className="editor-tab-bar">
            <div className="editor-tab active">
              <iconify-icon icon={getFileIcon(selectedFile)} width={13} />
              <span>{selectedFile.split('/').pop()}</span>
            </div>
            <div className="editor-tab-path text-xs text-muted">{selectedFile}</div>
          </div>
        )}
        <div className="editor-body">
          {currentFile ? (
            <Editor
              theme="vs-dark"
              language={language}
              value={currentFile.content}
              onChange={handleEditorChange}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                fontFamily: "'JetBrains Mono', monospace",
                lineHeight: 20,
                padding: { top: 12 },
                scrollBeyondLastLine: false,
                renderLineHighlight: 'none',
                overviewRulerBorder: false,
                hideCursorInOverviewRuler: true,
                readOnly: isGenerating,
              }}
            />
          ) : (
            <div className="editor-placeholder text-muted text-sm">
              Select a file from the tree to edit
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
