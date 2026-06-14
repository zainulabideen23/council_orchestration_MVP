#!/bin/bash
set -e

PYTHON_PORT=$((PORT + 1))
export ORCHESTRATOR_URL="http://localhost:$PYTHON_PORT"

cd orchestrator
gunicorn -w 1 -k uvicorn.workers.UvicornWorker main:app \
  --bind "0.0.0.0:$PYTHON_PORT" --log-level warning &
ORCH_PID=$!
cd ..

node src/index.js

kill $ORCH_PID 2>/dev/null
