#!/bin/bash
# start-show.command
# Double-click this file in Finder to start the Thought Cloud server.
# A Terminal window will open and the server will run on http://localhost:3000
# Press Ctrl+C in the Terminal window to stop it.

cd "$(dirname "$0")"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Thought Cloud — starting server..."
echo "  Open: http://localhost:3000"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
npm start
