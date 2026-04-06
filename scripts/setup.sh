#!/bin/bash
set -e
echo "🚀 Setting up node-job-queue"
npm install
docker compose up -d
echo ""
echo "✅ Setup complete!"
echo ""
echo "Start the worker:  npm run dev"
echo "Submit demo jobs:  npx tsx examples/demo-jobs.ts"
echo "Open Bull Board:   http://localhost:3000/admin/queues"
