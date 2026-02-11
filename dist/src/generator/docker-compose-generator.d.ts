import type { Project } from '../server/db/schema.js';
export interface DockerComposeConfig {
    version: string;
    services: Record<string, unknown>;
    volumes?: Record<string, unknown>;
    networks?: Record<string, unknown>;
}
export declare function generateDockerCompose(project: Project): DockerComposeConfig;
export declare function generateDockerComposeYAML(project: Project): string;
export declare function generateDockerfile(componentType: 'service' | 'worker' | 'job'): string;
export declare function generateNginxConfig(componentName: string): string;
//# sourceMappingURL=docker-compose-generator.d.ts.map