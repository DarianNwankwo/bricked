export type ComponentType =
  | 'service'
  | 'static_site'
  | 'worker'
  | 'job'
  | 'database';

export type DatabaseEngine =
  | 'PG'        // PostgreSQL
  | 'MYSQL'
  | 'REDIS'
  | 'MONGODB';

export interface IRComponent {
  id: string;
  name: string;
  type: ComponentType;
  config: IRComponentConfig;
  connections: string[];
}

export interface IRComponentConfig {
  port?: number;
  schedule?: string;
  instanceCount?: number;
  instanceSize?: string;
  buildCommand?: string;
  runCommand?: string;
  outputDir?: string;
  envVars?: Record<string, string>;
  engine?: DatabaseEngine;
  version?: string;
}

export interface IRApp {
  name: string;
  region: string;
  components: IRComponent[];
}
