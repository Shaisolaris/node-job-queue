import { Worker } from 'bullmq';
import { createRedisConnection } from '../utils/redis';
import { logger } from '../utils/logger';
import { QUEUE_NAMES } from '../types';
import {
  processEmail,
  processReport,
  processWebhook,
  processImage,
  processCleanup,
} from '../processors';

const workers: Worker[] = [];

interface WorkerConfig {
  concurrency?: number;
  limiter?: { max: number; duration: number };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createWorker(queueName: string, processor: (job: any) => Promise<any>, opts: WorkerConfig = {}): Worker {
  const worker = new Worker(queueName, processor, {
    connection:  createRedisConnection(),
    concurrency: opts.concurrency ?? 5,
    limiter:     opts.limiter,
  });

  worker.on('completed', (job, result) => {
    logger.info('Job completed', { queue: queueName, jobId: job.id, name: job.name, durationMs: (result as { durationMs?: number })?.durationMs });
  });

  worker.on('failed', (job, err) => {
    logger.error('Job failed', { queue: queueName, jobId: job?.id, attempt: job?.attemptsMade, error: err.message });
  });

  worker.on('progress', (job, progress) => {
    logger.debug('Job progress', { queue: queueName, jobId: job.id, progress });
  });

  worker.on('error', (err) => {
    logger.error('Worker error', { queue: queueName, err: err.message });
  });

  worker.on('stalled', (jobId) => {
    logger.warn('Job stalled', { queue: queueName, jobId });
  });

  workers.push(worker);
  logger.info('Worker started', { queue: queueName, concurrency: opts.concurrency ?? 5 });
  return worker;
}

export function startWorkers(): void {
  createWorker(QUEUE_NAMES.EMAIL,   processEmail,   { concurrency: parseInt(process.env.EMAIL_CONCURRENCY   ?? '5',  10), limiter: { max: 100, duration: 60_000 } });
  createWorker(QUEUE_NAMES.REPORT,  processReport,  { concurrency: parseInt(process.env.REPORT_CONCURRENCY  ?? '2',  10) });
  createWorker(QUEUE_NAMES.WEBHOOK, processWebhook, { concurrency: parseInt(process.env.WEBHOOK_CONCURRENCY ?? '10', 10), limiter: { max: 500, duration: 60_000 } });
  createWorker(QUEUE_NAMES.IMAGE,   processImage,   { concurrency: parseInt(process.env.IMAGE_CONCURRENCY   ?? '3',  10) });
  createWorker(QUEUE_NAMES.CLEANUP, processCleanup, { concurrency: 1 });
  logger.info('All workers started', { count: workers.length });
}

export async function stopWorkers(): Promise<void> {
  logger.info('Stopping workers...');
  await Promise.all(workers.map((w) => w.close()));
  workers.length = 0;
  logger.info('All workers stopped');
}
