import IORedis from 'ioredis';
import { logger } from '../utils/logger';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

// BullMQ requires a separate connection per queue/worker
export function createRedisConnection(): IORedis {
  const conn = new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null, // required by BullMQ
    enableReadyCheck:     false,
    lazyConnect:          true,
  });

  conn.on('connect',    () => logger.info('Redis connected'));
  conn.on('error',      (err) => logger.error('Redis error', { err: err.message }));
  conn.on('reconnecting', () => logger.warn('Redis reconnecting...'));

  return conn;
}

// Shared connection for status checks only (NOT for BullMQ)
let _statusConn: IORedis | null = null;

export function getStatusConnection(): IORedis {
  if (!_statusConn) {
    _statusConn = new IORedis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect:          true,
    });
  }
  return _statusConn;
}

export async function checkRedisHealth(): Promise<boolean> {
  try {
    const conn = getStatusConnection();
    await conn.ping();
    return true;
  } catch {
    return false;
  }
}
