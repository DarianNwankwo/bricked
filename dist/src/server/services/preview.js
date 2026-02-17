// Local preview service using Docker Compose
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, mkdir, rm } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { generateDockerCompose, generateDockerfile, generateNginxConfig } from '../../generator/docker-compose-generator.js';
import { loadArtifacts, hasStashedArtifacts, getArtifactStructure } from './artifacts.js';
import YAML from 'yaml';
const execAsync = promisify(exec);
const activePreviews = new Map();
// Parse docker compose ps --format json output
// Handles both JSON array format (newer Docker) and newline-delimited JSON (older Docker)
function parseDockerComposePs(stdout) {
    const trimmed = stdout.trim();
    if (!trimmed)
        return [];
    let entries;
    try {
        const parsed = JSON.parse(trimmed);
        entries = Array.isArray(parsed) ? parsed : [parsed];
    }
    catch {
        // Newline-delimited JSON
        entries = trimmed.split('\n').filter(Boolean).map(line => {
            try {
                return JSON.parse(line);
            }
            catch {
                return null;
            }
        }).filter(Boolean);
    }
    return entries.map((service) => {
        const port = service.Publishers?.[0]?.PublishedPort;
        return {
            name: service.Service || service.Name || 'unknown',
            status: service.State || 'unknown',
            port,
            url: port ? `http://localhost:${port}` : undefined,
        };
    });
}
// Check if Docker is available
async function checkDocker() {
    try {
        await execAsync('docker --version');
        await execAsync('docker compose version');
        return true;
    }
    catch {
        return false;
    }
}
// Get preview directory for a project
function getPreviewDirectory(projectId) {
    return join(tmpdir(), 'brick-preview', projectId);
}
// Generate preview files
async function generatePreviewFiles(project) {
    const previewDir = getPreviewDirectory(project.id);
    // Create directory if it doesn't exist
    if (!existsSync(previewDir)) {
        await mkdir(previewDir, { recursive: true });
    }
    // Generate docker-compose config and fix build contexts to point to subdirectories
    const config = generateDockerCompose(project);
    // Build a map of service name → subdirectory for build context fixup
    const serviceNameToDir = {};
    for (const component of project.architecture.components) {
        const serviceName = component.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        serviceNameToDir[serviceName] = './' + serviceName;
    }
    // Fix build contexts and volume paths to point to component subdirectories
    for (const [serviceName, serviceConfig] of Object.entries(config.services)) {
        if (serviceConfig.build === '.') {
            serviceConfig.build = serviceNameToDir[serviceName] || './' + serviceName;
        }
        if (serviceConfig.volumes) {
            serviceConfig.volumes = serviceConfig.volumes.map((v) => {
                if (v.startsWith('./dist:')) {
                    return './' + serviceName + '/dist' + v.slice(6);
                }
                return v;
            });
        }
    }
    // Remove obsolete version field
    delete config.version;
    const dockerComposeYaml = YAML.stringify(config, { indent: 2, lineWidth: 120 });
    await writeFile(join(previewDir, 'docker-compose.yml'), dockerComposeYaml);
    // Check for stashed artifacts and copy them into the preview directory
    const hasArtifacts = await hasStashedArtifacts(project.slug);
    if (hasArtifacts) {
        const stashed = await loadArtifacts(project.slug);
        if (stashed) {
            for (const file of stashed.files) {
                const destPath = join(previewDir, file.path);
                await mkdir(dirname(destPath), { recursive: true });
                await writeFile(destPath, file.content, 'utf8');
            }
        }
    }
    // Generate Dockerfiles for each service/worker/job component
    for (const component of project.architecture.components) {
        if (['service', 'worker', 'job'].includes(component.type)) {
            const componentDir = join(previewDir, component.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
            if (!existsSync(componentDir)) {
                await mkdir(componentDir, { recursive: true });
            }
            // Generate Dockerfile
            const dockerfile = generateDockerfile(component.type);
            await writeFile(join(componentDir, 'Dockerfile'), dockerfile);
            // Generate basic package.json if not exists
            const packageJsonPath = join(componentDir, 'package.json');
            if (!existsSync(packageJsonPath)) {
                const packageJson = {
                    name: component.name.toLowerCase().replace(/\s+/g, '-'),
                    version: '1.0.0',
                    main: 'index.js',
                    scripts: {
                        start: 'node index.js',
                        build: 'echo "No build step"',
                    },
                };
                await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
            }
            // Generate basic index.js placeholder (only if no stashed code exists)
            const indexPath = join(componentDir, 'index.js');
            if (!existsSync(indexPath)) {
                const indexJs = `// Placeholder for ${component.name}
const http = require('http');
const port = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    service: '${component.name}',
    status: 'running',
    timestamp: new Date().toISOString()
  }));
});

server.listen(port, () => {
  console.log(\`${component.name} listening on port \${port}\`);
});
`;
                await writeFile(indexPath, indexJs);
            }
        }
        // Generate nginx config for static sites
        if (component.type === 'static_site') {
            const componentDir = join(previewDir, component.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
            if (!existsSync(componentDir)) {
                await mkdir(componentDir, { recursive: true });
            }
            const distDir = join(componentDir, 'dist');
            if (!existsSync(distDir)) {
                await mkdir(distDir, { recursive: true });
            }
            // Create placeholder index.html (only if no stashed code exists)
            if (!existsSync(join(distDir, 'index.html'))) {
                const indexHtml = `<!DOCTYPE html>
<html>
<head>
  <title>${component.name}</title>
  <style>
    body { font-family: system-ui, sans-serif; padding: 2rem; }
    h1 { color: #333; }
    .status { color: #22c55e; }
  </style>
</head>
<body>
  <h1>${component.name}</h1>
  <p class="status">Static site is running</p>
  <p>Generated by Brick Studio</p>
</body>
</html>`;
                await writeFile(join(distDir, 'index.html'), indexHtml);
            }
            // Generate nginx config
            const nginxConfig = generateNginxConfig(component.name);
            await writeFile(join(componentDir, 'nginx.conf'), nginxConfig);
        }
    }
    return previewDir;
}
// Start preview for a project
export async function startPreview(project) {
    // Check if Docker is available
    const dockerAvailable = await checkDocker();
    if (!dockerAvailable) {
        throw new Error('Docker is not installed or not running. Please install Docker Desktop to use local preview.');
    }
    // Check if preview is already running
    const existing = activePreviews.get(project.id);
    if (existing && existing.status === 'running') {
        return existing;
    }
    // Create preview session
    const session = {
        projectId: project.id,
        status: 'starting',
        directory: getPreviewDirectory(project.id),
        startedAt: new Date(),
        services: [],
    };
    activePreviews.set(project.id, session);
    try {
        // Generate preview files
        const previewDir = await generatePreviewFiles(project);
        session.directory = previewDir;
        // Clean up any stale containers from previous runs
        try {
            await execAsync(`docker compose -f ${join(previewDir, 'docker-compose.yml')} down --remove-orphans 2>/dev/null`);
        }
        catch {
            // Ignore — no previous containers to clean up
        }
        // Start docker-compose
        await execAsync(`docker compose -f ${join(previewDir, 'docker-compose.yml')} up -d --build`);
        // Get service status
        const { stdout } = await execAsync(`docker compose -f ${join(previewDir, 'docker-compose.yml')} ps --format json`);
        // Parse service status — handle both JSON array and newline-delimited formats
        session.services = parseDockerComposePs(stdout);
        session.status = 'running';
    }
    catch (error) {
        session.status = 'error';
        session.error = error instanceof Error ? error.message : 'Unknown error';
        throw error;
    }
    return session;
}
// Stop preview for a project
export async function stopPreview(projectId) {
    const session = activePreviews.get(projectId);
    if (!session) {
        return;
    }
    session.status = 'stopping';
    try {
        const previewDir = getPreviewDirectory(projectId);
        if (existsSync(join(previewDir, 'docker-compose.yml'))) {
            await execAsync(`docker compose -f ${join(previewDir, 'docker-compose.yml')} down -v`);
        }
        session.status = 'stopped';
    }
    catch (error) {
        session.status = 'error';
        session.error = error instanceof Error ? error.message : 'Unknown error';
        throw error;
    }
    finally {
        // Clean up preview directory
        try {
            const previewDir = getPreviewDirectory(projectId);
            if (existsSync(previewDir)) {
                await rm(previewDir, { recursive: true, force: true });
            }
        }
        catch {
            // Ignore cleanup errors
        }
        activePreviews.delete(projectId);
    }
}
// Get preview status
export function getPreviewStatus(projectId) {
    return activePreviews.get(projectId) || null;
}
// Stream preview logs
export async function* streamPreviewLogs(projectId, signal) {
    const session = activePreviews.get(projectId);
    if (!session || session.status !== 'running') {
        yield '[Preview not running]\n';
        return;
    }
    const previewDir = getPreviewDirectory(projectId);
    const composePath = join(previewDir, 'docker-compose.yml');
    if (!existsSync(composePath)) {
        yield '[Preview files not found]\n';
        return;
    }
    const logProcess = spawn('docker', ['compose', '-f', composePath, 'logs', '-f', '--tail', '100'], {
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (signal) {
        signal.addEventListener('abort', () => {
            logProcess.kill();
        });
    }
    // Stream stdout
    for await (const chunk of logProcess.stdout) {
        yield chunk.toString();
    }
    // Stream stderr
    for await (const chunk of logProcess.stderr) {
        yield `[ERROR] ${chunk.toString()}`;
    }
}
/**
 * Get all running preview URLs for a project.
 */
export function getPreviewUrls(projectId) {
    const session = activePreviews.get(projectId);
    if (!session || session.status !== 'running')
        return [];
    return session.services
        .filter(s => s.url)
        .map(s => s.url);
}
/**
 * Start preview using real artifacts instead of placeholders.
 * Detects framework and generates appropriate Dockerfiles.
 */
export async function previewFromArtifacts(slug, project) {
    const dockerAvailable = await checkDocker();
    if (!dockerAvailable) {
        throw new Error('Docker is not installed or not running.');
    }
    const structure = await getArtifactStructure(slug);
    if (!structure || structure.totalFiles === 0) {
        throw new Error('No artifacts found. Generate code first.');
    }
    // Use the standard startPreview which already copies artifacts
    return startPreview(project);
}
/**
 * Rebuild preview after re-generation — stops, re-copies artifacts, and restarts.
 */
export async function rebuildPreview(project) {
    const existing = activePreviews.get(project.id);
    if (existing && (existing.status === 'running' || existing.status === 'starting')) {
        const previewDir = getPreviewDirectory(project.id);
        try {
            await execAsync(`docker compose -f ${join(previewDir, 'docker-compose.yml')} down --remove-orphans`);
        }
        catch {
            // Ignore
        }
        activePreviews.delete(project.id);
    }
    return startPreview(project);
}
// Refresh preview status from Docker
export async function refreshPreviewStatus(projectId) {
    const session = activePreviews.get(projectId);
    if (!session) {
        return null;
    }
    try {
        const previewDir = getPreviewDirectory(projectId);
        const composePath = join(previewDir, 'docker-compose.yml');
        if (!existsSync(composePath)) {
            session.status = 'stopped';
            return session;
        }
        const { stdout } = await execAsync(`docker compose -f ${composePath} ps --format json`);
        session.services = parseDockerComposePs(stdout);
        // Check if all services are running
        const allRunning = session.services.length > 0 && session.services.every(s => s.status === 'running');
        session.status = allRunning ? 'running' : 'error';
    }
    catch {
        session.status = 'error';
    }
    return session;
}
//# sourceMappingURL=preview.js.map