import type { MermaidAST } from '../types/ast.js';
import type { IRApp } from '../types/ir.js';
export interface TransformOptions {
    name?: string;
    region?: string;
}
export declare function transformAST(ast: MermaidAST, options?: TransformOptions): IRApp;
//# sourceMappingURL=transformer.d.ts.map