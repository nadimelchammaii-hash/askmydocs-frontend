#!/bin/sh
# Installs npm dependencies into the node_modules volume when they are missing or the
# lock file changed, then runs the container's command (the Vite dev server).
set -e

stamp=node_modules/.package-lock.sha1
current=$(sha1sum package-lock.json | cut -d' ' -f1)

if [ "$(cat "$stamp" 2>/dev/null)" != "$current" ]; then
    echo "Installing npm dependencies..."
    npm ci --no-audit --no-fund
    echo "$current" > "$stamp"
fi

exec "$@"
