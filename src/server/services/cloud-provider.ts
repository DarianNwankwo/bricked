// Cloud provider abstraction — interface for all deployment targets

import type { Project, Environment } from '../db/schema.js';

export interface CloudResource {
  type: string;
  providerService: string;
  tier: string;
  monthlyCostCents: number;
  specs: string;
}

export interface ResourceMapping {
  componentType: string;
  resource: CloudResource;
  alternatives: CloudResource[];
}

export interface ProviderAppSpec {
  name: string;
  region: string;
  raw: unknown; // Provider-specific spec object
}

export interface ProviderDeployResult {
  appId: string;
  url?: string;
  status: string;
}

export interface ProviderAppStatus {
  appId: string;
  phase: string;
  url?: string;
}

export interface CloudProvider {
  readonly name: string;
  readonly displayName: string;

  mapComponentToResource(type: string, name: string): ResourceMapping;
  getAvailableTiers(type: string): CloudResource[];
  deploy(project: Project, env: Environment): Promise<ProviderDeployResult>;
  getStatus(appId: string): Promise<ProviderAppStatus>;
  destroy(appId: string): Promise<void>;
  estimateMonthlyCost(project: Project): number;
  isConfigured(): boolean;
}
