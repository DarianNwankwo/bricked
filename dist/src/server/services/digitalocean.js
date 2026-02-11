// DigitalOcean API service
// Uses Brick's master account to provision resources for users
const DO_API_BASE = 'https://api.digitalocean.com/v2';
const DO_TOKEN = process.env.BRICK_DO_TOKEN; // Brick's master DO token
class DigitalOceanService {
    token;
    constructor() {
        if (!DO_TOKEN) {
            console.warn('BRICK_DO_TOKEN not set - deployments will fail');
        }
        this.token = DO_TOKEN || '';
    }
    async request(method, path, body) {
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
        return response.json();
    }
    // Convert Brick project to DO App Spec
    projectToAppSpec(project, env) {
        const envSuffix = env.name === 'production' ? '' : `-${env.name.slice(0, 3)}`;
        const appName = `${project.slug}${envSuffix}`;
        const spec = {
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
                    let engine = 'PG';
                    const nameLower = component.name.toLowerCase();
                    if (nameLower.includes('redis'))
                        engine = 'REDIS';
                    else if (nameLower.includes('mysql'))
                        engine = 'MYSQL';
                    else if (nameLower.includes('mongo'))
                        engine = 'MONGODB';
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
    async createApp(project, env) {
        const spec = this.projectToAppSpec(project, env);
        return this.request('POST', '/apps', { spec });
    }
    // Update an existing app
    async updateApp(appId, project, env) {
        const spec = this.projectToAppSpec(project, env);
        return this.request('PUT', `/apps/${appId}`, { spec });
    }
    // Get app details
    async getApp(appId) {
        return this.request('GET', `/apps/${appId}`);
    }
    // Delete an app
    async deleteApp(appId) {
        await this.request('DELETE', `/apps/${appId}`);
    }
    // Get deployment logs
    async getDeploymentLogs(appId, deploymentId) {
        const response = await this.request('GET', `/apps/${appId}/deployments/${deploymentId}/logs`);
        // Fetch actual logs from URLs
        if (response.historic_urls?.length) {
            const logs = await fetch(response.historic_urls[0]);
            return logs.text();
        }
        return '';
    }
    // Check if token is valid
    async validateToken() {
        try {
            await this.request('GET', '/account');
            return true;
        }
        catch {
            return false;
        }
    }
}
export const digitalOcean = new DigitalOceanService();
//# sourceMappingURL=digitalocean.js.map