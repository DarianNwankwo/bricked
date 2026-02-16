/**
 * Deployment job processor
 *
 * Handles deploying a project to DigitalOcean App Platform.
 * Wraps the existing DeploymentService with progress reporting.
 */

import type { Job } from 'bullmq';
import type { DeployJobData } from '../../server/queue/index.js';
import type { JobEventPublisher } from '../../server/queue/events.js';
import { deploymentService } from '../../server/services/deployment.js';

export async function processDeployExecute(
  job: Job<DeployJobData>,
  publisher: JobEventPublisher
): Promise<{ deploymentId: string }> {
  const { projectId, userId, environmentName } = job.data;

  const emitProgress = (progress: number, stage: string, data?: unknown) =>
    publisher.publishProgress({
      jobId: job.id!,
      jobType: 'deploy:execute',
      projectId,
      userId,
      progress,
      stage,
      data,
    });

  await emitProgress(10, 'Starting deployment');

  const deployment = await deploymentService.startDeployment(
    projectId,
    environmentName,
    userId
  );

  await emitProgress(50, 'Deployment initiated', { deploymentId: deployment.id });

  // Note: The actual deployment is async within DeploymentService.
  // The worker just kicks it off and returns the deployment ID.
  // Deployment status polling happens via the existing /api/deployments/:id endpoint.

  return { deploymentId: deployment.id };
}
