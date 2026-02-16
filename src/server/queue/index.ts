/**
 * Queue client — BullMQ job dispatch helpers
 *
 * Dispatches long-running agent work to the worker process via Redis-backed queues.
 * Each job type maps to a named queue with its own processor on the worker side.
 */

import { Queue, type JobsOptions } from 'bullmq';
import { Redis } from 'ioredis';

// ── Job type definitions ────────────────────────────────────────────────────

export interface BACGenerateJobData {
  projectId: string;
  userId: string;
  description: string;
  existingBAC?: unknown;
  model?: string;
}

export interface CodegenGenerateJobData {
  projectId: string;
  userId: string;
  bac: unknown;
  componentSpecs?: Record<string, unknown>;
  model?: string;
}

export interface CodegenEditJobData {
  projectId: string;
  userId: string;
  filePath: string;
  editRequest: string;
  existingContent: string;
  bac?: unknown;
  model?: string;
}

export interface DeployJobData {
  projectId: string;
  userId: string;
  environmentName: 'development' | 'staging' | 'production';
}

export interface DocsGenerateJobData {
  projectId: string;
  userId: string;
  bac?: unknown;
  existingDocs?: string;
  model?: string;
}

export type JobData =
  | BACGenerateJobData
  | CodegenGenerateJobData
  | CodegenEditJobData
  | DeployJobData
  | DocsGenerateJobData;

// ── Queue names ─────────────────────────────────────────────────────────────

export const QUEUE_NAMES = {
  BAC: 'bac',
  CODEGEN: 'codegen',
  DEPLOY: 'deploy',
  DOCS: 'docs',
} as const;

// ── Queue manager ───────────────────────────────────────────────────────────

let queues: Map<string, Queue> | null = null;
let redisConnection: Redis | null = null;

function getRedisUrl(): string {
  return process.env.REDIS_URL || 'redis://localhost:6379';
}

export function getRedisConnection(): Redis {
  if (redisConnection) return redisConnection;

  redisConnection = new Redis(getRedisUrl(), {
    maxRetriesPerRequest: null, // Required by BullMQ
  });
  return redisConnection;
}

function getQueue(name: string): Queue {
  if (!queues) {
    queues = new Map();
  }

  let queue = queues.get(name);
  if (!queue) {
    queue = new Queue(name, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
        attempts: 1,
      },
    });
    queues.set(name, queue);
  }
  return queue;
}

// ── Dispatch helpers ────────────────────────────────────────────────────────

const defaultOpts: JobsOptions = {
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 50 },
};

export async function dispatchBACGenerate(data: BACGenerateJobData, opts?: JobsOptions) {
  const queue = getQueue(QUEUE_NAMES.BAC);
  return queue.add('bac:generate', data, { ...defaultOpts, ...opts });
}

export async function dispatchCodegenGenerate(data: CodegenGenerateJobData, opts?: JobsOptions) {
  const queue = getQueue(QUEUE_NAMES.CODEGEN);
  return queue.add('codegen:generate', data, { ...defaultOpts, ...opts });
}

export async function dispatchCodegenEdit(data: CodegenEditJobData, opts?: JobsOptions) {
  const queue = getQueue(QUEUE_NAMES.CODEGEN);
  return queue.add('codegen:edit', data, { ...defaultOpts, ...opts });
}

export async function dispatchDeploy(data: DeployJobData, opts?: JobsOptions) {
  const queue = getQueue(QUEUE_NAMES.DEPLOY);
  return queue.add('deploy:execute', data, { ...defaultOpts, ...opts });
}

export async function dispatchDocsGenerate(data: DocsGenerateJobData, opts?: JobsOptions) {
  const queue = getQueue(QUEUE_NAMES.DOCS);
  return queue.add('docs:generate', data, { ...defaultOpts, ...opts });
}

// ── Queue status ────────────────────────────────────────────────────────────

export async function getQueueStats() {
  const stats: Record<string, { waiting: number; active: number; completed: number; failed: number }> = {};

  for (const name of Object.values(QUEUE_NAMES)) {
    const queue = getQueue(name);
    const [waiting, active, completed, failed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
    ]);
    stats[name] = { waiting, active, completed, failed };
  }

  return stats;
}

// ── Cleanup ─────────────────────────────────────────────────────────────────

export async function closeQueues(): Promise<void> {
  if (queues) {
    await Promise.all(Array.from(queues.values()).map(q => q.close()));
    queues = null;
  }
  if (redisConnection) {
    redisConnection.disconnect();
    redisConnection = null;
  }
}

// ── Feature detection ───────────────────────────────────────────────────────

/** Returns true if REDIS_URL is configured and queue mode should be used */
export function isQueueEnabled(): boolean {
  return !!process.env.REDIS_URL;
}
