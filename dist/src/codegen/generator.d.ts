import type { LLMConfig } from '../llm/config.js';
import type { FilePlan, Component } from './planner.js';
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
export declare function generateFile(params: GenerateFileParams): Promise<GeneratedFile>;
export declare function generateFileStream(params: GenerateFileParams): AsyncGenerator<string, GeneratedFile, unknown>;
export interface GenerateAllParams {
    files: FilePlan[];
    components: Component[];
    config?: LLMConfig;
    onProgress?: (completed: number, total: number, currentFile: string) => void;
}
export declare function generateAllFiles(params: GenerateAllParams): Promise<GeneratedFile[]>;
//# sourceMappingURL=generator.d.ts.map