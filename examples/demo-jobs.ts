/**
 * Demo: Submit sample jobs to all queues.
 * Run: npx tsx examples/demo-jobs.ts
 */

import { Queue } from "bullmq";

const connection = { host: "localhost", port: 6379 };

async function main() {
  const emailQueue = new Queue("email", { connection });
  const reportQueue = new Queue("report", { connection });
  const notificationQueue = new Queue("notification", { connection });

  // Email jobs
  await emailQueue.add("welcome", { to: "user@example.com", subject: "Welcome!", template: "welcome" });
  await emailQueue.add("digest", { to: "user@example.com", subject: "Weekly Digest", template: "digest" });
  console.log("📧 Added 2 email jobs");

  // Report jobs
  await reportQueue.add("daily-report", { type: "daily", date: new Date().toISOString() });
  console.log("📊 Added 1 report job");

  // Notification jobs
  await notificationQueue.add("push", { userId: "u1", title: "New comment", body: "Someone commented on your post" });
  await notificationQueue.add("push", { userId: "u2", title: "Task assigned", body: "You were assigned a new task" });
  console.log("🔔 Added 2 notification jobs");

  console.log("\n✅ All demo jobs submitted! Start the worker to process them.");
  process.exit(0);
}

main().catch(console.error);
