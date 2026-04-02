import winston from 'winston';

const { combine, timestamp, errors, json, colorize, simple } = winston.format;

const isProduction = process.env.NODE_ENV === 'production';

export const logger = winston.createLogger({
  level: isProduction ? 'info' : 'debug',
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    json()
  ),
  defaultMeta: { service: 'job-queue' },
  transports: [
    new winston.transports.Console({
      format: isProduction
        ? json()
        : combine(colorize(), simple()),
    }),
  ],
});

export function jobLogger(queueName: string, jobId: string | undefined) {
  return logger.child({ queue: queueName, jobId });
}
