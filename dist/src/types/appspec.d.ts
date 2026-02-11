export interface AppSpec {
    name: string;
    region?: string;
    services?: ServiceSpec[];
    static_sites?: StaticSiteSpec[];
    workers?: WorkerSpec[];
    jobs?: JobSpec[];
    databases?: DatabaseSpec[];
}
export interface GitSource {
    repo: string;
    branch?: string;
    deploy_on_push?: boolean;
}
export interface GitHubSource {
    repo: string;
    branch?: string;
    deploy_on_push?: boolean;
}
export interface ImageSource {
    registry_type: 'DOCR' | 'DOCKER_HUB' | 'GHCR';
    repository: string;
    tag?: string;
}
export type SourceSpec = {
    git?: GitSource;
    github?: GitHubSource;
    image?: ImageSource;
};
export interface EnvVar {
    key: string;
    value?: string;
    scope?: 'RUN_TIME' | 'BUILD_TIME' | 'RUN_AND_BUILD_TIME';
    type?: 'GENERAL' | 'SECRET';
}
export interface ServiceSpec extends SourceSpec {
    name: string;
    environment_slug?: string;
    build_command?: string;
    run_command?: string;
    http_port?: number;
    instance_count?: number;
    instance_size_slug?: string;
    envs?: EnvVar[];
    routes?: RouteSpec[];
}
export interface RouteSpec {
    path: string;
    preserve_path_prefix?: boolean;
}
export interface StaticSiteSpec extends SourceSpec {
    name: string;
    environment_slug?: string;
    build_command?: string;
    output_dir?: string;
    index_document?: string;
    error_document?: string;
    envs?: EnvVar[];
    routes?: RouteSpec[];
}
export interface WorkerSpec extends SourceSpec {
    name: string;
    environment_slug?: string;
    build_command?: string;
    run_command?: string;
    instance_count?: number;
    instance_size_slug?: string;
    envs?: EnvVar[];
}
export interface JobSpec extends SourceSpec {
    name: string;
    kind: 'PRE_DEPLOY' | 'POST_DEPLOY' | 'FAILED_DEPLOY';
    environment_slug?: string;
    build_command?: string;
    run_command?: string;
    instance_count?: number;
    instance_size_slug?: string;
    envs?: EnvVar[];
}
export interface DatabaseSpec {
    name: string;
    engine: 'PG' | 'MYSQL' | 'REDIS' | 'MONGODB';
    version?: string;
    size?: string;
    num_nodes?: number;
    production?: boolean;
}
//# sourceMappingURL=appspec.d.ts.map