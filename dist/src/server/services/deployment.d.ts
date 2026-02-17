import './digitalocean.js';
import type { Deployment, Environment, Project } from '../db/schema.js';
declare class DeploymentService {
    calculateMonthlyCost(project: Project): number;
    startDeployment(projectId: string, environmentName: Environment['name'], userId: string): Promise<Deployment>;
    private executeDeployment;
    private pollDeploymentStatus;
    getDeploymentStatus(deploymentId: string, userId: string): Promise<Deployment | null>;
    stopDeployment(projectId: string, environmentName: Environment['name'], userId: string): Promise<void>;
}
export declare const deploymentService: DeploymentService;
export {};
//# sourceMappingURL=deployment.d.ts.map