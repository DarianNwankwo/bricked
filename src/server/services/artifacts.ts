// Artifact stashing service — persists generated code to filesystem
// Files are stored under data/artifacts/{slug}/ with a manifest.json

import { readFile, writeFile, mkdir, rm, readdir, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface ArtifactManifest {
  projectId: string;
  projectSlug: string;
  generatedAt: string;
  files: ArtifactFileEntry[];
}

export interface ArtifactFileEntry {
  path: string;
  componentId: string | null;
  generatedAt: string;
  lastModifiedAt: string;
  isManuallyEdited: boolean;
  checksum: string;
}

export interface ArtifactFile {
  path: string;
  content: string;
  componentId: string | null;
}

function getDataDir(): string {
  return join(__dirname, '..', '..', '..', 'data');
}

export function getArtifactsDir(slug: string): string {
  return join(getDataDir(), 'artifacts', slug);
}

function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export async function hasStashedArtifacts(slug: string): Promise<boolean> {
  const manifestPath = join(getArtifactsDir(slug), 'manifest.json');
  return existsSync(manifestPath);
}

export async function stashArtifacts(
  slug: string,
  projectId: string,
  files: ArtifactFile[]
): Promise<ArtifactManifest> {
  const artifactsDir = getArtifactsDir(slug);
  const now = new Date().toISOString();

  const entries: ArtifactFileEntry[] = [];

  for (const file of files) {
    const filePath = join(artifactsDir, file.path);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, file.content, 'utf8');

    entries.push({
      path: file.path,
      componentId: file.componentId,
      generatedAt: now,
      lastModifiedAt: now,
      isManuallyEdited: false,
      checksum: sha256(file.content),
    });
  }

  const manifest: ArtifactManifest = {
    projectId,
    projectSlug: slug,
    generatedAt: now,
    files: entries,
  };

  await writeFile(
    join(artifactsDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
    'utf8'
  );

  return manifest;
}

export async function loadArtifacts(
  slug: string
): Promise<{ manifest: ArtifactManifest; files: Array<ArtifactFile & { isManuallyEdited: boolean }> } | null> {
  const artifactsDir = getArtifactsDir(slug);
  const manifestPath = join(artifactsDir, 'manifest.json');

  if (!existsSync(manifestPath)) {
    return null;
  }

  const manifest: ArtifactManifest = JSON.parse(
    await readFile(manifestPath, 'utf8')
  );

  const files: Array<ArtifactFile & { isManuallyEdited: boolean }> = [];

  for (const entry of manifest.files) {
    const filePath = join(artifactsDir, entry.path);
    if (!existsSync(filePath)) continue;

    const content = await readFile(filePath, 'utf8');
    const currentChecksum = sha256(content);

    // Detect external edits since last stash
    if (currentChecksum !== entry.checksum) {
      entry.isManuallyEdited = true;
      entry.checksum = currentChecksum;
      entry.lastModifiedAt = new Date().toISOString();
    }

    files.push({
      path: entry.path,
      content,
      componentId: entry.componentId,
      isManuallyEdited: entry.isManuallyEdited,
    });
  }

  // Persist any detected changes back to manifest
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  return { manifest, files };
}

export async function updateArtifactFile(
  slug: string,
  path: string,
  content: string
): Promise<void> {
  const artifactsDir = getArtifactsDir(slug);
  const manifestPath = join(artifactsDir, 'manifest.json');

  if (!existsSync(manifestPath)) return;

  const manifest: ArtifactManifest = JSON.parse(
    await readFile(manifestPath, 'utf8')
  );

  const entry = manifest.files.find(f => f.path === path);
  if (entry) {
    entry.checksum = sha256(content);
    entry.lastModifiedAt = new Date().toISOString();
    entry.isManuallyEdited = true;
  }

  const filePath = join(artifactsDir, path);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, content, 'utf8');
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
}

export async function deleteArtifacts(slug: string): Promise<void> {
  const artifactsDir = getArtifactsDir(slug);
  if (existsSync(artifactsDir)) {
    await rm(artifactsDir, { recursive: true, force: true });
  }
}
