// DigitalOcean API service
// Uses Brick's master account to provision resources for users
// Implements CloudProvider interface for provider abstraction

import type { Project, Environment } from '../db/schema.js';
import type {
  CloudProvider,
  CloudResource,
  ResourceMapping,
  ProviderDeployResult,
  ProviderAppStatus,
} from './cloud-provider.js';
import { registerProvider } from './provider-registry.js';

const DO_API_BASE = 'https://api.digitalocean.com/v2';
const DO_TOKEN = process.env.BRICK_DO_TOKEN; // Brick's master DO token

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
  image?: { registry_type: string; repository: string; tag: string };
  git?: { repo_clone_url: string; branch: string };
}

interface DOStaticSite {
  name: string;
  git?: { repo_clone_url: string; branch: string };
  output_dir?: string;
}

interface DOWorker {
  name: string;
  instance_size_slug: string;
  instance_count: number;
  image?: { registry_type: string; repository: string; tag: string };
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
      progress?: { steps: Array<{ name: string; status: string }> };
    };
  };
}

// DO-specific resource mapping with tiers and pricing
const DO_RESOURCE_MAP: Record<string, CloudResource[]> = {
  service: [
    { type: 'service', providerService: 'App Platform Service', tier: 'basic-xxs', monthlyCostCents: 500, specs: '1 shared vCPU, 512MB RAM' },
    { type: 'service', providerService: 'App Platform Service', tier: 'basic-xs', monthlyCostCents: 1000, specs: '1 shared vCPU, 1GB RAM' },
    { type: 'service', providerService: 'App Platform Service', tier: 'professional-xs', monthlyCostCents: 1200, specs: '1 shared vCPU, 1GB RAM' },
  ],
  static_site: [
    { type: 'static_site', providerService: 'App Platform Static Site', tier: 'free', monthlyCostCents: 0, specs: 'CDN hosted, unlimited bandwidth' },
  ],
  worker: [
    { type: 'worker', providerService: 'App Platform Worker', tier: 'basic-xxs', monthlyCostCents: 500, specs: '1 shared vCPU, 512MB RAM' },
    { type: 'worker', providerService: 'App Platform Worker', tier: 'basic-xs', monthlyCostCents: 1000, specs: '1 shared vCPU, 1GB RAM' },
  ],
  database: [
    { type: 'database', providerService: 'Managed Database', tier: 'db-s-dev-database', monthlyCostCents: 700, specs: 'Dev: 512MB RAM, 10GB storage' },
    { type: 'database', providerService: 'Managed Database', tier: 'db-s-1vcpu-1gb', monthlyCostCents: 1500, specs: '1 vCPU, 1GB RAM, 10GB storage' },
  ],
  cache: [
    { type: 'cache', providerService: 'Managed Redis', tier: 'db-s-1vcpu-1gb', monthlyCostCents: 1500, specs: '1 vCPU, 1GB RAM' },
  ],
  queue: [
    { type: 'queue', providerService: 'App Platform Worker + Redis', tier: 'basic-xxs', monthlyCostCents: 2000, specs: 'Worker + managed Redis' },
  ],
  storage: [
    { type: 'storage', providerService: 'Spaces', tier: '250gb', monthlyCostCents: 500, specs: '250GB storage, CDN' },
  ],
  search: [
    { type: 'search', providerService: 'App Platform Service', tier: 'basic-m', monthlyCostCents: 5000, specs: '2 shared vCPUs, 2GB RAM (Elasticsearch)' },
  ],
  api_gateway: [
    { type: 'api_gateway', providerService: 'App Platform Service', tier: 'basic-xxs', monthlyCostCents: 350, specs: 'Nginx/Kong reverse proxy' },
  ],
  load_balancer: [
    { type: 'load_balancer', providerService: 'Load Balancer', tier: 'small', monthlyCostCents: 1200, specs: 'Regional load balancer' },
  ],
  cdn: [
    { type: 'cdn', providerService: 'Spaces CDN', tier: 'included', monthlyCostCents: 0, specs: 'Included with Spaces' },
  ],
  auth: [
    { type: 'auth', providerService: 'App Platform Service', tier: 'basic-xxs', monthlyCostCents: 0, specs: 'Auth service (free tier)' },
  ],
  monitoring: [
    { type: 'monitoring', providerService: 'Monitoring', tier: 'free', monthlyCostCents: 0, specs: 'Basic metrics included' },
  ],
  ml_model: [
    { type: 'ml_model', providerService: 'App Platform Service', tier: 'professional-m', monthlyCostCents: 3000, specs: 'GPU inference endpoint' },
  ],
};

const COST_PER_COMPONENT: Record<string, number> = {
  service: 500,
  static_site: 0,
  database: 700,
  worker: 500,
  job: 50,
  cache: 1500,
  queue: 2000,
  storage: 500,
  search: 5000,
  api_gateway: 350,
  load_balancer: 1200,
  cdn: 0,
  auth: 0,
  monitoring: 0,
  ml_model: 3000,
};

class DigitalOceanProvider implements CloudProvider {
  readonly name = 'digitalocean';
  readonly displayName = 'DigitalOcean';
  private token: string;

  constructor() {
    if (!DO_TOKEN) {
      console.warn('BRICK_DO_TOKEN not set - deployments will fail');
    }
    this.token = DO_TOKEN || '';
  }

  isConfigured(): boolean {
    return !!this.token;
  }

