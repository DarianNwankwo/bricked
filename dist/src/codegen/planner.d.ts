import type { LLMConfig } from '../llm/config.js';
import type { BrickAppContract } from '../types/bac.js';
export interface FilePlan {
    path: string;
    purpose: string;
    componentId: string | null;
    dependencies: string[];
}
export interface CodePlan {
    files: FilePlan[];
}
export interface Component {
    id: string;
    name: string;
    type: string;
    spec?: {
        description?: string;
        inputs?: string;
        outputs?: string;
        notes?: string;
    };
    connections?: string[];
}
export declare function planCodeStructure(components: Component[], projectName: string, config?: LLMConfig): Promise<CodePlan>;
/**
 * Plan code structure using full BAC contract data for richer context.
 */
export declare function planCodeStructureFromBAC(bac: BrickAppContract, projectName: string, config?: LLMConfig): Promise<CodePlan>;
//# sourceMappingURL=planner.d.ts.map