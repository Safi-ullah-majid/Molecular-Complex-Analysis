#!/bin/bash
cd "$(dirname "$0")"

echo "🧬 Starting Molecular Complex Analyzer..."

# Kill any existing processes
pkill -f "python3 api.py" 2>/dev/null

# Start backend on port 8000
python3 api.py &
BACKEND_PID=$!

# Wait for startup
sleep 3

# Open app
xdg-open http://localhost:8000 2>/dev/null

echo "✓ App running at http://localhost:8000"
echo "Press Ctrl+C to stop"

# Cleanup
trap "kill $BACKEND_PID 2>/dev/null; exit" INT TERM
wait $BACKEND_PID
