/**
 * BAC generation/compilation job processor
 *
 * Takes a project description + existing BAC, reasons about architecture,
 * and produces a new or updated BrickAppContract.
 */

import type { Job } from 'bullmq';
import type { BACGenerateJobData } from '../../server/queue/index.js';
import type { JobEventPublisher } from '../../server/queue/events.js';
import { deriveBrickAppContract, type DeriveBACParams } from '../../bac/derive.js';
import type { BrickAppContract } from '../../types/bac.js';

export async function processBACGenerate(
  job: Job<BACGenerateJobData>,
  publisher: JobEventPublisher
): Promise<unknown> {
  const { projectId, userId, description, existingBAC } = job.data;

  const emitProgress = (progress: number, stage: string, data?: unknown) =>
    publisher.publishProgress({
      jobId: job.id!,
      jobType: 'bac:generate',
      projectId,
      userId,
      progress,
      stage,
      data,
    });

  await emitProgress(10, 'Analyzing project description');

  await emitProgress(30, 'Generating BAC from description');

  const params: DeriveBACParams = {
    appName: description.split(/\s+/).slice(0, 3).join(' '),
    intent: description,
    components: [],
    existing: (existingBAC as BrickAppContract) || null,
  };

  const bac = deriveBrickAppContract(params);

  await emitProgress(90, 'BAC generation complete');

  return bac;
}
