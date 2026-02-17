// Artifact stashing service — persists generated code to filesystem
// Files are stored under data/artifacts/{slug}/ with a manifest.json
import { readFile, writeFile, mkdir, rm } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
function getDataDir() {
    return join(__dirname, '..', '..', '..', 'data');
}
export function getArtifactsDir(slug) {
    return join(getDataDir(), 'artifacts', slug);
}
function sha256(content) {
    return createHash('sha256').update(content, 'utf8').digest('hex');
}
export function slugify(name) {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}
export async function hasStashedArtifacts(slug) {
    const manifestPath = join(getArtifactsDir(slug), 'manifest.json');
    return existsSync(manifestPath);
}
export async function stashArtifacts(slug, projectId, files) {
    const artifactsDir = getArtifactsDir(slug);
    const now = new Date().toISOString();
    const entries = [];
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
    const manifest = {
        projectId,
        projectSlug: slug,
        generatedAt: now,
        files: entries,
    };
    await writeFile(join(artifactsDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
    return manifest;
}
export async function loadArtifacts(slug) {
    const artifactsDir = getArtifactsDir(slug);
    const manifestPath = join(artifactsDir, 'manifest.json');
    if (!existsSync(manifestPath)) {
        return null;
    }
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    const files = [];
    for (const entry of manifest.files) {
        const filePath = join(artifactsDir, entry.path);
        if (!existsSync(filePath))
            continue;
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
export async function updateArtifactFile(slug, path, content) {
    const artifactsDir = getArtifactsDir(slug);
    const manifestPath = join(artifactsDir, 'manifest.json');
    if (!existsSync(manifestPath))
        return;
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
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
export async function deleteArtifacts(slug) {
    const artifactsDir = getArtifactsDir(slug);
    if (existsSync(artifactsDir)) {
        await rm(artifactsDir, { recursive: true, force: true });
    }
}
/**
 * Analyze the structure of stashed artifacts for intelligent preview generation.
 */
export async function getArtifactStructure(slug) {
    const artifactsDir = getArtifactsDir(slug);
    const manifestPath = join(artifactsDir, 'manifest.json');
    if (!existsSync(manifestPath))
        return null;
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    const files = manifest.files.map(f => f.path);
    const hasRootPackageJson = files.some(f => f === 'package.json');
    // Detect framework
    let framework = 'unknown';
    if (files.some(f => f.includes('next.config'))) {
        framework = 'next';
    }
    else if (files.some(f => f.includes('app.py') || f.includes('main.py') || f.includes('fastapi'))) {
        framework = 'fastapi';
    }
    else if (files.some(f => f.includes('express') || f.includes('app.ts') || f.includes('server.ts'))) {
        framework = 'express';
    }
    else if (files.some(f => f.endsWith('.html')) && !files.some(f => f.endsWith('.ts') || f.endsWith('.js') || f.endsWith('.py'))) {
        framework = 'static';
    }
    // Detect component directories (top-level directories)
    const directories = new Map();
    for (const file of files) {
        const parts = file.split('/');
        if (parts.length > 1) {
            const dir = parts[0];
            const entry = directories.get(dir) || { hasDockerfile: false, hasPackageJson: false, fileCount: 0 };
            entry.fileCount++;
            if (parts[1] === 'Dockerfile')
                entry.hasDockerfile = true;
            if (parts[1] === 'package.json')
                entry.hasPackageJson = true;
            directories.set(dir, entry);
        }
    }
    const components = Array.from(directories.entries()).map(([name, info]) => ({
        name,
        directory: name,
        ...info,
    }));
    return {
        hasPackageJson: hasRootPackageJson,
        framework,
        components,
        totalFiles: files.length,
    };
}
//# sourceMappingURL=artifacts.js.map