import type { Project, Environment } from '../db/schema.js';
interface DOAppSpec {
    name: string;
    region: string;
    services?: DOService[];
    static_sites?: DOStaticSite[];
    workers?: DOWorker[];
    jobs?: DOJob[];
    databases?: DODatabase[];
}
interface DOService {
    name: string;
    instance_size_slug: string;
    instance_count: number;
    http_port: number;
    image?: {
        registry_type: string;
        repository: string;
        tag: string;
    };
    git?: {
        repo_clone_url: string;
        branch: string;
    };
}
interface DOStaticSite {
    name: string;
    git?: {
        repo_clone_url: string;
        branch: string;
    };
    output_dir?: string;
}
interface DOWorker {
    name: string;
    instance_size_slug: string;
    instance_count: number;
    image?: {
        registry_type: string;
        repository: string;
        tag: string;
    };
}
interface DOJob {
    name: string;
    instance_size_slug: string;
    kind: 'PRE_DEPLOY' | 'POST_DEPLOY' | 'FAILED_DEPLOY';
}
interface DODatabase {
    name: string;
    engine: 'PG' | 'MYSQL' | 'REDIS' | 'MONGODB';
    production?: boolean;
}
interface DOAppResponse {
    app: {
        id: string;
        default_ingress: string;
        live_url: string;
        active_deployment?: {
            id: string;
            phase: string;
            progress?: {
                steps: Array<{
                    name: string;
                    status: string;
                }>;
            };
        };
    };
}
declare class DigitalOceanService {
    private token;
    constructor();
    private request;
    projectToAppSpec(project: Project, env: Environment): DOAppSpec;
    createApp(project: Project, env: Environment): Promise<DOAppResponse>;
    updateApp(appId: string, project: Project, env: Environment): Promise<DOAppResponse>;
    getApp(appId: string): Promise<DOAppResponse>;
    deleteApp(appId: string): Promise<void>;
    getDeploymentLogs(appId: string, deploymentId: string): Promise<string>;
    validateToken(): Promise<boolean>;
}
export declare const digitalOcean: DigitalOceanService;
export {};
//# sourceMappingURL=digitalocean.d.ts.map