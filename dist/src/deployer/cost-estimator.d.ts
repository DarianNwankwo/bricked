import type { AppSpec } from '../types/appspec.js';
export interface CostBreakdown {
    name: string;
    type: string;
    cost: string;
    monthlyCents: number;
    specs?: string;
}
export interface CostEstimate {
    totalMonthlyCents: number;
    formatted: string;
    breakdown: CostBreakdown[];
}
export declare function estimateCost(appspec: AppSpec): CostEstimate;
export type ComponentType = 'service' | 'static_site' | 'worker' | 'job' | 'function' | 'container' | 'database' | 'cache' | 'queue' | 'storage' | 'search' | 'api_gateway' | 'load_balancer' | 'cdn' | 'dns' | 'firewall' | 'auth' | 'monitoring' | 'logging' | 'secrets' | 'registry' | 'email' | 'payment' | 'analytics' | 'ml_model' | 'third_party';
export interface SimpleComponent {
    id: string;
    name: string;
    type: ComponentType | string;
}
export declare function estimateCostFromComponents(components: SimpleComponent[]): CostEstimate;
//# sourceMappingURL=cost-estimator.d.ts.map