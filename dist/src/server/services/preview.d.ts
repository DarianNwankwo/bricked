import type { Project } from '../db/schema.js';
interface PreviewSession {
    projectId: string;
    status: 'starting' | 'running' | 'stopping' | 'stopped' | 'error';
    directory: string;
    startedAt: Date;
    services: Array<{
        name: string;
        status: string;
        port?: number;
        url?: string;
    }>;
    error?: string;
}
export declare function startPreview(project: Project): Promise<PreviewSession>;
export declare function stopPreview(projectId: string): Promise<void>;
export declare function getPreviewStatus(projectId: string): PreviewSession | null;
export declare function streamPreviewLogs(projectId: string, signal?: AbortSignal): AsyncGenerator<string, void, unknown>;
/**
 * Get all running preview URLs for a project.
 */
export declare function getPreviewUrls(projectId: string): string[];
/**
 * Start preview using real artifacts instead of placeholders.
 * Detects framework and generates appropriate Dockerfiles.
 */
export declare function previewFromArtifacts(slug: string, project: Project): Promise<PreviewSession>;
/**
 * Rebuild preview after re-generation — stops, re-copies artifacts, and restarts.
 */
export declare function rebuildPreview(project: Project): Promise<PreviewSession>;
export declare function refreshPreviewStatus(projectId: string): Promise<PreviewSession | null>;
export {};
//# sourceMappingURL=preview.d.ts.map