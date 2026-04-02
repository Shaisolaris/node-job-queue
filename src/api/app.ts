import express, { Request, Response, NextFunction } from 'express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { z } from 'zod';
import { getAllQueues, getQueue } from '../queues';
import { checkRedisHealth } from '../utils/redis';
import { logger } from '../utils/logger';
import { QUEUE_NAMES } from '../types';

const enqueueSchema = z.object({
  queue: z.enum([QUEUE_NAMES.EMAIL, QUEUE_NAMES.REPORT, QUEUE_NAMES.WEBHOOK, QUEUE_NAMES.IMAGE, QUEUE_NAMES.CLEANUP]),
  data:    z.record(z.string(), z.unknown()),
  options: z.object({
    priority:         z.number().int().min(1).optional(),
    delay:            z.number().min(0).optional(),
    attempts:         z.number().int().min(1).max(20).optional(),
    jobId:            z.string().optional(),
    removeOnComplete: z.union([z.number(), z.boolean()]).optional(),
    removeOnFail:     z.union([z.number(), z.boolean()]).optional(),
    repeat: z.object({ cron: z.string().optional(), every: z.number().optional(), limit: z.number().optional() }).optional(),
  }).optional(),
  name: z.string().optional(),
});

export function createApp(): express.Application {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Bull Board
  const serverAdapter = new ExpressAdapter();
  const boardPath = process.env.BULL_BOARD_PATH ?? '/admin/queues';
  serverAdapter.setBasePath(boardPath);
  createBullBoard({ queues: getAllQueues().map((q) => new BullMQAdapter(q)), serverAdapter });
  app.use(boardPath, serverAdapter.getRouter());

  // Health
  app.get('/health', async (_req, res) => {
    const redisOk = await checkRedisHealth();
    res.status(redisOk ? 200 : 503).json({ status: redisOk ? 'ok' : 'degraded', redis: redisOk ? 'connected' : 'disconnected', timestamp: new Date().toISOString(), uptime: process.uptime() });
  });

  // Enqueue
  app.post('/jobs', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body  = enqueueSchema.parse(req.body);
      const queue = getQueue(body.queue);
      const job   = await queue.add(body.name ?? body.queue, body.data as never, body.options);
      res.status(201).json({ success: true, data: { id: job.id, name: job.name, queue: body.queue, status: 'queued', createdAt: new Date().toISOString() } });
    } catch (err) { next(err); }
  });

  // Bulk enqueue
  app.post('/jobs/bulk', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { queue: queueName, jobs } = req.body as { queue: string; jobs: Array<{ name?: string; data: Record<string, unknown>; opts?: Record<string, unknown> }> };
      if (!queueName || !Array.isArray(jobs) || jobs.length === 0) return res.status(400).json({ success: false, error: 'queue and jobs[] required' });
      const queue = getQueue(queueName as never);
      const added = await queue.addBulk(jobs.map((j) => ({ name: j.name ?? queueName, data: j.data as never, opts: j.opts })));
      res.status(201).json({ success: true, data: { queued: added.length, ids: added.map((j) => j.id) } });
    } catch (err) { next(err); }
  });

  // Get job
  app.get('/jobs/:queue/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const queue = getQueue(req.params['queue'] as never);
      const job   = await queue.getJob(req.params["id"] as string);
      if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
      const state = await job.getState();
      res.json({ success: true, data: { id: job.id, name: job.name, queue: req.params['queue'], state, progress: job.progress, data: job.data, attemptsMade: job.attemptsMade, processedOn: job.processedOn, finishedOn: job.finishedOn, returnvalue: job.returnvalue, failedReason: job.failedReason, timestamp: job.timestamp } });
    } catch (err) { next(err); }
  });

  // All queue stats
  app.get('/queues', async (_req, res, next) => {
    try {
      const stats = await Promise.all(getAllQueues().map(async (q) => {
        const [waiting, active, completed, failed, delayed] = await Promise.all([q.getWaitingCount(), q.getActiveCount(), q.getCompletedCount(), q.getFailedCount(), q.getDelayedCount()]);
        return { name: q.name, waiting, active, completed, failed, delayed };
      }));
      res.json({ success: true, data: stats });
    } catch (err) { next(err); }
  });

  // Single queue stats
  app.get('/queues/:name', async (req, res, next) => {
    try {
      const queue = getQueue(req.params['name'] as never);
      const [waiting, active, completed, failed, delayed, jobs] = await Promise.all([
        queue.getWaitingCount(), queue.getActiveCount(), queue.getCompletedCount(),
        queue.getFailedCount(), queue.getDelayedCount(),
        queue.getJobs(['waiting', 'active', 'failed', 'delayed'], 0, 20),
      ]);
      res.json({ success: true, data: { name: queue.name, counts: { waiting, active, completed, failed, delayed }, recentJobs: jobs.map((j) => ({ id: j.id, name: j.name, progress: j.progress, attemptsMade: j.attemptsMade, timestamp: j.timestamp })) } });
    } catch (err) { next(err); }
  });

  // Retry
  app.post('/jobs/:queue/:id/retry', async (req, res, next) => {
    try {
      const queue = getQueue(req.params['queue'] as never);
      const job   = await queue.getJob(req.params["id"] as string);
      if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
      await job.retry('failed');
      res.json({ success: true, data: { id: job.id, status: 'retrying' } });
    } catch (err) { next(err); }
  });

  // Remove
  app.delete('/jobs/:queue/:id', async (req, res, next) => {
    try {
      const queue = getQueue(req.params['queue'] as never);
      const job   = await queue.getJob(req.params["id"] as string);
      if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
      await job.remove();
      res.json({ success: true, data: { removed: req.params['id'] } });
    } catch (err) { next(err); }
  });

  // Drain
  app.post('/queues/:name/drain', async (req, res, next) => {
    try { await getQueue(req.params['name'] as never).drain(); res.json({ success: true, data: { drained: req.params['name'] } }); }
    catch (err) { next(err); }
  });

  // Pause
  app.post('/queues/:name/pause', async (req, res, next) => {
    try { await getQueue(req.params['name'] as never).pause(); res.json({ success: true, data: { paused: req.params['name'] } }); }
    catch (err) { next(err); }
  });

  // Resume
  app.post('/queues/:name/resume', async (req, res, next) => {
    try { await getQueue(req.params['name'] as never).resume(); res.json({ success: true, data: { resumed: req.params['name'] } }); }
    catch (err) { next(err); }
  });

  // Error handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    if (err.name === 'ZodError') return res.status(400).json({ success: false, error: 'Validation failed', details: err });
    logger.error('Unhandled error', { err: err.message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  });

  app.use((_req, res) => res.status(404).json({ success: false, error: 'Not found' }));
  return app;
}
