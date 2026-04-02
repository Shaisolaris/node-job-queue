import { Job } from 'bullmq';
import { jobLogger } from '../utils/logger';
import type {
  EmailJobData, EmailJobResult,
  ReportJobData, ReportJobResult,
  WebhookJobData, WebhookJobResult,
  ImageJobData, JobResult,
  CleanupJobData,
} from '../types';

// ─── Email Processor ──────────────────────────────────────────────────────────

export async function processEmail(job: Job<EmailJobData>): Promise<EmailJobResult> {
  const log   = jobLogger('email', job.id);
  const start = Date.now();
  const { to, subject } = job.data;

  log.info('Processing email job', { to, subject });

  await job.updateProgress(10);

  // Simulate SMTP send (replace with nodemailer / SendGrid / AWS SES)
  const recipients = Array.isArray(to) ? to : [to];
  await simulateDelay(200 + recipients.length * 50);

  await job.updateProgress(80);

  // Simulate occasional failure for retry demonstration
  if (Math.random() < 0.05 && job.attemptsMade < 2) {
    throw new Error('SMTP connection timeout — will retry');
  }

  await job.updateProgress(100);

  const result: EmailJobResult = {
    success:      true,
    processedAt:  new Date().toISOString(),
    durationMs:   Date.now() - start,
    messageId:    `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    accepted:     recipients,
    rejected:     [],
  };

  log.info('Email sent', { messageId: result.messageId, recipients: recipients.length });
  return result;
}

// ─── Report Processor ─────────────────────────────────────────────────────────

export async function processReport(job: Job<ReportJobData>): Promise<ReportJobResult> {
  const log   = jobLogger('report', job.id);
  const start = Date.now();
  const { reportType, format, dateFrom, dateTo, recipientEmail } = job.data;

  log.info('Generating report', { reportType, format, dateFrom, dateTo });

  // Phase 1: Query data
  await job.updateProgress(20);
  await simulateDelay(500);

  // Phase 2: Generate report
  await job.updateProgress(50);
  await simulateDelay(800);

  // Phase 3: Upload / store
  await job.updateProgress(80);
  await simulateDelay(200);

  // Phase 4: Send email notification
  await job.updateProgress(95);
  await simulateDelay(100);

  await job.updateProgress(100);

  const rowCount = Math.floor(Math.random() * 10000) + 100;
  const reportUrl = `https://reports.example.com/${reportType}-${Date.now()}.${format}`;

  const result: ReportJobResult = {
    success:       true,
    processedAt:   new Date().toISOString(),
    durationMs:    Date.now() - start,
    reportUrl,
    rowCount,
    fileSizeBytes: rowCount * 120,
    output:        { sentTo: recipientEmail, format, reportType },
  };

  log.info('Report generated', { reportUrl, rowCount });
  return result;
}

// ─── Webhook Processor ────────────────────────────────────────────────────────

export async function processWebhook(job: Job<WebhookJobData>): Promise<WebhookJobResult> {
  const log   = jobLogger('webhook', job.id);
  const start = Date.now();
  const { url, method, payload, headers, eventType, sourceId } = job.data;

  log.info('Delivering webhook', { url, eventType, attempt: job.attemptsMade + 1 });

  await job.updateProgress(30);

  // Simulate HTTP delivery
  await simulateDelay(150 + Math.random() * 200);

  // Simulate occasional endpoint failures (triggers retry)
  const shouldFail = Math.random() < 0.1 && job.attemptsMade < 2;
  const statusCode = shouldFail ? 500 : 200;

  if (shouldFail) {
    throw new Error(`Webhook endpoint returned ${statusCode} — retrying`);
  }

  await job.updateProgress(100);

  const result: WebhookJobResult = {
    success:      true,
    processedAt:  new Date().toISOString(),
    durationMs:   Date.now() - start,
    statusCode,
    responseBody: '{"received":true}',
    attempt:      job.attemptsMade + 1,
    output:       { url, eventType, sourceId },
  };

  log.info('Webhook delivered', { url, statusCode, eventType });
  return result;
}

// ─── Image Processor ──────────────────────────────────────────────────────────

export async function processImage(job: Job<ImageJobData>): Promise<JobResult> {
  const log   = jobLogger('image', job.id);
  const start = Date.now();
  const { sourceUrl, operations, outputKey } = job.data;

  log.info('Processing image', { sourceUrl, operations: operations.length });

  const totalOps = operations.length;
  for (let i = 0; i < totalOps; i++) {
    const op = operations[i];
    log.debug('Applying operation', { op });

    // Simulate operation time based on type
    const delay = op.type === 'resize' ? 300 : op.type === 'compress' ? 400 : 150;
    await simulateDelay(delay);

    await job.updateProgress(Math.round(((i + 1) / totalOps) * 90));
  }

  // Simulate upload
  await simulateDelay(200);
  await job.updateProgress(100);

  const result: JobResult = {
    success:     true,
    processedAt: new Date().toISOString(),
    durationMs:  Date.now() - start,
    output:      {
      outputKey,
      outputUrl:  `https://cdn.example.com/${outputKey}`,
      operations: totalOps,
    },
  };

  log.info('Image processed', { outputKey, operations: totalOps });
  return result;
}

// ─── Cleanup Processor ────────────────────────────────────────────────────────

export async function processCleanup(job: Job<CleanupJobData>): Promise<JobResult> {
  const log   = jobLogger('cleanup', job.id);
  const start = Date.now();
  const { target, olderThanDays, dryRun } = job.data;

  log.info('Running cleanup', { target, olderThanDays, dryRun });

  await job.updateProgress(10);

  // Simulate scanning
  await simulateDelay(300);
  const itemsFound = Math.floor(Math.random() * 500) + 10;
  await job.updateProgress(50);

  if (!dryRun) {
    await simulateDelay(itemsFound * 2); // simulate deletion
  }

  await job.updateProgress(100);

  const result: JobResult = {
    success:     true,
    processedAt: new Date().toISOString(),
    durationMs:  Date.now() - start,
    output:      {
      target,
      olderThanDays,
      itemsFound,
      itemsDeleted: dryRun ? 0 : itemsFound,
      dryRun:       !!dryRun,
    },
  };

  log.info('Cleanup complete', { target, itemsFound, dryRun });
  return result;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function simulateDelay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
