# Node.js Job Queue System

Production-ready job queue built with **BullMQ**, **Redis**, and **TypeScript**. Five specialized queues with typed processors, configurable concurrency, rate limiting, exponential backoff retries, and a live Bull Board dashboard.

## Architecture

```
src/
├── server.ts              # API server entry — enqueue and inspect jobs
├── worker.ts              # Worker entry — process jobs (run separately)
├── api/
│   └── app.ts             # Express API — enqueue, status, queue ops, Bull Board
├── queues/
│   └── index.ts           # Queue factory — typed BullMQ queues with shared defaults
├── workers/
│   └── index.ts           # Worker factory — per-queue concurrency + rate limits
├── processors/
│   └── index.ts           # Job processors — email, report, webhook, image, cleanup
├── utils/
│   ├── redis.ts           # Redis connection factory (BullMQ requires per-queue connections)
│   └── logger.ts          # Winston structured logging
└── types/
    └── index.ts           # Typed job payloads, results, queue names
```

## Queues

| Queue | Concurrency | Rate Limit | Use Case |
|-------|-------------|------------|----------|
| `email` | 5 | 100/min | Transactional emails, newsletters |
| `report` | 2 | — | PDF/CSV/XLSX report generation |
| `webhook` | 10 | 500/min | Outbound webhook delivery |
| `image` | 3 | — | Resize, compress, convert, watermark |
| `cleanup` | 1 | — | Scheduled maintenance tasks |

All queues: 3 retry attempts, exponential backoff (5s base), keep last 100 completed / 500 failed.

## API Endpoints

### Jobs
| Method | Path | Description |
|--------|------|-------------|
| POST | `/jobs` | Enqueue a single job |
| POST | `/jobs/bulk` | Bulk enqueue (same queue) |
| GET | `/jobs/:queue/:id` | Job status, progress, result |
| POST | `/jobs/:queue/:id/retry` | Retry a failed job |
| DELETE | `/jobs/:queue/:id` | Remove a job |

### Queues
| Method | Path | Description |
|--------|------|-------------|
| GET | `/queues` | All queue counts |
| GET | `/queues/:name` | Single queue + recent jobs |
| POST | `/queues/:name/pause` | Pause processing |
| POST | `/queues/:name/resume` | Resume processing |
| POST | `/queues/:name/drain` | Remove all waiting jobs |

### System
| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Redis status, uptime |
| GET | `/admin/queues` | **Bull Board UI dashboard** |

## Job Payloads

### Email
```json
{
  "queue": "email",
  "data": {
    "to": "user@example.com",
    "subject": "Welcome!",
    "html": "<h1>Hello</h1>",
    "text": "Hello"
  },
  "options": { "priority": 1, "attempts": 5 }
}
```

### Report
```json
{
  "queue": "report",
  "data": {
    "reportType": "sales",
    "format": "pdf",
    "dateFrom": "2024-01-01",
    "dateTo": "2024-12-31",
    "recipientEmail": "manager@example.com",
    "requestedBy": "user-123"
  }
}
```

### Webhook
```json
{
  "queue": "webhook",
  "data": {
    "url": "https://api.partner.com/events",
    "method": "POST",
    "payload": { "event": "order.created", "orderId": "123" },
    "eventType": "order.created",
    "sourceId": "order-123"
  }
}
```

### Scheduled (Cron)
```json
{
  "queue": "cleanup",
  "data": { "target": "temp-files", "olderThanDays": 7 },
  "options": {
    "repeat": { "cron": "0 2 * * *" }
  }
}
```

## Setup

```bash
# Install dependencies
npm install

# Copy env
cp .env.example .env

# Start Redis
docker run -d -p 6379:6379 redis:7-alpine

# Terminal 1 — API server
npm run dev

# Terminal 2 — Workers
npm run worker

# Open Bull Board dashboard
open http://localhost:3000/admin/queues
```

## Key Design Decisions

**Separate connections per queue** — BullMQ requires `maxRetriesPerRequest: null` which conflicts with general Redis usage. Each queue and worker gets its own connection.

**API + Worker split** — The server and workers are separate processes. In production, scale workers horizontally without scaling the API, or deploy workers as separate services.

**Rate limiting** — Email capped at 100/min, webhooks at 500/min, enforced at the queue level — not at the application level.

**Progress tracking** — Each processor calls `job.updateProgress()` at meaningful checkpoints. Visible in Bull Board and via the job status API.

**Stall detection** — BullMQ automatically detects stalled jobs and re-queues them, preventing silent failures when a worker crashes mid-job.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_URL` | `redis://localhost:6379` | Redis connection |
| `PORT` | `3000` | API server port |
| `EMAIL_CONCURRENCY` | `5` | Concurrent email jobs |
| `REPORT_CONCURRENCY` | `2` | Concurrent report jobs |
| `WEBHOOK_CONCURRENCY` | `10` | Concurrent webhook deliveries |
| `IMAGE_CONCURRENCY` | `3` | Concurrent image processing jobs |
| `DEFAULT_JOB_ATTEMPTS` | `3` | Max retry attempts |
| `DEFAULT_JOB_BACKOFF_DELAY` | `5000` | Base backoff delay (ms) |
| `BULL_BOARD_PATH` | `/admin/queues` | Dashboard URL path |
