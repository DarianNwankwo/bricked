import type { LLMConfig } from '../llm/config.js';
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
//# sourceMappingURL=planner.d.ts.map