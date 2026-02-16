/**
 * Redis pub/sub event bus for job progress streaming
 *
 * The worker publishes progress events via Redis pub/sub.
 * The web server subscribes and forwards them to clients over SSE/WebSocket.
 */

import { Redis } from 'ioredis';

// ── Event types ─────────────────────────────────────────────────────────────

export interface JobProgressEvent {
  jobId: string;
  jobType: string;
  projectId: string;
  userId: string;
  progress: number;       // 0-100
  stage: string;          // human-readable stage label
  data?: unknown;         // optional partial result data
}

export interface JobCompletedEvent {
  jobId: string;
  jobType: string;
  projectId: string;
  userId: string;
  result: unknown;
}

export interface JobFailedEvent {
  jobId: string;
  jobType: string;
  projectId: string;
  userId: string;
  error: string;
}

export type JobEvent =
  | { type: 'progress'; payload: JobProgressEvent }
  | { type: 'completed'; payload: JobCompletedEvent }
  | { type: 'failed'; payload: JobFailedEvent };

// ── Channel names ───────────────────────────────────────────────────────────

const CHANNEL_PREFIX = 'brick:jobs:';

export function projectChannel(projectId: string): string {
  return `${CHANNEL_PREFIX}${projectId}`;
}

export function userChannel(userId: string): string {
  return `${CHANNEL_PREFIX}user:${userId}`;
}

// ── Publisher (used by worker) ──────────────────────────────────────────────

export class JobEventPublisher {
  constructor(private redis: Redis) {}

  async publishProgress(event: JobProgressEvent): Promise<void> {
    const message: JobEvent = { type: 'progress', payload: event };
    const json = JSON.stringify(message);
    await Promise.all([
      this.redis.publish(projectChannel(event.projectId), json),
      this.redis.publish(userChannel(event.userId), json),
    ]);
  }

  async publishCompleted(event: JobCompletedEvent): Promise<void> {
    const message: JobEvent = { type: 'completed', payload: event };
    const json = JSON.stringify(message);
    await Promise.all([
      this.redis.publish(projectChannel(event.projectId), json),
      this.redis.publish(userChannel(event.userId), json),
    ]);
  }

  async publishFailed(event: JobFailedEvent): Promise<void> {
    const message: JobEvent = { type: 'failed', payload: event };
    const json = JSON.stringify(message);
    await Promise.all([
      this.redis.publish(projectChannel(event.projectId), json),
      this.redis.publish(userChannel(event.userId), json),
    ]);
  }
}

// ── Subscriber (used by web server) ─────────────────────────────────────────

export type JobEventHandler = (event: JobEvent) => void;

export class JobEventSubscriber {
  private subscriber: Redis;
  private handlers = new Map<string, Set<JobEventHandler>>();

  constructor(redisUrl: string) {
    // Subscriber needs its own connection (Redis pub/sub requirement)
    this.subscriber = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
    });

    this.subscriber.on('message', (channel: string, message: string) => {
      const channelHandlers = this.handlers.get(channel);
      if (!channelHandlers || channelHandlers.size === 0) return;

      try {
        const event = JSON.parse(message) as JobEvent;
        for (const handler of channelHandlers) {
          handler(event);
        }
      } catch {
        // Ignore malformed messages
      }
    });
  }

  /** Subscribe to events for a specific project */
  async subscribeProject(projectId: string, handler: JobEventHandler): Promise<() => void> {
    const channel = projectChannel(projectId);
    return this.subscribe(channel, handler);
  }

  /** Subscribe to events for a specific user */
  async subscribeUser(userId: string, handler: JobEventHandler): Promise<() => void> {
    const channel = userChannel(userId);
    return this.subscribe(channel, handler);
  }

  private async subscribe(channel: string, handler: JobEventHandler): Promise<() => void> {
    if (!this.handlers.has(channel)) {
      this.handlers.set(channel, new Set());
      await this.subscriber.subscribe(channel);
    }
    this.handlers.get(channel)!.add(handler);

    // Return unsubscribe function
    return async () => {
      const handlers = this.handlers.get(channel);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.handlers.delete(channel);
          await this.subscriber.unsubscribe(channel);
        }
      }
    };
  }

  async close(): Promise<void> {
    this.subscriber.disconnect();
  }
}

// ── Singleton subscriber for the web server ─────────────────────────────────

let subscriberInstance: JobEventSubscriber | null = null;

export function getJobEventSubscriber(): JobEventSubscriber | null {
  if (!process.env.REDIS_URL) return null;

  if (!subscriberInstance) {
    subscriberInstance = new JobEventSubscriber(process.env.REDIS_URL);
  }
  return subscriberInstance;
}
