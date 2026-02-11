import type { BrickAnnotation } from '../types/ast.js';
export interface ParsedAnnotations {
    global: {
        name?: string;
        region?: string;
    };
    nodes: Map<string, NodeAnnotations>;
}
export interface NodeAnnotations {
    port?: number;
    schedule?: string;
    instanceCount?: number;
    instanceSize?: string;
    buildCommand?: string;
    runCommand?: string;
    outputDir?: string;
    engine?: string;
    version?: string;
    envVars?: Record<string, string>;
}
export declare function processAnnotations(annotations: BrickAnnotation[]): ParsedAnnotations;
//# sourceMappingURL=annotations.d.ts.map