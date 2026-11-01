#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is not installed!"
    echo "Please install Node.js from https://nodejs.org or via your package manager."
    exit 1
fi

# Install dependencies if missing
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install --omit=dev
fi

node server.js
