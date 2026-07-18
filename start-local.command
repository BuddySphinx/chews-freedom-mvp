#!/bin/zsh
set -e

cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 22 or newer is required. Please install Node.js, then try again."
  read -n 1
  exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm is required. In Terminal, run: corepack enable"
  read -n 1
  exit 1
fi

if [ ! -d node_modules ]; then
  pnpm install
fi

pnpm build
pnpm start &
server_pid=$!

sleep 2
open "http://127.0.0.1:5174"

wait $server_pid
