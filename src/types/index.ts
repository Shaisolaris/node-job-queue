// ─── Job payload types ───────────────────────────────────────────────────────

export interface EmailJobData {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
  attachments?: Array<{ filename: string; content: string; encoding: 'base64' }>;
  templateId?: string;
  templateVars?: Record<string, unknown>;
}

export interface ReportJobData {
  reportType: 'sales' | 'inventory' | 'users' | 'custom';
  format: 'pdf' | 'csv' | 'xlsx';
  dateFrom: string;
  dateTo: string;
  filters?: Record<string, unknown>;
  recipientEmail: string;
  requestedBy: string;
}

export interface WebhookJobData {
  url: string;
  method: 'POST' | 'PUT' | 'PATCH';
  payload: Record<string, unknown>;
  headers?: Record<string, string>;
  secret?: string;
  eventType: string;
  sourceId: string;
}

export interface ImageJobData {
  sourceUrl: string;
  operations: ImageOperation[];
  outputKey: string;
  webhookUrl?: string;
}

export type ImageOperation =
  | { type: 'resize'; width: number; height: number; fit?: 'cover' | 'contain' | 'fill' }
  | { type: 'compress'; quality: number }
  | { type: 'convert'; format: 'jpeg' | 'png' | 'webp' }
  | { type: 'watermark'; text: string; position: 'center' | 'bottom-right' };

export interface CleanupJobData {
  target: 'temp-files' | 'expired-sessions' | 'old-logs' | 'orphaned-records';
  olderThanDays: number;
  dryRun?: boolean;
}

export type AllJobData =
  | EmailJobData
  | ReportJobData
  | WebhookJobData
  | ImageJobData
  | CleanupJobData;

// ─── Queue names ─────────────────────────────────────────────────────────────

export const QUEUE_NAMES = {
  EMAIL:   'email',
  REPORT:  'report',
  WEBHOOK: 'webhook',
  IMAGE:   'image',
  CLEANUP: 'cleanup',
} as const;

export type QueueName = typeof QUEUE_NAMES[keyof typeof QUEUE_NAMES];

// ─── Job result types ─────────────────────────────────────────────────────────

export interface JobResult {
  success: boolean;
  processedAt: string;
  durationMs: number;
  output?: Record<string, unknown>;
  error?: string;
}

export interface EmailJobResult extends JobResult {
  messageId?: string;
  accepted: string[];
  rejected: string[];
}

export interface ReportJobResult extends JobResult {
  reportUrl?: string;
  rowCount?: number;
  fileSizeBytes?: number;
}

export interface WebhookJobResult extends JobResult {
  statusCode?: number;
  responseBody?: string;
  attempt: number;
}

// ─── API types ────────────────────────────────────────────────────────────────

export interface EnqueueRequest {
  queue: QueueName;
  data: AllJobData;
  options?: JobOptions;
}

export interface JobOptions {
  priority?: number;       // 1 (highest) to 2_147_483_647 (lowest)
  delay?: number;          // ms delay before processing
  attempts?: number;       // max retry attempts
  backoff?: BackoffOptions;
  removeOnComplete?: number | boolean;
  removeOnFail?: number | boolean;
  jobId?: string;
  repeat?: RepeatOptions;
}

export interface BackoffOptions {
  type: 'fixed' | 'exponential';
  delay: number;
}

export interface RepeatOptions {
  cron?: string;
  every?: number;          // ms interval
  limit?: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: Record<string, unknown>;
}
