/**
 * Codegen routes — code generation, component specs, file management
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import type { ComponentSpec, ProjectFile } from '../state/ProjectSession.js';
import { parse } from '../../parser/index.js';
import { transform } from '../../transformer/index.js';
import { getLLMConfig } from '../../llm/config.js';
import {
  planCodeStructure,
  generateFile,
  editFile,
  type Component,
  type FilePlan,
  type GeneratedFile,
} from '../../codegen/index.js';
import { stashArtifacts } from '../services/artifacts.js';
import { resolveSession } from '../state/resolveSession.js';
import { syncSessionToDb } from '../services/session-sync.js';
import { getDatabase } from '../db/client.js';

const router = Router();

// ── Diff helpers ────────────────────────────────────────────────────────

type EditStrategy = 'targeted_edit' | 'full_regeneration';

interface ArchitectureDiff {
  changed: Set<string>;
  removed: Set<string>;
  hasChanges: boolean;
}

const TARGETED_SHARED_FILES = new Set([
  'package.json', '.env.example', 'README.md', 'Dockerfile',
  'docker-compose.yml', 'tsconfig.json',
]);

function componentSignature(component: Component): string {
  const connections = (component.connections || []).slice().sort().join(',');
  return `${component.name}|${component.type}|${connections}`;
}

function specSignature(spec: ComponentSpec | undefined): string {
  return JSON.stringify({
    description: spec?.description || '',
    inputs: spec?.inputs || '',
    outputs: spec?.outputs || '',
    notes: spec?.notes || '',
  });
}

function diffArchitectureAndSpecs(
  previousComponents: Component[],
  nextComponents: Component[],
  previousSpecs: Record<string, ComponentSpec>,
  nextSpecs: Record<string, ComponentSpec>
): ArchitectureDiff {
  const changed = new Set<string>();
  const previousById = new Map(previousComponents.map(c => [c.id, c]));

  for (const next of nextComponents) {
    const previous = previousById.get(next.id);
    if (!previous) {
      changed.add(next.id);
    } else if (componentSignature(previous) !== componentSignature(next)) {
      changed.add(next.id);
    }
    if (specSignature(previousSpecs[next.id]) !== specSignature(nextSpecs[next.id])) {
      changed.add(next.id);
    }
    previousById.delete(next.id);
  }

  const removed = new Set(previousById.keys());
  return { changed, removed, hasChanges: changed.size > 0 || removed.size > 0 };
}

function pickFilesForGeneration(
  planFiles: FilePlan[],
  existingFiles: Map<string, ProjectFile>,
  diff: ArchitectureDiff,
  strategy: EditStrategy
): FilePlan[] {
  if (strategy === 'full_regeneration' || existingFiles.size === 0) {
    return planFiles;
  }

  const selectedPaths = new Set<string>();

  for (const file of planFiles) {
    const existing = existingFiles.get(file.path);
    if (!existing) { selectedPaths.add(file.path); continue; }
    if (file.componentId && diff.changed.has(file.componentId)) { selectedPaths.add(file.path); continue; }
    if (!file.componentId && diff.hasChanges && TARGETED_SHARED_FILES.has(file.path)) { selectedPaths.add(file.path); continue; }
  }

  let expanded = true;
  while (expanded) {
    expanded = false;
    for (const file of planFiles) {
      if (selectedPaths.has(file.path)) continue;
      if (file.dependencies.some(dep => selectedPaths.has(dep))) {
        selectedPaths.add(file.path);
        expanded = true;
      }
    }
  }

  return planFiles.filter(file => selectedPaths.has(file.path));
}

function buildEditRequest(
  file: FilePlan,
  componentsById: Map<string, Component>,
  diff: ArchitectureDiff
): string {
  if (file.componentId) {
    const component = componentsById.get(file.componentId);
    if (component) {
      return `Update this file to reflect the latest architecture/spec changes for component "${component.name}" (${component.type}). Preserve existing behavior that still applies.`;
    }
  }
  const changedIds = Array.from(diff.changed);
  if (changedIds.length > 0) {
    return `Update this shared file to stay consistent with the latest architecture and component spec changes for: ${changedIds.join(', ')}. Keep the existing structure when possible.`;
  }
  return 'Keep this file aligned with the current architecture while preserving existing implementation details.';
}

// ── Routes ──────────────────────────────────────────────────────────────

// GET /api/component-specs
router.get('/component-specs', (req: Request, res: Response) => {
  const session = resolveSession(req);
  res.json({ componentSpecs: session.currentProject.componentSpecs, bac: session.currentBAC });
});

// PUT /api/component-specs
router.put('/component-specs', (req: Request, res: Response) => {
  try {
    const session = resolveSession(req);
    const { componentSpecs } = req.body || {};
    session.currentProject.componentSpecs = (componentSpecs || {}) as Record<string, ComponentSpec>;
    session.refreshBACFromCurrentArchitecture();
    syncSessionToDb(session).catch(() => {});
    res.json({ success: true, bac: session.currentBAC });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// POST /api/generate-code — SSE streaming code generation
router.post('/generate-code', async (req: Request, res: Response) => {
  const session = resolveSession(req);

  if (session.isGeneratingCode) {
    res.status(429).json({ error: 'Code generation already in progress' });
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  try {
    session.isGeneratingCode = true;
    const componentSpecs = (req.body?.componentSpecs || {}) as Record<string, ComponentSpec>;
    const strategy: EditStrategy = req.body?.strategy === 'full_regeneration'
      ? 'full_regeneration'
      : 'targeted_edit';

    if (!session.currentDiagram) {
      res.write(`data: ${JSON.stringify({ error: 'No architecture to generate code from' })}\n\n`);
      res.end();
      session.isGeneratingCode = false;
      return;
    }

    const ast = parse(session.currentDiagram);
    const ir = transform(ast);

    const components: Component[] = ir.components.map((c: { id: string; name: string; type: string; connections?: string[] }) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      connections: c.connections || [],
      spec: componentSpecs?.[c.id] || {},
    }));

    const previousSpecs = session.currentProject.componentSpecs;
    const previousComponents = session.currentProject.lastGeneratedComponents;
    const diff = diffArchitectureAndSpecs(previousComponents, components, previousSpecs, componentSpecs);
    const componentsById = new Map(components.map(c => [c.id, c]));

    let config;
    try {
      config = getLLMConfig();
      if (session.selectedModel) {
        config = { ...config, model: session.selectedModel };
      }
    } catch (e) {
      res.write(`data: ${JSON.stringify({ error: (e as Error).message })}\n\n`);
      res.end();
      session.isGeneratingCode = false;
      return;
    }

    res.write(`data: ${JSON.stringify({ status: 'planning', message: 'Planning file structure...' })}\n\n`);

    const plan = await planCodeStructure(components, ir.name || 'app', config);
    const filesToGenerate = pickFilesForGeneration(plan.files, session.currentProject.files, diff, strategy);
    const filesToGenerateSet = new Set(filesToGenerate.map(f => f.path));

    const plannedPaths = new Set(plan.files.map(f => f.path));
    for (const [path, file] of session.currentProject.files.entries()) {
      const removedComponent = file.componentId ? diff.removed.has(file.componentId) : false;
      if (!plannedPaths.has(path) || removedComponent) {
        session.currentProject.files.delete(path);
        res.write(`data: ${JSON.stringify({ status: 'file_removed', file: path })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({
      status: 'planned',
      files: plan.files.map(f => f.path),
      strategy,
      generateCount: filesToGenerate.length,
    })}\n\n`);

    const untouchedFiles = plan.files.filter(f =>
      !filesToGenerateSet.has(f.path) && session.currentProject.files.has(f.path)
    );
    for (const file of untouchedFiles) {
      const existing = session.currentProject.files.get(file.path);
      if (!existing) continue;
      res.write(`data: ${JSON.stringify({
        status: 'file_complete',
        file: file.path,
        content: existing.content,
        componentId: existing.componentId,
      })}\n\n`);
    }

    const existingFiles = new Map<string, string>(
      Array.from(session.currentProject.files.values()).map(f => [f.path, f.content])
    );
    const generatedFiles: GeneratedFile[] = [];

    for (let i = 0; i < filesToGenerate.length; i++) {
      const file = filesToGenerate[i];
      res.write(`data: ${JSON.stringify({
        status: 'generating',
        file: file.path,
        progress: i + 1,
        total: filesToGenerate.length,
        strategy,
      })}\n\n`);

      try {
        const existing = session.currentProject.files.get(file.path);
        const generated = existing && strategy === 'targeted_edit'
          ? await editFile({
            file,
            components,
            existingFiles,
            existingContent: existing.content,
            editRequest: buildEditRequest(file, componentsById, diff),
            config,
          })
          : await generateFile({
            file,
            components,
            existingFiles,
            config,
          });

        generatedFiles.push(generated);
        existingFiles.set(file.path, generated.content);

        session.currentProject.files.set(file.path, {
          path: file.path,
          content: generated.content,
          componentId: file.componentId,
          generatedAt: new Date(),
          isManuallyEdited: existing?.isManuallyEdited || false,
        });

        res.write(`data: ${JSON.stringify({
          status: 'file_complete',
          file: file.path,
          content: generated.content,
          componentId: file.componentId,
        })}\n\n`);
      } catch (error) {
        res.write(`data: ${JSON.stringify({
          status: 'file_error',
          file: file.path,
          error: error instanceof Error ? error.message : 'Unknown error',
        })}\n\n`);
      }
    }

    session.currentProject.componentSpecs = componentSpecs;
    session.currentProject.lastGeneratedComponents = components;
    session.refreshBACFromCurrentArchitecture();

    if (session.currentProjectId) {
      const db = getDatabase();
      const dbProject = await db.getProjectById(session.currentProjectId);
      if (dbProject) {
        const artifactFiles = Array.from(session.currentProject.files.values()).map(f => ({
          path: f.path,
          content: f.content,
          componentId: f.componentId,
        }));
        await stashArtifacts(dbProject.slug, dbProject.id, artifactFiles);
      }
    }

    res.write(`data: ${JSON.stringify({
      status: 'complete',
      fileCount: session.currentProject.files.size,
      generatedCount: generatedFiles.length,
      strategy,
    })}\n\n`);
    res.end();
  } catch (error) {
    res.write(`data: ${JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' })}\n\n`);
    res.end();
  } finally {
    session.isGeneratingCode = false;
  }
});

// GET /api/files
router.get('/files', (req: Request, res: Response) => {
  const session = resolveSession(req);
  const files = Array.from(session.currentProject.files.values()).map(f => ({
    path: f.path,
    componentId: f.componentId,
    isManuallyEdited: f.isManuallyEdited,
  }));
  res.json({ files });
});

// GET /api/file
router.get('/file', (req: Request, res: Response) => {
  const session = resolveSession(req);
  const filePath = req.query.path as string;
  if (!filePath) {
    res.status(400).json({ error: 'Missing path parameter' });
    return;
  }
  const file = session.currentProject.files.get(filePath);
  if (!file) {
    res.status(404).json({ error: 'File not found' });
    return;
  }
  res.json(file);
});

// PUT /api/file
router.put('/file', (req: Request, res: Response) => {
  try {
    const session = resolveSession(req);
    const { path: filePath, content } = req.body;
    const file = session.currentProject.files.get(filePath);
    if (!file) {
      res.status(404).json({ error: 'File not found' });
      return;
    }
    file.content = content;
    file.isManuallyEdited = true;
    session.currentProject.files.set(filePath, file);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// GET /api/download
router.get('/download', (req: Request, res: Response) => {
  const session = resolveSession(req);
  const files = Array.from(session.currentProject.files.values()).map(f => ({
    path: f.path,
    content: f.content,
  }));
  res.setHeader('Content-Disposition', 'attachment; filename="project.json"');
  res.json({ files });
});

// GET /api/source-files — read real project files from filesystem
router.get('/source-files', (_req: Request, res: Response) => {
  const sourceDir = join(process.cwd(), 'src');
  const allowedExts = new Set(['.ts', '.js', '.json', '.md', '.html', '.css']);
  const skipDirs = new Set(['node_modules', '.git', 'dist', '.next', '__pycache__']);
  const maxFileSize = 100 * 1024;

  function walkDir(dir: string, prefix = ''): Array<{ path: string; content: string }> {
    const results: Array<{ path: string; content: string }> = [];
    try {
      const entries = readdirSync(dir);
      for (const entry of entries) {
        if (skipDirs.has(entry)) continue;
        const fullPath = join(dir, entry);
        try {
          const stat = statSync(fullPath);
          if (stat.isDirectory()) {
            results.push(...walkDir(fullPath, prefix ? prefix + '/' + entry : entry));
          } else if (stat.isFile() && stat.size <= maxFileSize) {
            const ext = entry.slice(entry.lastIndexOf('.'));
            if (allowedExts.has(ext)) {
              const relPath = prefix ? prefix + '/' + entry : entry;
              results.push({ path: relPath, content: readFileSync(fullPath, 'utf-8') });
            }
          }
        } catch { continue; }
      }
    } catch { /* dir not readable */ }
    return results;
  }

  const files = walkDir(sourceDir).map(f => ({
    path: 'src/' + f.path,
    content: f.content,
    componentId: null,
  }));

  res.json({ files });
});

export default router;
