#!/bin/sh
set -e
chown -R appuser:appgroup /app/data
exec su-exec appuser "$@"
