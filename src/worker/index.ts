/**
 * BullMQ Worker Entry Point
 *
 * Consumes jobs from Redis-backed queues and processes them using
 * domain-specific processors. Each queue has its own Worker instance.
 *
 * Usage:
 *   REDIS_URL=redis://localhost:6379 tsx src/worker/index.ts
 */

import { Worker, type Job } from 'bullmq';
import { Redis } from 'ioredis';
import { QUEUE_NAMES } from '../server/queue/index.js';
import { JobEventPublisher } from '../server/queue/events.js';
import { processBACGenerate } from './processors/bac.js';
import { processCodegenGenerate, processCodegenEdit } from './processors/codegen.js';
import { processDeployExecute } from './processors/deploy.js';

// ── Redis connection ────────────────────────────────────────────────────────

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = new Redis(redisUrl, {
  maxRetriesPerRequest: null, // Required by BullMQ
});

// Separate connection for publishing events (pub/sub needs its own conn)
const publisherConn = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
});
const publisher = new JobEventPublisher(publisherConn);

// ── Worker factory ──────────────────────────────────────────────────────────

function createWorker(
  queueName: string,
  handler: (job: Job) => Promise<unknown>
): Worker {
  const worker = new Worker(queueName, handler, {
    connection,
    concurrency: 2,
  });

  worker.on('completed', (job) => {
    console.log(`[${queueName}] Job ${job.id} (${job.name}) completed`);
    publisher.publishCompleted({
      jobId: job.id!,
      jobType: job.name,
      projectId: (job.data as any).projectId,
      userId: (job.data as any).userId,
      result: job.returnvalue,
    });
  });

  worker.on('failed', (job, err) => {
    console.error(`[${queueName}] Job ${job?.id} (${job?.name}) failed:`, err.message);
    if (job) {
      publisher.publishFailed({
        jobId: job.id!,
        jobType: job.name,
        projectId: (job.data as any).projectId,
        userId: (job.data as any).userId,
        error: err.message,
      });
    }
  });

  worker.on('error', (err) => {
    console.error(`[${queueName}] Worker error:`, err.message);
  });

  console.log(`  Worker started for queue: ${queueName}`);
  return worker;
}

// ── Processors ──────────────────────────────────────────────────────────────

const bacWorker = createWorker(QUEUE_NAMES.BAC, async (job) => {
  switch (job.name) {
    case 'bac:generate':
      return processBACGenerate(job, publisher);
    default:
      throw new Error(`Unknown BAC job type: ${job.name}`);
  }
});

const codegenWorker = createWorker(QUEUE_NAMES.CODEGEN, async (job) => {
  switch (job.name) {
    case 'codegen:generate':
      return processCodegenGenerate(job, publisher);
    case 'codegen:edit':
      return processCodegenEdit(job, publisher);
    default:
      throw new Error(`Unknown codegen job type: ${job.name}`);
  }
});

const deployWorker = createWorker(QUEUE_NAMES.DEPLOY, async (job) => {
  switch (job.name) {
    case 'deploy:execute':
      return processDeployExecute(job, publisher);
    default:
      throw new Error(`Unknown deploy job type: ${job.name}`);
  }
});

// ── Graceful shutdown ───────────────────────────────────────────────────────

const workers = [bacWorker, codegenWorker, deployWorker];

async function shutdown() {
  console.log('\nShutting down workers...');
  await Promise.all(workers.map(w => w.close()));
  connection.disconnect();
  publisherConn.disconnect();
  console.log('Workers stopped.');
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

console.log(`
  Brick Worker Process

  Redis: ${redisUrl}
  Queues: ${Object.values(QUEUE_NAMES).join(', ')}

  Waiting for jobs...
`);
