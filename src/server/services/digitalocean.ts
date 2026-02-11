// DigitalOcean API service
// Uses Brick's master account to provision resources for users

import type { Project, Environment } from '../db/schema.js';

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

class DigitalOceanService {
  private token: string;

  constructor() {
    if (!DO_TOKEN) {
      console.warn('BRICK_DO_TOKEN not set - deployments will fail');
    }
    this.token = DO_TOKEN || '';
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
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

  // Convert Brick project to DO App Spec
  projectToAppSpec(project: Project, env: Environment): DOAppSpec {
    const envSuffix = env.name === 'production' ? '' : `-${env.name.slice(0, 3)}`;
    const appName = `${project.slug}${envSuffix}`;

    const spec: DOAppSpec = {
      name: appName,
      region: 'nyc', // Default to NYC, could be user preference
    };

    // Convert components to DO spec
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
            // For MVP, use a placeholder image - real impl would use user's code
            image: {
              registry_type: 'DOCKER_HUB',
              repository: 'nginx',
              tag: 'alpine',
            },
          });
          break;

        case 'static_site':
          spec.static_sites = spec.static_sites || [];
          spec.static_sites.push({
            name: safeName,
            // Would need user's git repo
          });
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
          // Infer engine from name
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

  // Create a new app
  async createApp(project: Project, env: Environment): Promise<DOAppResponse> {
    const spec = this.projectToAppSpec(project, env);
    return this.request<DOAppResponse>('POST', '/apps', { spec });
  }

  // Update an existing app
  async updateApp(appId: string, project: Project, env: Environment): Promise<DOAppResponse> {
    const spec = this.projectToAppSpec(project, env);
    return this.request<DOAppResponse>('PUT', `/apps/${appId}`, { spec });
  }

  // Get app details
  async getApp(appId: string): Promise<DOAppResponse> {
    return this.request<DOAppResponse>('GET', `/apps/${appId}`);
  }

  // Delete an app
  async deleteApp(appId: string): Promise<void> {
    await this.request('DELETE', `/apps/${appId}`);
  }

  // Get deployment logs
  async getDeploymentLogs(appId: string, deploymentId: string): Promise<string> {
    const response = await this.request<{ historic_urls: string[] }>(
      'GET',
      `/apps/${appId}/deployments/${deploymentId}/logs`
    );
    // Fetch actual logs from URLs
    if (response.historic_urls?.length) {
      const logs = await fetch(response.historic_urls[0]);
      return logs.text();
    }
    return '';
  }

  // Check if token is valid
  async validateToken(): Promise<boolean> {
    try {
      await this.request('GET', '/account');
      return true;
    } catch {
      return false;
    }
  }
}

export const digitalOcean = new DigitalOceanService();
