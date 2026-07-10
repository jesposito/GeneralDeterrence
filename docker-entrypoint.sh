#!/bin/sh
set -eu

chown -R node:node "${DATA_DIR:-/data}"
exec su-exec node "$@"
