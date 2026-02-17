// Deployment orchestration service

import { db } from '../db/client.js';
import './digitalocean.js'; // Ensure DO provider is registered
import { getDefaultProvider } from './provider-registry.js';
import type { Deployment, Environment, Project } from '../db/schema.js';

class DeploymentService {
  // Calculate monthly cost for a project
  calculateMonthlyCost(project: Project): number {
    return getDefaultProvider().estimateMonthlyCost(project);
  }

  // Start a new deployment
  async startDeployment(
    projectId: string,
    environmentName: Environment['name'],
    userId: string
  ): Promise<Deployment> {
    // Get project
    const project = await db.getProjectById(projectId);
    if (!project) throw new Error('Project not found');
    if (project.userId !== userId) throw new Error('Not authorized');

    // Get environment
    const environments = await db.getEnvironmentsByProjectId(projectId);
    const env = environments.find(e => e.name === environmentName);
    if (!env) throw new Error('Environment not found');

    // Check if already deploying
    if (env.status === 'deploying') {
      throw new Error('Deployment already in progress');
    }

    // Create deployment record
    const deployment = await db.createDeployment(env.id, projectId, userId);

    // Update environment status
    await db.updateEnvironment(env.id, { status: 'deploying' });

    // Start async deployment process
    this.executeDeployment(deployment, project, env).catch(error => {
      console.error('Deployment failed:', error);
    });

    return deployment;
  }

  // Execute the actual deployment (runs async)
  private async executeDeployment(
    deployment: Deployment,
    project: Project,
    env: Environment
  ): Promise<void> {
    try {
      const provider = getDefaultProvider();
      await db.appendDeploymentLog(deployment.id, 'Starting deployment...');
      await db.updateDeployment(deployment.id, { status: 'building' });

      await db.appendDeploymentLog(deployment.id, `Deploying via ${provider.displayName}...`);
      const result = await provider.deploy(project, env);

      const appId = result.appId;
      const url = result.url || '';

      await db.appendDeploymentLog(deployment.id, `App ID: ${appId}`);
      await db.updateDeployment(deployment.id, {
        status: 'deploying',
        doAppId: appId,
      });

      // Poll for deployment completion
      await db.appendDeploymentLog(deployment.id, 'Waiting for deployment to complete...');
      const finalStatus = await this.pollDeploymentStatus(appId, deployment.id);

      if (finalStatus === 'ACTIVE') {
        const monthlyCost = this.calculateMonthlyCost(project);

        await db.updateDeployment(deployment.id, {
          status: 'live',
          url: url.startsWith('http') ? url : `https://${url}`,
          completedAt: new Date(),
        });

        await db.updateEnvironment(env.id, {
          status: 'live',
          doAppId: appId,
          url: url.startsWith('http') ? url : `https://${url}`,
          lastDeployedAt: new Date(),
          monthlyCostCents: monthlyCost,
        });

        await db.appendDeploymentLog(deployment.id, `Deployment complete! URL: ${url}`);
      } else {
        throw new Error(`Deployment failed with status: ${finalStatus}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      await db.appendDeploymentLog(deployment.id, `Error: ${message}`);
      await db.updateDeployment(deployment.id, {
        status: 'failed',
        error: message,
        completedAt: new Date(),
      });
      await db.updateEnvironment(env.id, { status: 'failed' });
    }
  }

  // Poll provider for deployment status
  private async pollDeploymentStatus(
    appId: string,
    deploymentId: string,
    maxAttempts = 60,
    intervalMs = 5000
  ): Promise<string> {
    const provider = getDefaultProvider();
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const status = await provider.getStatus(appId);

        await db.appendDeploymentLog(deploymentId, `Status: ${status.phase}`);

        if (status.phase === 'ACTIVE') return 'ACTIVE';
        if (status.phase === 'ERROR' || status.phase === 'FAILED') return 'FAILED';

        await new Promise(resolve => setTimeout(resolve, intervalMs));
      } catch (error) {
        await db.appendDeploymentLog(deploymentId, `Poll error: ${error}`);
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      }
    }

    return 'TIMEOUT';
  }

  // Get deployment status and logs
  async getDeploymentStatus(deploymentId: string, userId: string): Promise<Deployment | null> {
    const deployment = await db.getDeploymentById(deploymentId);
    if (!deployment || deployment.userId !== userId) return null;
    return deployment;
  }

  // Stop/delete a deployment
  async stopDeployment(
    projectId: string,
    environmentName: Environment['name'],
    userId: string
  ): Promise<void> {
    const project = await db.getProjectById(projectId);
    if (!project || project.userId !== userId) {
      throw new Error('Not authorized');
    }

    const environments = await db.getEnvironmentsByProjectId(projectId);
    const env = environments.find(e => e.name === environmentName);
    if (!env?.doAppId) {
      throw new Error('No active deployment');
    }

    await getDefaultProvider().destroy(env.doAppId);

    await db.updateEnvironment(env.id, {
      status: 'stopped',
      doAppId: undefined,
      url: undefined,
      monthlyCostCents: 0,
    });
  }
}

export const deploymentService = new DeploymentService();
