#!/bin/bash

echo "==============================================="
echo "Starting MaKo Knowledge Management Server"
echo "==============================================="
echo ""

# Kill any existing Flask processes
pkill -f "python3 app.py" 2>/dev/null
sleep 1

# Check if port 5001 is available
if lsof -Pi :5001 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "Port 5001 is already in use. Killing the process..."
    lsof -ti:5001 | xargs kill -9 2>/dev/null
    sleep 1
fi

echo "Starting Flask server on http://localhost:5001/"
echo ""
echo "Press Ctrl+C to stop the server"
echo "==============================================="
echo ""

# Start Flask server
python3 app.py
