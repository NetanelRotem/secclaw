#!/usr/bin/env sh
# One-shot install: dependencies, build, interactive setup.
set -e
cd "$(dirname "$0")"

if ! node -e 'process.exit(+process.versions.node.split(".")[0] >= 22 ? 0 : 1)' 2>/dev/null; then
  echo "Node.js 22+ is required: https://nodejs.org  (macOS: brew install node, Linux: https://github.com/nodesource/distributions)"
  exit 1
fi

npm ci
npm run build
node dist/setup.js
