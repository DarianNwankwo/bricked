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
export declare function getArtifactsDir(slug: string): string;
export declare function slugify(name: string): string;
export declare function hasStashedArtifacts(slug: string): Promise<boolean>;
export declare function stashArtifacts(slug: string, projectId: string, files: ArtifactFile[]): Promise<ArtifactManifest>;
export declare function loadArtifacts(slug: string): Promise<{
    manifest: ArtifactManifest;
    files: Array<ArtifactFile & {
        isManuallyEdited: boolean;
    }>;
} | null>;
export declare function updateArtifactFile(slug: string, path: string, content: string): Promise<void>;
export declare function deleteArtifacts(slug: string): Promise<void>;
export interface ArtifactStructure {
    hasPackageJson: boolean;
    framework: 'next' | 'express' | 'fastapi' | 'static' | 'unknown';
    components: Array<{
        name: string;
        directory: string;
        hasDockerfile: boolean;
        hasPackageJson: boolean;
        fileCount: number;
    }>;
    totalFiles: number;
}
/**
 * Analyze the structure of stashed artifacts for intelligent preview generation.
 */
export declare function getArtifactStructure(slug: string): Promise<ArtifactStructure | null>;
//# sourceMappingURL=artifacts.d.ts.map