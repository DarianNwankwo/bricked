import type { Project, Environment } from '../db/schema.js';
import type { CloudProvider, CloudResource, ResourceMapping, ProviderDeployResult, ProviderAppStatus } from './cloud-provider.js';
declare class DigitalOceanProvider implements CloudProvider {
    readonly name = "digitalocean";
    readonly displayName = "DigitalOcean";
    private token;
    constructor();
    isConfigured(): boolean;
    mapComponentToResource(type: string, _name: string): ResourceMapping;
    getAvailableTiers(type: string): CloudResource[];
    estimateMonthlyCost(project: Project): number;
    deploy(project: Project, env: Environment): Promise<ProviderDeployResult>;
    getStatus(appId: string): Promise<ProviderAppStatus>;
    destroy(appId: string): Promise<void>;
    private request;
    private projectToAppSpec;
    private createApp;
    private updateApp;
    private getApp;
    private deleteApp;
    getDeploymentLogs(appId: string, deploymentId: string): Promise<string>;
    validateToken(): Promise<boolean>;
}
export declare const digitalOceanProvider: DigitalOceanProvider;
export declare const digitalOcean: DigitalOceanProvider;
export {};
//# sourceMappingURL=digitalocean.d.ts.map