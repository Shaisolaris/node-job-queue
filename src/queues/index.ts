import { Queue, QueueOptions } from 'bullmq';
import { createRedisConnection } from '../utils/redis';
import { logger } from '../utils/logger';
import { QUEUE_NAMES, QueueName, AllJobData } from '../types';

const DEFAULT_JOB_OPTIONS = {
  attempts: parseInt(process.env.DEFAULT_JOB_ATTEMPTS ?? '3', 10),
  backoff: {
    type:  'exponential' as const,
    delay: parseInt(process.env.DEFAULT_JOB_BACKOFF_DELAY ?? '5000', 10),
  },
  removeOnComplete: { count: 100 },
  removeOnFail:     { count: 500 },
};

const queues = new Map<QueueName, Queue>();

export function getQueue(name: QueueName): Queue<AllJobData> {
  if (queues.has(name)) return queues.get(name)!;

  const opts: QueueOptions = {
    connection:     createRedisConnection(),
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  };

  const queue = new Queue<AllJobData>(name, opts);

  queue.on('error', (err) => {
    logger.error(`Queue ${name} error`, { err: err.message });
  });

  queues.set(name, queue);
  logger.info(`Queue created: ${name}`);
  return queue;
}

export function getAllQueues(): Queue[] {
  return Object.values(QUEUE_NAMES).map(getQueue);
}

export async function closeAllQueues(): Promise<void> {
  await Promise.all([...queues.values()].map((q) => q.close()));
  queues.clear();
}
