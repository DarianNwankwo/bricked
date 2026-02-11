import type { NodeShape } from '../types/ast.js';
import type { ComponentType, DatabaseEngine } from '../types/ir.js';
export declare function inferComponentType(shape: NodeShape): ComponentType;
export declare function inferDatabaseEngine(label: string): DatabaseEngine;
export declare function inferDatabaseVersion(engine: DatabaseEngine): string;
export declare function inferPort(label: string): number;
export declare function slugify(name: string): string;
//# sourceMappingURL=inference.d.ts.map