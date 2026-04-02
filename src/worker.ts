import 'dotenv/config';
import { startWorkers, stopWorkers } from './workers';
import { logger } from './utils/logger';

logger.info('Starting job workers...');
startWorkers();

const shutdown = async (signal: string) => {
  logger.info(`${signal} — gracefully stopping workers`);
  await stopWorkers();
  logger.info('Workers stopped cleanly');
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('uncaughtException',  (err) => { logger.error('Worker uncaught exception',  { err: err.message }); process.exit(1); });
process.on('unhandledRejection', (err) => { logger.error('Worker unhandled rejection', { err }); process.exit(1); });