  mapComponentToResource(type: string, _name: string): ResourceMapping {
    const resources = DO_RESOURCE_MAP[type] || DO_RESOURCE_MAP['service'];
    return {
      componentType: type,
      resource: resources[0],
      alternatives: resources.slice(1),
    };
  }

  getAvailableTiers(type: string): CloudResource[] {
    return DO_RESOURCE_MAP[type] || [];
  }

  estimateMonthlyCost(project: Project): number {
    return project.architecture.components.reduce((total, comp) => {
      return total + (COST_PER_COMPONENT[comp.type] || 500);
    }, 0);
  }

  async deploy(project: Project, env: Environment): Promise<ProviderDeployResult> {
    let appResponse: DOAppResponse;
    if (env.doAppId) {
      appResponse = await this.updateApp(env.doAppId, project, env);
    } else {
      appResponse = await this.createApp(project, env);
    }
    const url = appResponse.app.live_url || appResponse.app.default_ingress;
    return {
      appId: appResponse.app.id,
      url: url.startsWith('http') ? url : `https://${url}`,
      status: appResponse.app.active_deployment?.phase || 'unknown',
    };
  }

  async getStatus(appId: string): Promise<ProviderAppStatus> {
    const app = await this.getApp(appId);
    const url = app.app.live_url || app.app.default_ingress;
    return {
      appId: app.app.id,
      phase: app.app.active_deployment?.phase || 'unknown',
      url: url ? (url.startsWith('http') ? url : `https://${url}`) : undefined,
    };
  }

  async destroy(appId: string): Promise<void> {
    await this.deleteApp(appId);
  }

  // ── Internal helpers ────────────────────────────────────────────

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${DO_API_BASE}${path}`;
    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`DigitalOcean API error: ${response.status} - ${error}`);
    }

    return response.json() as Promise<T>;
  }

  private projectToAppSpec(project: Project, env: Environment): DOAppSpec {
    const envSuffix = env.name === 'production' ? '' : `-${env.name.slice(0, 3)}`;
    const appName = `${project.slug}${envSuffix}`;

    const spec: DOAppSpec = {
      name: appName,
      region: 'nyc',
    };

    for (const component of project.architecture.components) {
      const safeName = component.name.toLowerCase().replace(/[^a-z0-9-]/g, '-');

      switch (component.type) {
        case 'service':
          spec.services = spec.services || [];
          spec.services.push({
            name: safeName,
            instance_size_slug: 'apps-s-1vcpu-0.5gb',
            instance_count: 1,
            http_port: 8080,
            image: {
              registry_type: 'DOCKER_HUB',
              repository: 'nginx',
              tag: 'alpine',
            },
          });
          break;

        case 'static_site':
          spec.static_sites = spec.static_sites || [];
          spec.static_sites.push({ name: safeName });
          break;

        case 'worker':
          spec.workers = spec.workers || [];
          spec.workers.push({
            name: safeName,
            instance_size_slug: 'apps-s-1vcpu-0.5gb',
            instance_count: 1,
            image: {
              registry_type: 'DOCKER_HUB',
              repository: 'alpine',
              tag: 'latest',
            },
          });
          break;

        case 'job':
          spec.jobs = spec.jobs || [];
          spec.jobs.push({
            name: safeName,
            instance_size_slug: 'apps-s-1vcpu-0.5gb',
            kind: 'PRE_DEPLOY',
          });
          break;

        case 'database':
          spec.databases = spec.databases || [];
          let engine: DODatabase['engine'] = 'PG';
          const nameLower = component.name.toLowerCase();
          if (nameLower.includes('redis')) engine = 'REDIS';
          else if (nameLower.includes('mysql')) engine = 'MYSQL';
          else if (nameLower.includes('mongo')) engine = 'MONGODB';

          spec.databases.push({
            name: safeName,
            engine,
            production: env.name === 'production',
          });
          break;
      }
    }

    return spec;
  }

  private async createApp(project: Project, env: Environment): Promise<DOAppResponse> {
    const spec = this.projectToAppSpec(project, env);
    return this.request<DOAppResponse>('POST', '/apps', { spec });
  }

  private async updateApp(appId: string, project: Project, env: Environment): Promise<DOAppResponse> {
    const spec = this.projectToAppSpec(project, env);
    return this.request<DOAppResponse>('PUT', `/apps/${appId}`, { spec });
  }

  private async getApp(appId: string): Promise<DOAppResponse> {
    return this.request<DOAppResponse>('GET', `/apps/${appId}`);
  }

  private async deleteApp(appId: string): Promise<void> {
    await this.request('DELETE', `/apps/${appId}`);
  }

  async getDeploymentLogs(appId: string, deploymentId: string): Promise<string> {
    const response = await this.request<{ historic_urls: string[] }>(
      'GET',
      `/apps/${appId}/deployments/${deploymentId}/logs`
    );
    if (response.historic_urls?.length) {
      const logs = await fetch(response.historic_urls[0]);
      return logs.text();
    }
    return '';
  }

  async validateToken(): Promise<boolean> {
    try {
      await this.request('GET', '/account');
      return true;
    } catch {
      return false;
    }
  }
}

export const digitalOceanProvider = new DigitalOceanProvider();

// Register with the provider registry
registerProvider(digitalOceanProvider);

// Backward-compatible export
export const digitalOcean = digitalOceanProvider;
