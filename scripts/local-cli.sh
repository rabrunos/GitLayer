#!/bin/sh
# Direct usage: sh /absolute/path/to/git-layers-lab/scripts/local-cli.sh --help
# This launcher runs the built local CLI. It does not install or replace Git.
set -eu
SCRIPT_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
PROJECT_DIR=$(CDPATH='' cd -- "$SCRIPT_DIR/.." && pwd)
exec node "$PROJECT_DIR/dist/cli/index.js" "$@"
