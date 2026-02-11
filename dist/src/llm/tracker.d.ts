import type { AIUsageRecord } from '../server/db/schema.js';
export declare const PREMIUM_MODELS: string[];
export declare const STANDARD_MODELS: string[];
export interface TrackingOptions {
    userId: string;
    projectId?: string;
    model: string;
    provider: string;
}
export interface UsageInfo {
    inputTokens: number;
    outputTokens: number;
}
export declare function trackUsage(options: TrackingOptions, usage: UsageInfo): Promise<AIUsageRecord>;
export declare function getCurrentMonthUsage(userId: string): Promise<{
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCostCents: number;
    premiumCostCents: number;
    standardCostCents: number;
    byModel: Record<string, {
        inputTokens: number;
        outputTokens: number;
        costCents: number;
    }>;
    byProject: Record<string, {
        inputTokens: number;
        outputTokens: number;
        costCents: number;
    }>;
}>;
export declare function getUsageHistory(userId: string, months?: number): Promise<Array<{
    month: string;
    inputTokens: number;
    outputTokens: number;
    costCents: number;
}>>;
export declare function estimateTokens(text: string): number;
//# sourceMappingURL=tracker.d.ts.map