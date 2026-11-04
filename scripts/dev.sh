#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ "$(uname -s)" == Darwin ]]; then
  identity="${GROKBOT_DEV_SIGN_IDENTITY:-}"
  if [[ -z "$identity" ]]; then
    identity="$(bash scripts/setup-dev-signing.sh)"
  fi
  exec ./node_modules/.bin/mygo dev -sign "$identity" "$@"
fi
exec ./node_modules/.bin/mygo dev "$@"
