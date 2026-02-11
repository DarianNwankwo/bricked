export interface DeployResult {
    success: boolean;
    appId?: string;
    url?: string;
    dashboardUrl?: string;
    error?: string;
}
export interface DOProject {
    id: string;
    name: string;
    description: string;
    environment: 'Development' | 'Staging' | 'Production';
    isDefault: boolean;
    createdAt: string;
    updatedAt: string;
}
export interface ProjectResult {
    success: boolean;
    project?: DOProject;
    error?: string;
}
export declare function listProjects(): Promise<{
    success: boolean;
    projects: DOProject[];
    error?: string;
}>;
export declare function createProject(name: string, description?: string, environment?: 'Development' | 'Staging' | 'Production'): Promise<ProjectResult>;
export declare function assignAppToProject(projectId: string, appId: string): Promise<{
    success: boolean;
    error?: string;
}>;
export declare function getProjectApps(projectId: string): Promise<{
    success: boolean;
    appIds: string[];
    error?: string;
}>;
export declare function checkDoctl(): Promise<boolean>;
export declare function deploy(appspecPath: string): Promise<DeployResult>;
export declare function updateApp(appId: string, appspecPath: string): Promise<DeployResult>;
export declare function deleteApp(appId: string): Promise<{
    success: boolean;
    error?: string;
}>;
export declare function getAppLogs(appId: string, component?: string): Promise<string>;
//# sourceMappingURL=doctl.d.ts.map