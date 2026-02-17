import type { LLMConfig } from '../llm/config.js';
import type { FilePlan, Component } from './planner.js';
import type { BrickAppContract } from '../types/bac.js';
export interface GeneratedFile {
    path: string;
    content: string;
    componentId: string | null;
    generatedAt: Date;
}
export interface GenerateFileParams {
    file: FilePlan;
    components: Component[];
    existingFiles: Map<string, string>;
    config?: LLMConfig;
}
export interface EditFileParams extends GenerateFileParams {
    existingContent: string;
    editRequest: string;
}
export declare function generateFile(params: GenerateFileParams): Promise<GeneratedFile>;
export declare function editFile(params: EditFileParams): Promise<GeneratedFile>;
export declare function generateFileStream(params: GenerateFileParams): AsyncGenerator<string, GeneratedFile, unknown>;
export interface GenerateAllParams {
    files: FilePlan[];
    components: Component[];
    config?: LLMConfig;
    onProgress?: (completed: number, total: number, currentFile: string) => void;
}
export declare function generateAllFiles(params: GenerateAllParams): Promise<GeneratedFile[]>;
export interface GenerateFileFromBACParams extends GenerateFileParams {
    bac: BrickAppContract;
}
/**
 * Generate a file with full BAC contract context.
 * Includes the node's contract + adjacent edge contracts in the prompt.
 */
export declare function generateFileFromBAC(params: GenerateFileFromBACParams): Promise<GeneratedFile>;
//# sourceMappingURL=generator.d.ts.map