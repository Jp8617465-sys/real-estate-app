#!/usr/bin/env bash
# Run TypeScript type checking across all packages and apps in the monorepo.
# This script is a convenience wrapper around the Turborepo type-check task.
# Usage: ./scripts/check-types.sh

set -euo pipefail

echo "Running type checks across all workspaces..."

npx turbo type-check

echo "All type checks passed."
