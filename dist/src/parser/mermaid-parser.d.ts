import type { MermaidAST } from '../types/ast.js';
export declare class MermaidParseError extends Error {
    line?: number | undefined;
    constructor(message: string, line?: number | undefined);
}
export declare function parseMermaid(input: string): MermaidAST;
//# sourceMappingURL=mermaid-parser.d.ts.map