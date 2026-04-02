import 'dotenv/config';
import { createApp } from './api/app';
import { getAllQueues, closeAllQueues } from './queues';
import { logger } from './utils/logger';

const PORT = parseInt(process.env.PORT ?? '3000', 10);

// Initialise queues before starting server
getAllQueues();

const app    = createApp();
const server = app.listen(PORT, () => {
  logger.info(`API server running on port ${PORT}`);
  logger.info(`Bull Board dashboard: http://localhost:${PORT}${process.env.BULL_BOARD_PATH ?? '/admin/queues'}`);
  logger.info('Available endpoints:', {
    endpoints: [
      'POST /jobs           — enqueue a job',
      'POST /jobs/bulk      — bulk enqueue',
      'GET  /jobs/:q/:id    — get job status',
      'POST /jobs/:q/:id/retry — retry failed job',
      'DELETE /jobs/:q/:id  — remove job',
      'GET  /queues         — all queue stats',
      'GET  /queues/:name   — single queue stats',
      'POST /queues/:name/pause  — pause queue',
      'POST /queues/:name/resume — resume queue',
      'POST /queues/:name/drain  — drain waiting jobs',
      'GET  /health         — health check',
    ],
  });
});

const shutdown = async (signal: string) => {
  logger.info(`${signal} — shutting down API server`);
  server.close(async () => {
    await closeAllQueues();
    logger.info('API server stopped');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('uncaughtException',  (err) => { logger.error('Uncaught exception',  { err: err.message }); process.exit(1); });
process.on('unhandledRejection', (err) => { logger.error('Unhandled rejection', { err }); process.exit(1); });
